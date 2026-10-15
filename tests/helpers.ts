import fs from "node:fs";
import path from "node:path";
import config from "@payload-config";
import { createLocalReq, getPayload, type Payload, type PayloadRequest } from "payload";
import type { User } from "@/payload-types";

export async function setup() {
  const payload = await getPayload({ config });
  const make = async (role: User["role"], email: string) =>
    (await payload.find({ collection: "users", where: { email: { equals: email } }, overrideAccess: true })).docs[0] ??
    (await payload.create({ collection: "users", data: { email, password: "test-Password-1", name: `${role} test`, role }, overrideAccess: true }));

  // The first account is forced to admin, so create it first.
  const admin = await make("admin", "admin@test.local");
  const editor = await make("editor", "editor@test.local");
  const author = await make("author", "author@test.local");
  const author2 = await make("author", "author2@test.local");

  const category =
    (await payload.find({ collection: "categories", where: { slug: { equals: "test-category" } }, overrideAccess: true })).docs[0] ??
    (await payload.create({ collection: "categories", data: { name: "Test category", slug: "test-category", enabled: true }, overrideAccess: true }));
  const byline =
    (await payload.find({ collection: "authors", where: { slug: { equals: "test-author" } }, overrideAccess: true })).docs[0] ??
    (await payload.create({ collection: "authors", data: { name: "Test Author", slug: "test-author", active: true }, overrideAccess: true }));

  // A real (small) MP4 so the video passes file-signature checks.
  const videoDir = path.resolve("public/media/video");
  const smallest = fs
    .readdirSync(videoDir)
    .filter((f) => f.endsWith(".mp4"))
    .map((f) => ({ f, size: fs.statSync(path.join(videoDir, f)).size }))
    .sort((a, b) => a.size - b.size)[0].f;
  const video =
    (await payload.find({ collection: "videos", where: { title: { equals: "Test film" } }, overrideAccess: true })).docs[0] ??
    (await payload.create({
      collection: "videos",
      data: { title: "Test film", duration: 30, width: 720, height: 1280 },
      filePath: path.join(videoDir, smallest),
      overrideAccess: true,
    }));

  return { payload, admin, editor, author, author2, category, byline, video };
}

export const articleContent = (text = "A paragraph of reporting.") => ({
  root: {
    type: "root",
    version: 1,
    direction: "ltr" as const,
    format: "" as const,
    indent: 0,
    children: [
      {
        type: "paragraph",
        version: 1,
        direction: "ltr",
        format: "",
        indent: 0,
        textFormat: 0,
        children: [{ type: "text", text, format: 0, detail: 0, mode: "normal", style: "", version: 1 }],
      },
    ],
  },
});

let n = 0;
export const uniqueSlug = (base = "story") => `${base}-${Date.now().toString(36)}-${n++}`;

export async function asUser(payload: Payload, user: User | null): Promise<PayloadRequest> {
  return createLocalReq({ user: user ? ({ ...user, collection: "users" } as never) : undefined }, payload);
}

/** Call a custom endpoint handler the way Payload's router would. */
export async function callEndpoint(
  payload: Payload,
  handler: (req: PayloadRequest) => Promise<Response> | Response,
  user: User | null,
  routeParams: Record<string, string>,
  body: unknown,
) {
  const req = await asUser(payload, user);
  req.routeParams = routeParams;
  req.json = async () => body;
  const res = await handler(req);
  return { status: res.status, body: (await res.json().catch(() => ({}))) as { message?: string; status?: string } };
}
