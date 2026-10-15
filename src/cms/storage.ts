import { DeleteObjectCommand, GetObjectCommand, S3Client } from "@aws-sdk/client-s3";

/**
 * Media storage configuration.
 *
 * With BUNNY_STORAGE_* set, files live in Bunny Storage (S3-compatible API) and are
 * served from the connected pull zone (BUNNY_CDN_URL). Browsers upload straight to
 * storage with presigned URLs, so large videos never pass through the Next.js server.
 *
 * Without them (e.g. a fresh clone), uploads fall back to the local `./media` folder
 * so the CMS still works for development.
 *
 * Any other S3-compatible provider (AWS S3, Cloudflare R2, Backblaze B2…) works by
 * setting the same variables to that provider's endpoint, bucket and keys.
 */
const env = process.env;

export const storage = {
  enabled: Boolean(env.BUNNY_STORAGE_ACCESS_KEY && env.BUNNY_STORAGE_ZONE_NAME),
  bucket: env.BUNNY_STORAGE_ZONE_NAME ?? "",
  endpoint: env.BUNNY_STORAGE_ENDPOINT ?? "https://storage.bunnycdn.com",
  region: env.BUNNY_STORAGE_REGION ?? "de",
  accessKeyId: env.BUNNY_STORAGE_ZONE_NAME ?? "",
  secretAccessKey: env.BUNNY_STORAGE_ACCESS_KEY ?? "",
  /** Public origin that serves stored files (Bunny pull zone or any CDN in front of the bucket). */
  publicUrl: (env.BUNNY_CDN_URL ?? "").replace(/\/$/, ""),
};

export const PREFIX = { media: "images", videos: "videos" } as const;

export const VIDEO_MAX_BYTES = Number(env.VIDEO_MAX_MB ?? 1024) * 1024 * 1024;
export const IMAGE_MAX_BYTES = Number(env.IMAGE_MAX_MB ?? 20) * 1024 * 1024;

export function publicFileUrl(prefix: string, filename: string) {
  return `${storage.publicUrl}/${prefix}/${encodeURIComponent(filename)}`;
}

let client: S3Client | undefined;
function s3() {
  client ??= new S3Client({
    endpoint: storage.endpoint,
    region: storage.region,
    forcePathStyle: true,
    credentials: { accessKeyId: storage.accessKeyId, secretAccessKey: storage.secretAccessKey },
  });
  return client;
}

/** Read the first bytes of a stored object (used to verify a client-uploaded file's real type). */
export async function readStoredObjectHead(key: string, bytes = 64): Promise<Buffer | null> {
  if (!storage.enabled) return null;
  try {
    const res = await s3().send(new GetObjectCommand({ Bucket: storage.bucket, Key: key, Range: `bytes=0-${bytes - 1}` }));
    const body = await res.Body?.transformToByteArray();
    return body ? Buffer.from(body) : null;
  } catch {
    return null;
  }
}

/** Remove an object that was uploaded directly but then rejected, so storage doesn't collect orphans. */
export async function deleteStoredObject(key: string) {
  if (!storage.enabled) return;
  await s3()
    .send(new DeleteObjectCommand({ Bucket: storage.bucket, Key: key }))
    .catch(() => undefined);
}
