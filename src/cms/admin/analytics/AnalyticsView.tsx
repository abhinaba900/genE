import { sql } from "@payloadcms/db-postgres";
import { Gutter } from "@payloadcms/ui";
import { BarChart3 } from "lucide-react";
import Link from "next/link";
import type { Payload } from "payload";

type Props = {
  payload: Payload;
  user?: { role?: string } | null;
  searchParams?: Record<string, string | string[] | undefined>;
};

const RANGES = [7, 30, 90] as const;

type Row = Record<string, unknown>;
async function query<T extends Row>(payload: Payload, statement: ReturnType<typeof sql>): Promise<T[]> {
  const db = (payload.db as unknown as { drizzle: { execute: (q: unknown) => Promise<{ rows: T[] }> } }).drizzle;
  const res = await db.execute(statement);
  return res.rows;
}

/**
 * Content analytics from gen.E's own first-party events (see AnalyticsEvents).
 * Nothing here is estimated or invented: with no events yet, the view says so.
 */
export async function AnalyticsView({ payload, user, searchParams }: Props) {
  if (user?.role !== "admin" && user?.role !== "editor") {
    return (
      <Gutter>
        <p>Analytics are available to editors and administrators.</p>
      </Gutter>
    );
  }
  const rangeParam = Number(Array.isArray(searchParams?.range) ? searchParams.range[0] : searchParams?.range);
  const days = (RANGES as readonly number[]).includes(rangeParam) ? rangeParam : 30;
  const since = new Date(Date.now() - days * 24 * 3600_000).toISOString();

  const [totals] = await query<{ views: number; impressions: number; starts: number; completes: number; sessions: number }>(
    payload,
    sql`SELECT
          COUNT(*) FILTER (WHERE type = 'page_view')::int        AS views,
          COUNT(*) FILTER (WHERE type = 'video_impression')::int AS impressions,
          COUNT(*) FILTER (WHERE type = 'video_start')::int      AS starts,
          COUNT(*) FILTER (WHERE type = 'video_complete')::int   AS completes,
          COUNT(DISTINCT session)::int                            AS sessions
        FROM analytics_events WHERE created_at >= ${since}`,
  );

  const published = await query<{ week: string; n: number }>(
    payload,
    sql`SELECT to_char(date_trunc('week', first_published_at), 'YYYY-MM-DD') AS week, COUNT(*)::int AS n
        FROM stories
        WHERE first_published_at IS NOT NULL AND first_published_at >= now() - interval '26 weeks' AND deleted_at IS NULL
        GROUP BY 1 ORDER BY 1`,
  );

  const hasEvents = (totals?.views ?? 0) + (totals?.impressions ?? 0) > 0;

  const [daily, topStories, topCategories] = hasEvents
    ? await Promise.all([
        query<{ day: string; views: number; starts: number }>(
          payload,
          sql`SELECT to_char(d::date, 'YYYY-MM-DD') AS day,
                     COUNT(e.id) FILTER (WHERE e.type = 'page_view')::int AS views,
                     COUNT(e.id) FILTER (WHERE e.type = 'video_start')::int AS starts
              FROM generate_series(date_trunc('day', ${since}::timestamptz), date_trunc('day', now()), interval '1 day') d
              LEFT JOIN analytics_events e ON date_trunc('day', e.created_at) = d
              GROUP BY 1 ORDER BY 1`,
        ),
        query<{ id: number; title: string; views: number; starts: number; completes: number }>(
          payload,
          sql`SELECT s.id, s.title,
                     COUNT(*) FILTER (WHERE e.type = 'page_view')::int      AS views,
                     COUNT(*) FILTER (WHERE e.type = 'video_start')::int    AS starts,
                     COUNT(*) FILTER (WHERE e.type = 'video_complete')::int AS completes
              FROM analytics_events e JOIN stories s ON s.id = e.story_id
              WHERE e.created_at >= ${since}
              GROUP BY s.id, s.title
              ORDER BY (COUNT(*) FILTER (WHERE e.type IN ('page_view','video_start'))) DESC
              LIMIT 10`,
        ),
        query<{ name: string; n: number }>(
          payload,
          sql`SELECT c.name, COUNT(*)::int AS n
              FROM analytics_events e JOIN categories c ON c.id = e.category_id
              WHERE e.created_at >= ${since} AND e.type IN ('page_view', 'video_start')
              GROUP BY c.name ORDER BY n DESC LIMIT 8`,
        ),
      ])
    : [[], [], []];

  const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : "—");

  return (
    <Gutter className="gene-analytics">
      <header className="gene-dashboard__header">
        <div>
          <p className="gene-kicker">Insights</p>
          <h1>Content analytics</h1>
        </div>
        <nav aria-label="Date range" className="gene-segmented">
          {RANGES.map((r) => (
            <Link key={r} href={`/admin/analytics?range=${r}`} aria-current={r === days ? "page" : undefined}>
              {r} days
            </Link>
          ))}
        </nav>
      </header>

      {!hasEvents ? (
        <section className="gene-panel gene-setup">
          <BarChart3 size={22} aria-hidden />
          <h2>No visitor data yet</h2>
          <p>
            gen.E records its own privacy-friendly events: article views, video impressions, starts and completions. Nothing is estimated —
            figures appear here as soon as readers visit the published site.
          </p>
          <ul>
            <li>Collection is {process.env.ANALYTICS_ENABLED === "false" ? <strong>off</strong> : <strong>on</strong>} (set ANALYTICS_ENABLED=false to turn it off).</li>
            <li>No cookies, IP addresses or device fingerprints are stored. A random per-tab id de-duplicates repeat plays.</li>
            <li>Looping reels count one start and one completion per visit.</li>
          </ul>
        </section>
      ) : (
        <>
          <section aria-label="Totals" className="gene-cards">
            <Tile label="Article views" value={totals.views} />
            <Tile label="Video starts" value={totals.starts} note={`${pct(totals.starts, totals.impressions)} of ${totals.impressions.toLocaleString("en-IN")} impressions`} />
            <Tile label="Completion rate" text={pct(totals.completes, totals.starts)} note={`${totals.completes.toLocaleString("en-IN")} completions`} />
            <Tile label="Visits" value={totals.sessions} note="Distinct browser tabs" />
          </section>

          <section className="gene-panel" aria-labelledby="trend">
            <div className="gene-panel__head">
              <h2 id="trend">Article views per day</h2>
            </div>
            <BarSeries data={daily.map((d) => ({ key: d.day, label: shortDate(d.day), value: d.views, tip: `${shortDate(d.day)}: ${d.views} views, ${d.starts} video starts` }))} />
            <details className="gene-table-toggle">
              <summary>Show as table</summary>
              <table className="gene-table">
                <thead>
                  <tr>
                    <th scope="col">Day</th>
                    <th scope="col">Article views</th>
                    <th scope="col">Video starts</th>
                  </tr>
                </thead>
                <tbody>
                  {daily.map((d) => (
                    <tr key={d.day}>
                      <td>{shortDate(d.day)}</td>
                      <td>{d.views}</td>
                      <td>{d.starts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </section>

          <div className="gene-dashboard__grid">
            <section className="gene-panel" aria-labelledby="top-stories">
              <div className="gene-panel__head">
                <h2 id="top-stories">Most viewed stories</h2>
              </div>
              <table className="gene-table">
                <thead>
                  <tr>
                    <th scope="col">Story</th>
                    <th scope="col" className="num">Views</th>
                    <th scope="col" className="num">Starts</th>
                    <th scope="col" className="num">Completion</th>
                  </tr>
                </thead>
                <tbody>
                  {topStories.map((s) => (
                    <tr key={s.id}>
                      <td className="gene-table__title">
                        <Link href={`/admin/collections/stories/${s.id}`}>{s.title}</Link>
                      </td>
                      <td className="num">{s.views}</td>
                      <td className="num">{s.starts}</td>
                      <td className="num">{pct(s.completes, s.starts)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
            <section className="gene-panel" aria-labelledby="top-categories">
              <div className="gene-panel__head">
                <h2 id="top-categories">Most viewed categories</h2>
              </div>
              <RankedBars data={topCategories.map((c) => ({ label: c.name, value: c.n }))} unit="views + starts" />
            </section>
          </div>
        </>
      )}

      <section className="gene-panel" aria-labelledby="published-trend">
        <div className="gene-panel__head">
          <h2 id="published-trend">Stories published per week</h2>
          <span className="gene-muted">Last 26 weeks</span>
        </div>
        {published.length === 0 ? (
          <p className="gene-muted">No stories published in this period.</p>
        ) : (
          <BarSeries data={published.map((w) => ({ key: w.week, label: shortDate(w.week), value: w.n, tip: `Week of ${shortDate(w.week)}: ${w.n} published` }))} />
        )}
      </section>
    </Gutter>
  );
}

function Tile({ label, value, text, note }: { label: string; value?: number; text?: string; note?: string }) {
  return (
    <div className="gene-card gene-card--static">
      <span className="gene-card__value">{text ?? (value ?? 0).toLocaleString("en-IN")}</span>
      <span className="gene-card__label">{label}</span>
      {note && <span className="gene-card__note">{note}</span>}
    </div>
  );
}

/** Single-series column chart: thin bars from a shared baseline, hover tooltip per bar, sparse axis labels. */
function BarSeries({ data }: { data: { key: string; label: string; value: number; tip: string }[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const every = Math.max(1, Math.ceil(data.length / 8));
  return (
    <div className="gene-bars" role="img" aria-label={`Bar chart, peak ${max}`}>
      <div className="gene-bars__plot">
        {data.map((d) => (
          <div key={d.key} className="gene-bars__col" data-tip={d.tip} tabIndex={0} aria-label={d.tip}>
            <span className="gene-bars__bar" style={{ height: `${(d.value / max) * 100}%` }} />
          </div>
        ))}
      </div>
      <div className="gene-bars__axis" aria-hidden>
        {data.map((d, i) => (
          <span key={d.key}>{i % every === 0 ? d.label : ""}</span>
        ))}
      </div>
      <p className="gene-bars__peak">Peak {max.toLocaleString("en-IN")}</p>
    </div>
  );
}

function RankedBars({ data, unit }: { data: { label: string; value: number }[]; unit: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <ol className="gene-ranked">
      {data.map((d) => (
        <li key={d.label} title={`${d.label}: ${d.value} ${unit}`}>
          <div className="gene-ranked__row">
            <span>{d.label}</span>
            <span className="num">{d.value.toLocaleString("en-IN")}</span>
          </div>
          <span className="gene-ranked__track">
            <span style={{ width: `${(d.value / max) * 100}%` }} />
          </span>
        </li>
      ))}
    </ol>
  );
}

function shortDate(day: string) {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}
