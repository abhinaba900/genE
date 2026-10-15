import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "site_settings" ALTER COLUMN "site_name" SET DEFAULT 'gen.E';
  ALTER TABLE "site_settings" ALTER COLUMN "copyright" SET DEFAULT 'gen.E';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "site_settings" ALTER COLUMN "site_name" SET DEFAULT 'Gen E';
  ALTER TABLE "site_settings" ALTER COLUMN "copyright" SET DEFAULT 'Gen E';`)
}
