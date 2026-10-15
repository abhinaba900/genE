import { type MigrateDownArgs, type MigrateUpArgs, sql } from "@payloadcms/db-postgres";

/**
 * 1. Lock the schema away from Supabase's auto-generated APIs (PostgREST / GraphQL).
 *    Gen E only talks to Postgres through Payload, so the `anon` and `authenticated`
 *    roles get no access at all, now or for tables created later, and RLS is on for
 *    every table with no policies. Payload connects as the table owner, which RLS
 *    does not restrict. On a plain Postgres (no Supabase roles) only RLS is applied.
 *
 * 2. Indexes for the hottest public queries.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    DECLARE t record;
    BEGIN
      FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
      END LOOP;
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
        REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
        REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;
        ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
        ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
        ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;
      END IF;
    END $$;

    -- Public story lists: published rows, newest first (feed, latest, category pages).
    CREATE INDEX IF NOT EXISTS stories_public_published_idx
      ON public.stories (published_at DESC, id DESC)
      WHERE _status = 'published' AND deleted_at IS NULL;
    -- Analytics: time-window aggregates and per-story counts.
    CREATE INDEX IF NOT EXISTS analytics_events_created_type_idx ON public.analytics_events (created_at, type);
    CREATE INDEX IF NOT EXISTS analytics_events_story_created_idx ON public.analytics_events (story_id, created_at);
    -- Dashboard activity feed.
    CREATE INDEX IF NOT EXISTS audit_events_created_desc_idx ON public.audit_events (created_at DESC);
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS public.stories_public_published_idx;
    DROP INDEX IF EXISTS public.analytics_events_created_type_idx;
    DROP INDEX IF EXISTS public.analytics_events_story_created_idx;
    DROP INDEX IF EXISTS public.audit_events_created_desc_idx;
  `);
}
