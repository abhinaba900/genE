import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_pages_template" AS ENUM('standard', 'feature', 'contact');
  CREATE TYPE "public"."enum__pages_v_version_template" AS ENUM('standard', 'feature', 'contact');
  ALTER TABLE "stories" ADD COLUMN "source_url" varchar;
  ALTER TABLE "stories" ADD COLUMN "reading_time" numeric;
  ALTER TABLE "_stories_v" ADD COLUMN "version_source_url" varchar;
  ALTER TABLE "_stories_v" ADD COLUMN "version_reading_time" numeric;
  ALTER TABLE "pages" ADD COLUMN "template" "enum_pages_template" DEFAULT 'standard';
  ALTER TABLE "_pages_v" ADD COLUMN "version_template" "enum__pages_v_version_template" DEFAULT 'standard';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "stories" DROP COLUMN "source_url";
  ALTER TABLE "stories" DROP COLUMN "reading_time";
  ALTER TABLE "_stories_v" DROP COLUMN "version_source_url";
  ALTER TABLE "_stories_v" DROP COLUMN "version_reading_time";
  ALTER TABLE "pages" DROP COLUMN "template";
  ALTER TABLE "_pages_v" DROP COLUMN "version_template";
  DROP TYPE "public"."enum_pages_template";
  DROP TYPE "public"."enum__pages_v_version_template";`)
}
