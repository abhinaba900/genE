import { APIError, type CollectionConfig, type PayloadRequest } from "payload";
import { isEditor, isStaff, staffUser } from "../access";
import { preventDeleteIfReferenced, revalidateOnChange } from "../hooks";
import { TAGS } from "../revalidate";
import { VIDEO_MAX_BYTES, deleteStoredObject, readStoredObjectHead } from "../storage";

const revalidation = revalidateOnChange(TAGS.stories);

export const VIDEO_TYPES: Record<string, string[]> = {
  mp4: ["video/mp4"],
  m4v: ["video/mp4", "video/x-m4v"],
  mov: ["video/quicktime"],
  webm: ["video/webm"],
};

/**
 * Story films. The file itself lives in object storage; this collection stores its
 * metadata and the URLs used for playback.
 *
 *  url          — the original uploaded file (source), served from the CDN
 *  playbackUrl  — optional adaptive stream (e.g. HLS from Bunny Stream). When empty, the
 *                 source file is played directly (fine for short, web-encoded MP4s).
 *
 * No MIME allow-list is set on purpose: with one, Payload downloads every
 * client-uploaded file back to the server to sniff it. Instead `verifyVideoFile`
 * checks extension, declared type, size and the file's real signature (first 64 bytes).
 */
export const Videos: CollectionConfig = {
  slug: "videos",
  labels: { singular: "Video", plural: "Videos" },
  admin: {
    group: "Media",
    useAsTitle: "title",
    defaultColumns: ["title", "status", "duration", "orientation", "filesize", "updatedAt"],
    listSearchableFields: ["title", "filename"],
    description: "Vertical 9:16 MP4 (H.264 + AAC) plays best. Other shapes are supported and letterboxed in the feed.",
  },
  access: {
    read: () => true,
    create: isStaff,
    update: ({ req }) => {
      const user = staffUser(req);
      if (!user) return false;
      if (user.role === "admin" || user.role === "editor") return true;
      return { uploadedBy: { equals: user.id } };
    },
    delete: isEditor,
  },
  upload: {
    adminThumbnail: ({ doc }) => (doc.posterUrl as string | undefined) ?? null,
    // Lets the admin file picker show video files first; the hook below is the real check.
    displayPreview: true,
  },
  fields: [
    {
      name: "title",
      type: "text",
      required: true,
      label: "Video title",
      admin: { components: { Cell: "@/cms/admin/fields/StoryTitleCell#StoryTitleCell" } },
    },
    { name: "description", type: "textarea", label: "Video description", maxLength: 1000 },
    {
      name: "metadata",
      type: "ui",
      admin: { components: { Field: "@/cms/admin/fields/VideoMetadata#VideoMetadata" } },
    },
    {
      name: "poster",
      type: "upload",
      relationTo: "media",
      label: "Thumbnail / poster",
      filterOptions: { mimeType: { contains: "image" } },
      admin: { description: "Shown before playback and on cards. Use a 9:16 frame for vertical films." },
    },
    {
      name: "captions",
      type: "upload",
      relationTo: "media",
      label: "Captions (WebVTT)",
      filterOptions: { mimeType: { equals: "text/vtt" } },
      admin: { description: "Optional .vtt subtitle file." },
    },
    {
      name: "startMuted",
      type: "checkbox",
      defaultValue: true,
      label: "Start muted",
      admin: { description: "Feed videos always start muted (browsers require it for autoplay). This applies to the article player." },
    },
    {
      type: "collapsible",
      label: "Delivery",
      admin: { initCollapsed: true },
      fields: [
        {
          name: "playbackUrl",
          type: "text",
          label: "Streaming URL (optional)",
          admin: { description: "HLS (.m3u8) URL from a streaming service such as Bunny Stream. Leave empty to play the uploaded file." },
          validate: (value: unknown) => (!value || /^https:\/\//.test(String(value)) ? true : "Must be an https:// URL"),
        },
        {
          name: "posterUrl",
          type: "text",
          admin: { readOnly: true, description: "Resolved thumbnail URL (set automatically)." },
        },
      ],
    },
    // ── Sidebar: technical metadata, filled in automatically ──
    {
      name: "status",
      type: "select",
      defaultValue: "pending",
      index: true,
      options: [
        { label: "Waiting for upload", value: "pending" },
        { label: "Processing", value: "processing" },
        { label: "Ready", value: "ready" },
        { label: "Error", value: "error" },
      ],
      admin: { position: "sidebar", readOnly: true },
    },
    { name: "errorMessage", type: "text", admin: { position: "sidebar", readOnly: true, condition: (d) => d?.status === "error" } },
    {
      type: "row",
      admin: { position: "sidebar" },
      fields: [
        { name: "width", type: "number", admin: { readOnly: true, width: "50%" } },
        { name: "height", type: "number", admin: { readOnly: true, width: "50%" } },
      ],
    },
    { name: "duration", type: "number", label: "Duration (seconds)", admin: { position: "sidebar", readOnly: true, step: 0.1 } },
    {
      name: "orientation",
      type: "select",
      options: [
        { label: "Vertical", value: "vertical" },
        { label: "Horizontal", value: "horizontal" },
        { label: "Square", value: "square" },
      ],
      admin: { position: "sidebar", readOnly: true },
    },
    {
      name: "uploadedBy",
      type: "relationship",
      relationTo: "users",
      admin: { position: "sidebar", readOnly: true },
      access: { update: () => false },
    },
    {
      name: "usedIn",
      type: "join",
      collection: "stories",
      on: "video",
      label: "Used in stories",
      admin: { defaultColumns: ["title", "workflowStatus"] },
    },
  ],
  hooks: {
    beforeChange: [verifyVideoFile, deriveVideoState, setPosterUrl],
    beforeDelete: [preventDeleteIfReferenced([{ collection: "stories", field: "video", label: "stories" }])],
    afterChange: [revalidation.afterChange],
    afterDelete: [revalidation.afterDelete],
  },
};

const MAGIC = {
  isoBmff: (b: Buffer) => b.length >= 12 && b.toString("ascii", 4, 8) === "ftyp",
  webm: (b: Buffer) => b.length >= 4 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3,
};

async function verifyVideoFile({ data, req, operation }: { data: Record<string, any>; req: PayloadRequest; operation: string }) {
  const file = req.file;
  if (!file) {
    if (operation === "create" && !data.filename) throw new APIError("Choose a video file to upload.", 400, undefined, true);
    return data;
  }
  const name = String(file.name ?? data.filename ?? "");
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const allowed = VIDEO_TYPES[ext];
  const ctx = (file as { clientUploadContext?: { prefix?: string; _objectKey?: string } }).clientUploadContext;
  const storedKey = ctx ? `${[ctx.prefix, ctx._objectKey].filter(Boolean).join("/")}/${name}` : null;
  const fail = async (message: string): Promise<never> => {
    // A rejected direct upload is already in storage — remove it.
    if (storedKey) await deleteStoredObject(storedKey);
    throw new APIError(message, 400, undefined, true);
  };
  if (!allowed) await fail(`“${name}” isn't a supported video. Upload MP4, M4V, MOV or WebM.`);
  if (file.mimetype && !allowed.includes(file.mimetype)) await fail(`The file type (${file.mimetype}) doesn't match its .${ext} extension.`);
  const size = file.size ?? data.filesize ?? 0;
  if (size > VIDEO_MAX_BYTES) await fail(`Videos can be at most ${Math.round(VIDEO_MAX_BYTES / 1024 / 1024)} MB.`);

  // Real content check: from the buffer (server upload) or the first bytes in storage (direct upload).
  let head: Buffer | null = file.data?.length ? file.data.subarray(0, 64) : null;
  if (!head && storedKey) {
    head = await readStoredObjectHead(storedKey);
    // Fail closed: a direct upload we can't read back is not accepted.
    if (!head) await fail("The uploaded file couldn't be verified. Please upload it again.");
  }
  if (head) {
    const ok = ext === "webm" ? MAGIC.webm(head) : MAGIC.isoBmff(head);
    if (!ok) await fail("This file doesn't look like a valid video. Re-export it as MP4 (H.264 + AAC) and try again.");
  }
  return data;
}

function deriveVideoState({ data, operation, req }: { data: Record<string, any>; operation: string; req: PayloadRequest }) {
  if (operation === "create") data.uploadedBy = staffUser(req)?.id;
  const { width, height } = data;
  if (width && height) {
    const ratio = width / height;
    data.orientation = ratio < 0.95 ? "vertical" : ratio > 1.05 ? "horizontal" : "square";
  }
  if (data.filename) {
    // Ready once the file is stored and the browser has read its metadata (duration + size).
    data.status = data.duration && width && height ? "ready" : "processing";
    data.errorMessage = null;
  }
  return data;
}

export async function resolvePosterUrl(req: PayloadRequest, poster: unknown): Promise<string | null> {
  if (!poster) return null;
  if (typeof poster === "object") return (poster as { url?: string }).url ?? null;
  const media = await req.payload.findByID({ collection: "media", id: poster as number, depth: 0, req, overrideAccess: true }).catch(() => null);
  return media?.url ?? null;
}

async function setPosterUrl({ data, req }: { data: Record<string, any>; req: PayloadRequest }) {
  if ("poster" in data) data.posterUrl = await resolvePosterUrl(req, data.poster);
  return data;
}
