import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_pages_blocks_contact_form_fields_type" AS ENUM('text', 'email', 'tel', 'textarea', 'select', 'checkbox');
  CREATE TYPE "public"."enum_pages_blocks_contact_form_fields_width" AS ENUM('full', 'half');
  CREATE TYPE "public"."enum__pages_v_blocks_contact_form_fields_type" AS ENUM('text', 'email', 'tel', 'textarea', 'select', 'checkbox');
  CREATE TYPE "public"."enum__pages_v_blocks_contact_form_fields_width" AS ENUM('full', 'half');
  CREATE TYPE "public"."enum_form_submissions_status" AS ENUM('new', 'read', 'replied', 'spam');
  CREATE TABLE "pages_blocks_contact_form_fields" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"type" "enum_pages_blocks_contact_form_fields_type" DEFAULT 'text',
  	"width" "enum_pages_blocks_contact_form_fields_width" DEFAULT 'full',
  	"placeholder" varchar,
  	"required" boolean DEFAULT false,
  	"options" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_contact_form_fields" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"type" "enum__pages_v_blocks_contact_form_fields_type" DEFAULT 'text',
  	"width" "enum__pages_v_blocks_contact_form_fields_width" DEFAULT 'full',
  	"placeholder" varchar,
  	"required" boolean DEFAULT false,
  	"options" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "form_submissions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"status" "enum_form_submissions_status" DEFAULT 'new',
  	"name" varchar,
  	"email" varchar,
  	"form" varchar,
  	"page_id" integer,
  	"entries" jsonb,
  	"internal_note" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "pages_blocks_contact_form" ADD COLUMN "submit_label" varchar DEFAULT 'Send message';
  ALTER TABLE "pages_blocks_contact_form" ADD COLUMN "intro" varchar;
  ALTER TABLE "pages_blocks_contact_form" ADD COLUMN "success_message" varchar DEFAULT 'Thanks — your message has reached the gen.E team. We''ll get back to you soon.';
  ALTER TABLE "pages_blocks_contact_form" ADD COLUMN "notify_email" varchar;
  ALTER TABLE "_pages_v_blocks_contact_form" ADD COLUMN "submit_label" varchar DEFAULT 'Send message';
  ALTER TABLE "_pages_v_blocks_contact_form" ADD COLUMN "intro" varchar;
  ALTER TABLE "_pages_v_blocks_contact_form" ADD COLUMN "success_message" varchar DEFAULT 'Thanks — your message has reached the gen.E team. We''ll get back to you soon.';
  ALTER TABLE "_pages_v_blocks_contact_form" ADD COLUMN "notify_email" varchar;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "form_submissions_id" integer;
  ALTER TABLE "pages_blocks_contact_form_fields" ADD CONSTRAINT "pages_blocks_contact_form_fields_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_contact_form"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_contact_form_fields" ADD CONSTRAINT "_pages_v_blocks_contact_form_fields_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_contact_form"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "pages_blocks_contact_form_fields_order_idx" ON "pages_blocks_contact_form_fields" USING btree ("_order");
  CREATE INDEX "pages_blocks_contact_form_fields_parent_id_idx" ON "pages_blocks_contact_form_fields" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_contact_form_fields_order_idx" ON "_pages_v_blocks_contact_form_fields" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_contact_form_fields_parent_id_idx" ON "_pages_v_blocks_contact_form_fields" USING btree ("_parent_id");
  CREATE INDEX "form_submissions_status_idx" ON "form_submissions" USING btree ("status");
  CREATE INDEX "form_submissions_page_idx" ON "form_submissions" USING btree ("page_id");
  CREATE INDEX "form_submissions_updated_at_idx" ON "form_submissions" USING btree ("updated_at");
  CREATE INDEX "form_submissions_created_at_idx" ON "form_submissions" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_form_submissions_fk" FOREIGN KEY ("form_submissions_id") REFERENCES "public"."form_submissions"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_form_submissions_id_idx" ON "payload_locked_documents_rels" USING btree ("form_submissions_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "pages_blocks_contact_form_fields" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_contact_form_fields" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "form_submissions" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "pages_blocks_contact_form_fields" CASCADE;
  DROP TABLE "_pages_v_blocks_contact_form_fields" CASCADE;
  DROP TABLE "form_submissions" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_form_submissions_fk";
  
  DROP INDEX "payload_locked_documents_rels_form_submissions_id_idx";
  ALTER TABLE "pages_blocks_contact_form" DROP COLUMN "submit_label";
  ALTER TABLE "pages_blocks_contact_form" DROP COLUMN "intro";
  ALTER TABLE "pages_blocks_contact_form" DROP COLUMN "success_message";
  ALTER TABLE "pages_blocks_contact_form" DROP COLUMN "notify_email";
  ALTER TABLE "_pages_v_blocks_contact_form" DROP COLUMN "submit_label";
  ALTER TABLE "_pages_v_blocks_contact_form" DROP COLUMN "intro";
  ALTER TABLE "_pages_v_blocks_contact_form" DROP COLUMN "success_message";
  ALTER TABLE "_pages_v_blocks_contact_form" DROP COLUMN "notify_email";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "form_submissions_id";
  DROP TYPE "public"."enum_pages_blocks_contact_form_fields_type";
  DROP TYPE "public"."enum_pages_blocks_contact_form_fields_width";
  DROP TYPE "public"."enum__pages_v_blocks_contact_form_fields_type";
  DROP TYPE "public"."enum__pages_v_blocks_contact_form_fields_width";
  DROP TYPE "public"."enum_form_submissions_status";`)
}
