import { Gutter } from "@payloadcms/ui";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  Eye,
  Film,
  FolderTree,
  Maximize2,
  PenLine,
  Plus,
  Upload,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import type { Payload } from "payload";
import { DEFAULT_TIMEZONE, formatInZone } from "../../time";
import { DrawerButton } from "../drawers/DrawerButton";
import { SideTabs } from "./SideTabs";
import { DRAFTS_QUERY, DRAFTS_WHERE, statusMeta } from "../workflow/status";

type Props = { payload: Payload; user?: { id: number; name?: string; role?: string } | null };

type StoryRow = {
  id: number;
  title?: string;
  workflowStatus?: string;
  publishedAt?: string | null;
  scheduledFor?: string | null;
  updatedAt: string;
  category?: { name?: string } | number | null;
  author?: { name?: string } | number | null;
  video?: { posterUrl?: string | null } | number | null;
  featuredImage?: { sizes?: { thumbnail?: { url?: string | null } }; url?: string | null } | number | null;
};

type ActivityRow = {
  id: number;
  action: string;
  entityTitle?: string;
  entityCollection: string;
  entityId: string;
  user?: { name?: string } | null;
  system?: boolean;
  createdAt: string;
};

const DAY = 86_400_000;
const storyList = (status?: string) => `/admin/collections/stories${status ? `?where[workflowStatus][equals]=${status}` : ""}`;
const name = (v: unknown) => (v && typeof v === "object" && "name" in v ? String((v as { name?: string }).name ?? "") : "—");
const thumb = (s: StoryRow) =>
  (typeof s.featuredImage === "object" && (s.featuredImage?.sizes?.thumbnail?.url || s.featuredImage?.url)) ||
  (typeof s.video === "object" && s.video?.posterUrl) ||
  null;
const fmt = (n: number) => n.toLocaleString("en-IN");

/**
 * Editorial overview: real counts, recent work, upcoming publications and team activity.
 * Create and edit actions open in a drawer so editors never lose their place.
 */
