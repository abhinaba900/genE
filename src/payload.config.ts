import path from "node:path";
import { fileURLToPath } from "node:url";
import { postgresAdapter } from "@payloadcms/db-postgres";
import { nodemailerAdapter } from "@payloadcms/email-nodemailer";
import { seoPlugin } from "@payloadcms/plugin-seo";
import { s3Storage } from "@payloadcms/storage-s3";
import { buildConfig, type Plugin } from "payload";
import sharp from "sharp";
import { AnalyticsEvents } from "./cms/collections/AnalyticsEvents";
import { AuditEvents } from "./cms/collections/AuditEvents";
import { Authors } from "./cms/collections/Authors";
import { Categories } from "./cms/collections/Categories";
import { FormSubmissions } from "./cms/collections/FormSubmissions";
import { Media } from "./cms/collections/Media";
import { Pages } from "./cms/collections/Pages";
import { Stories } from "./cms/collections/Stories";
import { Tags } from "./cms/collections/Tags";
import { Users } from "./cms/collections/Users";
import { Videos } from "./cms/collections/Videos";
import { analyticsEndpoint } from "./cms/endpoints/analytics";
import { Homepage } from "./cms/globals/Homepage";
import { Navigation } from "./cms/globals/Navigation";
import { SiteSettings } from "./cms/globals/SiteSettings";
import { publishScheduledTask } from "./cms/jobs/publishScheduled";
import { articleEditor } from "./cms/richtext";
import { IMAGE_MAX_BYTES, PREFIX, VIDEO_MAX_BYTES, publicFileUrl, storage } from "./cms/storage";
import { SITE_URL, storyPath } from "./lib/site";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const env = process.env;

if (!env.PAYLOAD_SECRET && env.NODE_ENV === "production") {
  throw new Error("PAYLOAD_SECRET must be set in production.");
}

/**
 * Postgres connection pool. Remote databases (Supabase) always use TLS; set DATABASE_CA_CERT
 * (the PEM from Supabase → Database → SSL) to also verify the server certificate.
 * The pool stays small: Supabase's pooler caps client connections per project, and each
 * server instance holds its own pool.
 */
function databasePool() {
  const connectionString = env.DATABASE_URL ?? "postgres://postgres@127.0.0.1:5433/gen_e";
  const host = new URL(connectionString).hostname;
  const local = ["127.0.0.1", "localhost", "::1"].includes(host);
  // Allows the PEM to be stored on one line with literal "\n" sequences.
  const ca = env.DATABASE_CA_CERT?.replace(/\\n/g, "\n");
  return {
    connectionString,
    max: Number(env.DATABASE_POOL_MAX ?? (local ? 10 : 5)),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ssl: local ? undefined : ca ? { ca, rejectUnauthorized: true } : { rejectUnauthorized: false },
  };
}

/** Swap Payload's S3 upload handler for ours, which reports progress and enforces size limits client-side. */
const progressUploads: Plugin = (config) => {
  const providers = config.admin?.components?.providers ?? [];
  for (const provider of providers) {
    if (typeof provider === "object" && provider && "path" in provider && provider.path === "@payloadcms/storage-s3/client#S3ClientUploadHandler") {
      provider.path = "@/cms/admin/upload/ProgressUploadHandler#ProgressUploadHandler";
      const props = (provider.clientProps ??= {}) as Record<string, unknown>;
      props.extra = { maxBytes: props.collectionSlug === "videos" ? VIDEO_MAX_BYTES : IMAGE_MAX_BYTES };
    }
  }
  return config;
};

/**
 * SEO plugin, used for its generate-* endpoints only. Stories and Pages place the SEO fields
 * themselves (inside their own tabs), but the plugin's endpoints reject any collection not
 * listed in `collections` with a 403 — so list them, and discard the duplicate `meta` fields
 * the plugin would otherwise inject into those collections.
 */
const seo: Plugin = async (config) => {
  const withSeo = await seoPlugin({
    collections: ["stories", "pages"],
    generateTitle: ({ doc }) => (doc?.title ? `${doc.title}` : "gen.E"),
    generateDescription: ({ doc }) => doc?.excerpt ?? doc?.intro ?? "",
    generateImage: ({ doc }) => doc?.featuredImage ?? "",
    generateURL: ({ doc, collectionSlug }) =>
      collectionSlug === "stories" ? `${SITE_URL}${storyPath(doc?.slug ?? "")}` : `${SITE_URL}/${doc?.slug ?? ""}`,
  })(config);
  return { ...withSeo, collections: config.collections };
};

export default buildConfig({
  serverURL: SITE_URL,
  secret: env.PAYLOAD_SECRET ?? "dev-only-insecure-secret-change-me",
  // Only the site's own origin may make credentialed requests or submit cookie-authenticated mutations.
  cors: [SITE_URL],
  csrf: [SITE_URL],
  admin: {
    user: Users.slug,
    theme: "light",
    importMap: { baseDir: path.resolve(dirname) },
    meta: {
      titleSuffix: " · gen.E CMS",
      description: "gen.E editorial CMS",
      icons: [
        { rel: "icon", type: "image/png", sizes: "192x192", url: "/brand/gen-e-mark.png" },
        { rel: "apple-touch-icon", type: "image/png", url: "/apple-icon.png" },
      ],
      openGraph: { images: [{ url: "/brand/og-default.jpg", width: 1200, height: 630 }] },
    },
    dateFormat: "d MMM yyyy, HH:mm",
    timezones: {
      defaultTimezone: env.EDITORIAL_TIMEZONE ?? "Asia/Kolkata",
      supportedTimezones: [
        { label: "India (IST)", value: "Asia/Kolkata" },
        { label: "UTC", value: "UTC" },
        { label: "London", value: "Europe/London" },
        { label: "Singapore", value: "Asia/Singapore" },
      ],
    },
    components: {
      graphics: { Logo: "@/cms/admin/brand#LoginLogo", Icon: "@/cms/admin/brand#NavIcon" },
      Nav: "@/cms/admin/nav/Nav#Nav",
      providers: [
        "@/cms/admin/upload/UploadProgressProvider#UploadProgressProvider",
        "@/cms/admin/drawers/ListDrawerProvider#ListDrawerProvider",
        "@/cms/admin/tour/AdminTour#AdminTour",
      ],
      views: {
        dashboard: { Component: "@/cms/admin/dashboard/Dashboard#Dashboard" },
        analytics: { Component: "@/cms/admin/analytics/AnalyticsView#AnalyticsView", path: "/analytics", exact: true },
      },
    },
  },
  collections: [Stories, Videos, Media, Categories, Tags, Authors, Pages, FormSubmissions, Users, AuditEvents, AnalyticsEvents],
  globals: [Homepage, Navigation, SiteSettings],
  editor: articleEditor,
  db: postgresAdapter({
    pool: databasePool(),
    migrationDir: path.resolve(dirname, "migrations"),
    // Schema changes go through migrations (`npm run migrate:create`), never implicit pushes.
    push: env.PAYLOAD_DB_PUSH === "true",
  }),
  sharp,
  upload: {
    // Applies to uploads that pass through the server (images, or everything when no object storage is configured).
    limits: { fileSize: storage.enabled ? IMAGE_MAX_BYTES : VIDEO_MAX_BYTES },
  },
  email: env.SMTP_HOST
    ? nodemailerAdapter({
        defaultFromAddress: env.SMTP_FROM ?? "cms@gen-e.local",
        defaultFromName: "gen.E CMS",
        transportOptions: {
          host: env.SMTP_HOST,
          port: Number(env.SMTP_PORT ?? 587),
          secure: env.SMTP_SECURE === "true",
          auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
        },
      })
    : undefined,
  endpoints: [analyticsEndpoint],
  jobs: {
    tasks: [publishScheduledTask],
    access: {
      // Logged-in editors, or a cron presenting CRON_SECRET (Authorization: Bearer …).
      run: ({ req }) => {
        if (req.user && ["admin", "editor"].includes((req.user as { role?: string }).role ?? "")) return true;
        const auth = req.headers.get("authorization");
        return Boolean(env.CRON_SECRET && auth === `Bearer ${env.CRON_SECRET}`);
      },
    },
    // Long-running servers run the scheduler in-process. Disable on serverless and use the cron endpoint instead.
    autoRun: [{ cron: "* * * * *", queue: "editorial", limit: 20 }],
    shouldAutoRun: () => env.JOBS_AUTORUN !== "false",
    deleteJobOnComplete: true,
  },
  plugins: [
    seo,
    s3Storage({
      enabled: storage.enabled,
      bucket: storage.bucket,
      clientUploads: true,
      collections: {
        media: { prefix: PREFIX.media, disablePayloadAccessControl: true, generateFileURL: ({ filename, prefix }) => publicFileUrl(prefix ?? PREFIX.media, filename) },
        videos: { prefix: PREFIX.videos, disablePayloadAccessControl: true, generateFileURL: ({ filename, prefix }) => publicFileUrl(prefix ?? PREFIX.videos, filename) },
      },
      config: {
        endpoint: storage.endpoint,
        region: storage.region,
        forcePathStyle: true,
        credentials: { accessKeyId: storage.accessKeyId, secretAccessKey: storage.secretAccessKey },
      },
    }),
    progressUploads,
  ],
  typescript: { outputFile: path.resolve(dirname, "payload-types.ts") },
  graphQL: { disablePlaygroundInProduction: true },
  telemetry: false,
});