export async function Dashboard({ payload, user }: Props) {
  const timeZone = payload.config.admin.timezones?.defaultTimezone ?? DEFAULT_TIMEZONE;
  const isEditor = user?.role === "admin" || user?.role === "editor";
  const count = (collection: "stories" | "videos" | "categories" | "authors", where?: object) =>
    payload.count({ collection, where: where as never, overrideAccess: true }).then((r) => r.totalDocs);
  const now = Date.now();
  const weekAgo = new Date(now - 7 * DAY).toISOString();

  const [published, publishedThisWeek, drafts, inReview, scheduledCount, videos, categories, authors, recent, upcoming, activity] =
    await Promise.all([
      count("stories", { and: [{ _status: { equals: "published" } }, { workflowStatus: { not_equals: "archived" } }] }),
      count("stories", { and: [{ _status: { equals: "published" } }, { publishedAt: { greater_than: weekAgo } }] }),
      // Unpublished edits live in versions, which count() can't see — find() with drafts can.
      payload.find({ collection: "stories", draft: true, where: DRAFTS_WHERE as never, limit: 1, depth: 0, select: {}, overrideAccess: true }).then((r) => r.totalDocs),
      count("stories", { workflowStatus: { equals: "in_review" } }),
      count("stories", { workflowStatus: { equals: "scheduled" } }),
      count("videos"),
      count("categories"),
      count("authors"),
      payload.find({ collection: "stories", draft: true, sort: "-updatedAt", limit: 6, depth: 1, overrideAccess: true }),
      payload.find({
        collection: "stories",
        draft: true,
        where: { workflowStatus: { equals: "scheduled" } },
        sort: "scheduledFor",
        limit: 6,
        depth: 1,
        overrideAccess: true,
      }),
      isEditor
        ? payload.find({ collection: "audit-events", sort: "-createdAt", limit: 12, depth: 1, overrideAccess: true })
        : Promise.resolve({ docs: [] as never[] }),
    ]);

  const kpis = [
    {
      label: "Published stories",
      value: published,
      icon: CheckCircle2,
      tone: "green",
      href: storyList("published"),
      pill: publishedThisWeek > 0 ? `+${fmt(publishedThisWeek)} this week` : "none this week",
      note: "Live on the website",
    },
    {
      label: "Drafts",
      value: drafts,
      icon: PenLine,
      tone: "slate",
      href: `/admin/collections/stories?${DRAFTS_QUERY}`,
      pill: drafts > 0 ? "in progress" : "all clear",
      note: "Incl. unpublished edits",
    },
    {
      label: "Awaiting review",
      value: inReview,
      icon: ClipboardCheck,
      tone: "amber",
      href: storyList("in_review"),
      pill: inReview > 0 ? "needs attention" : "all clear",
      note: isEditor ? "Waiting for an editor" : "Submitted by the team",
      alert: inReview > 0 && isEditor,
    },
    {
      label: "Scheduled",
      value: scheduledCount,
      icon: CalendarClock,
      tone: "blue",
      href: `${storyList("scheduled")}&sort=scheduledFor`,
      pill: scheduledCount > 0 ? "queued" : "empty queue",
      note: "Publish automatically",
    },
  ];

  const library = [
    { label: "Videos", singular: "video", value: videos, icon: Film, tone: "violet", href: "/admin/collections/videos", create: "videos", action: "Upload", ActionIcon: Upload },
    { label: "Categories", singular: "category", value: categories, icon: FolderTree, tone: "green", href: "/admin/collections/categories", create: isEditor ? "categories" : undefined, action: "Add", ActionIcon: Plus },
    { label: "Authors", singular: "author", value: authors, icon: UserRound, tone: "blue", href: "/admin/collections/authors", create: isEditor ? "authors" : undefined, action: "Add", ActionIcon: Plus },
  ];

  const firstName = user?.name?.replace(/\(.*?\)/g, "").trim().split(" ")[0];
  const today = new Intl.DateTimeFormat("en-GB", { timeZone, weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(now);
  const lede =
    inReview > 0 && isEditor
      ? `${fmt(inReview)} ${inReview === 1 ? "story is" : "stories are"} waiting for your review`
      : `${fmt(published)} ${published === 1 ? "story is" : "stories are"} live`;

  return (
    <Gutter className="gene-dashboard">
      <header className="gene-dashboard__header">
        <div>
          <p className="gene-kicker">{today}</p>
          <h1>
            Welcome back
            {firstName ? (
              <>
                , <span className="gene-accent-text">{firstName}</span>
              </>
            ) : null}
          </h1>
          <p className="gene-dashboard__lede">
            <strong>{lede}</strong>
            {publishedThisWeek > 0 ? `, ${fmt(publishedThisWeek)} published in the last 7 days` : ""}
            {scheduledCount > 0 ? ` and ${fmt(scheduledCount)} scheduled.` : "."}
          </p>
        </div>
        <div className="gene-dashboard__actions">
          <a href="/" target="_blank" rel="noopener" className="gene-btn">
            <ExternalLink size={15} aria-hidden /> View website
          </a>
          <DrawerButton collection="stories" className="gene-btn gene-btn--primary">
            <Plus size={16} aria-hidden /> New story
          </DrawerButton>
        </div>
      </header>

      <section aria-label="Story pipeline" className="gene-kpis">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <Link key={k.label} href={k.href} className={`gene-kpi gene-kpi--${k.tone}${"alert" in k && k.alert ? " gene-kpi--alert" : ""}`}>
              <span className="gene-kpi__top">
                <span className={`gene-chip gene-chip--${k.tone}`}>
                  <Icon size={17} aria-hidden />
                </span>
                <span className="gene-kpi__label">{k.label}</span>
                <span className={`gene-pill gene-pill--${k.tone}`}>{k.pill}</span>
              </span>
              <span className="gene-kpi__value">{fmt(k.value)}</span>
              <span className="gene-kpi__foot">
                {k.note}
                <ArrowRight size={14} aria-hidden />
              </span>
            </Link>
          );
        })}
      </section>

      <div className="gene-dashboard__grid">
        <section aria-labelledby="recent-stories" className="gene-panel">
          <div className="gene-panel__head">
            <div>
              <p className="gene-kicker">Newsroom</p>
              <h2 id="recent-stories">Recent stories</h2>
            </div>
            <Link href="/admin/collections/stories" className="gene-link">
              All stories <ArrowRight size={14} aria-hidden />
            </Link>
          </div>
          {recent.docs.length === 0 ? (
            <div className="gene-empty">
              <p>No stories yet.</p>
              <DrawerButton collection="stories" className="gene-btn">
                <Plus size={15} aria-hidden /> Create the first story
              </DrawerButton>
            </div>
          ) : (
            <div className="gene-table-wrap">
              <table className="gene-table">
                <thead>
                  <tr>
                    <th scope="col">Story</th>
                    <th scope="col">Category</th>
                    <th scope="col">Status</th>
                    <th scope="col">Date</th>
                    <th scope="col" className="gene-table__actions">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(recent.docs as unknown as StoryRow[]).map((s) => {
                    const meta = statusMeta(s.workflowStatus);
                    const src = thumb(s);
                    const date = s.workflowStatus === "scheduled" ? s.scheduledFor : s.publishedAt ?? s.updatedAt;
                    const title = s.title || "Untitled story";
                    return (
                      <tr key={s.id}>
                        <td>
                          <div className="gene-story">
                            {src ? (
                              <img src={src} alt="" width={34} height={48} loading="lazy" className="gene-story__thumb" />
                            ) : (
                              <span className="gene-story__thumb gene-story__thumb--empty">
                                <Film size={14} aria-hidden />
                              </span>
                            )}
                            <span className="gene-story__text">
                              <DrawerButton collection="stories" id={s.id} className="gene-story__title" title={`Quick edit “${title}”`}>
                                {title}
                              </DrawerButton>
                              <small>{name(s.author)}</small>
                            </span>
                          </div>
                        </td>
                        <td className="gene-table__muted">{name(s.category)}</td>
                        <td>
                          <span className={`gene-status gene-status--${meta.tone}`}>{meta.label}</span>
                        </td>
                        <td className="gene-table__date">{date ? formatInZone(date, timeZone, false) : "—"}</td>
                        <td className="gene-table__actions">
                          <span className="gene-icon-actions">
                            <DrawerButton collection="stories" id={s.id} className="gene-icon-btn" label="Quick edit">
                              <PenLine size={15} aria-hidden />
                            </DrawerButton>
                            <a href={`/preview/stories/${s.id}`} target="_blank" rel="noopener" className="gene-icon-btn" aria-label="Preview" title="Preview">
                              <Eye size={15} aria-hidden />
                            </a>
                            <Link href={`/admin/collections/stories/${s.id}`} className="gene-icon-btn" aria-label="Open full editor" title="Open full editor">
                              <Maximize2 size={14} aria-hidden />
                            </Link>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="gene-dashboard__side">
          <section aria-label="Library" className="gene-panel gene-library-panel">
            <ul className="gene-library">
              {library.map((l) => {
                const Icon = l.icon;
                const ActionIcon = l.ActionIcon;
                return (
                  <li key={l.label}>
                    <Link href={l.href} className="gene-library__text">
                      <span className={`gene-chip gene-chip--${l.tone} gene-chip--sm`}>
                        <Icon size={14} aria-hidden />
                      </span>
                      <strong>{fmt(l.value)}</strong>
                      <small>{l.label}</small>
                    </Link>
                    {l.create && (
                      <DrawerButton collection={l.create} className="gene-icon-btn gene-library__add" label={`${l.action} ${l.singular}`}>
                        <ActionIcon size={14} aria-hidden />
                      </DrawerButton>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          <SideTabs
            label="Schedule and activity"
            tabs={[
              ...(isEditor
                ? [
                    {
                      key: "activity",
                      label: "Recent activity",
                      content:
                        activity.docs.length === 0 ? (
                          <div className="gene-empty">
                            <p>No activity recorded yet.</p>
                          </div>
                        ) : (
                          <ul className="gene-activity">
                            {(activity.docs as unknown as ActivityRow[]).map((a) => (
                              <li key={a.id} className={`gene-activity__item gene-activity__item--${ACTION_TONE[a.action] ?? "slate"}`}>
                                <p>
                                  <strong>{a.system ? "System" : a.user?.name ?? "Someone"}</strong> {ACTION_LABEL[a.action] ?? a.action}{" "}
                                  {a.entityCollection === "stories" && a.action !== "deleted" ? (
                                    <DrawerButton collection="stories" id={a.entityId} className="gene-activity__link">
                                      {a.entityTitle || "a story"}
                                    </DrawerButton>
                                  ) : (
                                    <span className="gene-activity__entity">{a.entityTitle || (a.entityCollection === "stories" ? "a story" : a.entityCollection)}</span>
                                  )}
                                </p>
                                <time dateTime={a.createdAt}>{formatInZone(a.createdAt, timeZone, false)}</time>
                              </li>
                            ))}
                          </ul>
                        ),
                      footer: (
                        <Link href="/admin/collections/audit-events" className="gene-link">
                          Full activity log <ArrowRight size={14} aria-hidden />
                        </Link>
                      ),
                    },
                  ]
                : []),
              {
                key: "upcoming",
                label: "Upcoming",
                count: upcoming.docs.length,
                content:
                  upcoming.docs.length === 0 ? (
                    <div className="gene-empty gene-empty--center">
                      <span className="gene-chip gene-chip--blue">
                        <CalendarClock size={16} aria-hidden />
                      </span>
                      <p>Nothing scheduled.</p>
                    </div>
                  ) : (
                    <ul className="gene-list">
                      {(upcoming.docs as unknown as StoryRow[]).map((s) => (
                        <li key={s.id}>
                          <span className="gene-chip gene-chip--blue gene-chip--sm">
                            <CalendarClock size={14} aria-hidden />
                          </span>
                          <div>
                            <DrawerButton collection="stories" id={s.id} className="gene-list__title">
                              {s.title || "Untitled story"}
                            </DrawerButton>
                            <p>{formatInZone(s.scheduledFor, timeZone)}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ),
                footer: (
                  <Link href={`${storyList("scheduled")}&sort=scheduledFor`} className="gene-link">
                    All scheduled <ArrowRight size={14} aria-hidden />
                  </Link>
                ),
              },
            ]}
          />
        </div>
      </div>
    </Gutter>
  );
}

const ACTION_TONE: Record<string, string> = {
  created: "blue",
  updated: "slate",
  submitted: "amber",
  changes_requested: "amber",
  approved: "green",
  scheduled: "blue",
  schedule_cancelled: "slate",
  published: "green",
  unpublished: "slate",
  archived: "slate",
  restored: "blue",
  trashed: "red",
  deleted: "red",
  merged: "violet",
};

const ACTION_LABEL: Record<string, string> = {
  created: "created",
  updated: "edited",
  submitted: "submitted for review",
  changes_requested: "requested changes to",
  approved: "approved",
  scheduled: "scheduled",
  schedule_cancelled: "cancelled the schedule for",
  published: "published",
  unpublished: "unpublished",
  archived: "archived",
  restored: "restored",
  trashed: "moved to trash",
  deleted: "deleted",
  merged: "merged tags into",
};
