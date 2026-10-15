#!/usr/bin/env node
/**
 * End-to-end editorial workflow against a running Gen E server, over the same HTTP API
 * the admin UI uses (real logins per role, real direct-to-storage upload).
 *
 *   node --env-file=.env.local tests/e2e/editorial-workflow.mjs [baseUrl]
 *
 * Needs the SEED_* test accounts (see .env.example) and a running server. Creates its own
 * category, author, video and story, and removes them at the end.
 */
import fs from "node:fs";
import path from "node:path";

const BASE = process.argv[2] ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const RUN = Date.now().toString(36);
const results = [];
let failed = false;

function check(name, ok, detail = "") {
  results.push(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed = true;
  console.log(results.at(-1));
}

async function login(email, password) {
  const res = await fetch(`${BASE}/api/users/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Login failed for ${email}: ${JSON.stringify(body)}`);
  return body.token;
}

const api = (token) => async (method, url, body, extraHeaders = {}) => {
  const headers = { ...(token ? { Authorization: `JWT ${token}` } : {}), ...extraHeaders };
  let payload = body;
  if (body && !(body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${url}`, { method, headers, body: payload, redirect: "manual" });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, body: json, headers: res.headers };
};

// Behaves like a browser navigation: Payload only accepts the session cookie when the
// request carries browser fetch metadata (CSRF protection), so send Sec-Fetch-Site.
const page = async (url, token) => {
  const headers = token ? { Cookie: `payload-token=${token}`, "Sec-Fetch-Site": "same-origin" } : {};
  const res = await fetch(`${BASE}${url}`, { headers, redirect: "manual" });
  return { status: res.status, html: await res.text(), location: res.headers.get("location") };
};

const content = (...paras) => ({
  root: {
    type: "root",
    version: 1,
    direction: "ltr",
    format: "",
    indent: 0,
    children: paras.map((t) => ({
      type: "paragraph",
      version: 1,
      direction: "ltr",
      format: "",
      indent: 0,
      textFormat: 0,
      children: [{ type: "text", text: t, format: 0, detail: 0, mode: "normal", style: "", version: 1 }],
    })),
  },
});

const env = process.env;
const [adminT, editorT, authorT] = await Promise.all([
  login(env.SEED_ADMIN_EMAIL, env.SEED_ADMIN_PASSWORD),
  login(env.SEED_EDITOR_EMAIL, env.SEED_EDITOR_PASSWORD),
  login(env.SEED_AUTHOR_EMAIL, env.SEED_AUTHOR_PASSWORD),
]);
const admin = api(adminT);
const editor = api(editorT);
const author = api(authorT);
const anon = api(null);
check("1. Administrator, editor and author log in", true);

// 2–3. Admin creates an author profile and a category
const byline = await admin("POST", "/api/authors", { name: `E2E Reporter ${RUN}`, jobTitle: "Correspondent", active: true });
check("2. Administrator creates an author", byline.status === 201, `status ${byline.status}`);
const category = await admin("POST", "/api/categories", { name: `E2E Desk ${RUN}`, description: "Test desk", enabled: true });
check("3. Administrator creates a category", category.status === 201, `status ${category.status}`);
const categoryDoc = category.body.doc;

// 5. Author uploads a video straight to storage (presigned PUT), then registers it
const videoDir = path.resolve("public/media/video");
const smallest = fs.readdirSync(videoDir).filter((f) => f.endsWith(".mp4")).map((f) => ({ f, size: fs.statSync(path.join(videoDir, f)).size })).sort((a, b) => a.size - b.size)[0];
const filename = `e2e-${RUN}.mp4`;
const sign = await author("POST", "/api/storage-s3-generate-signed-url", { collectionSlug: "videos", filename, filesize: smallest.size, mimeType: "video/mp4" });
check("5a. Author gets a presigned upload URL", sign.status === 200 && typeof sign.body.url === "string", `status ${sign.status}`);
const put = await fetch(sign.body.url, { method: "PUT", body: fs.readFileSync(path.join(videoDir, smallest.f)), headers: sign.body.headers ?? {} });
check("5b. Video uploads directly to Bunny Storage (not through Next.js)", put.ok, `PUT ${put.status}, ${(smallest.size / 1e6).toFixed(1)} MB`);
const form = new FormData();
form.append("_payload", JSON.stringify({ title: `E2E film ${RUN}`, duration: 42.5, width: 720, height: 1280 }));
form.append("file", JSON.stringify({ clientUploadContext: sign.body.clientUploadContext, filename: sign.body.filename ?? filename, mimeType: "video/mp4", size: smallest.size }));
const video = await author("POST", "/api/videos", form);
check("5c. Video record created with metadata, status ready", video.status === 201 && video.body.doc?.status === "ready", `status ${video.status} ${video.body.doc?.status ?? JSON.stringify(video.body).slice(0, 200)}`);
const videoDoc = video.body.doc;
const cdnHead = videoDoc?.url ? await fetch(videoDoc.url, { method: "HEAD" }) : null;
check("5d. Video is served from the CDN", cdnHead?.ok === true, videoDoc?.url);

// Spoofed file: an image renamed .mp4 must be rejected by the signature check
const fakeName = `fake-${RUN}.mp4`;
const fakeBytes = fs.readFileSync(path.resolve("public/cms-icon.svg"));
const fakeSign = await author("POST", "/api/storage-s3-generate-signed-url", { collectionSlug: "videos", filename: fakeName, filesize: fakeBytes.length, mimeType: "video/mp4" });
await fetch(fakeSign.body.url, { method: "PUT", body: fakeBytes, headers: fakeSign.body.headers ?? {} });
const fakeForm = new FormData();
fakeForm.append("_payload", JSON.stringify({ title: "fake" }));
fakeForm.append("file", JSON.stringify({ clientUploadContext: fakeSign.body.clientUploadContext, filename: fakeSign.body.filename ?? fakeName, mimeType: "video/mp4", size: fakeBytes.length }));
const fake = await author("POST", "/api/videos", fakeForm);
check("5e. A non-video file renamed .mp4 is rejected", fake.status >= 400, `status ${fake.status}`);

// Thumbnail through the server (images are resized there)
const posterForm = new FormData();
posterForm.append("_payload", JSON.stringify({ alt: "E2E poster" }));
posterForm.append("file", new Blob([fs.readFileSync(path.resolve("public/media/posters", fs.readdirSync("public/media/posters")[0]))], { type: "image/jpeg" }), `e2e-poster-${RUN}.jpg`);
const poster = await author("POST", "/api/media", posterForm);
check("5f. Author uploads a thumbnail", poster.status === 201, `status ${poster.status}`);
await author("PATCH", `/api/videos/${videoDoc?.id}`, { poster: poster.body.doc?.id });

// 4, 6, 7. Author creates the story, writes the article, saves a draft
const title = `E2E story ${RUN}`;
const story = await author("POST", "/api/stories?draft=true", {
  title,
  excerpt: "An end-to-end test of the Gen E editorial workflow.",
  category: categoryDoc.id,
  author: byline.body.doc.id,
  video: videoDoc?.id,
  content: content(`Unique marker zebrafinch${RUN}.`, "Second paragraph of reporting."),
});
check("4/6/7. Author creates a story with video and article, saved as draft", story.status === 201 && story.body.doc?._status === "draft", `status ${story.status}`);
const id = story.body.doc.id;
const slug = story.body.doc.slug;

const notPublic = await page(`/stories/${slug}`);
check("   Draft is not public", notPublic.status === 404, `status ${notPublic.status}`);

// 19. Author cannot publish
const authorPublish = await author("PATCH", `/api/stories/${id}`, { _status: "published" });
check("19. Author cannot publish", authorPublish.status === 403, `status ${authorPublish.status}`);

const submit = await author("POST", `/api/stories/${id}/workflow`, { action: "submit" });
check("   Author submits for review", submit.status === 200, `status ${submit.status} ${submit.body.message ?? ""}`);

// 8. Editor previews
const preview = await page(`/preview/stories/${id}`, editorT);
check("8. Editor previews the draft", preview.status === 200 && preview.html.includes(title), `status ${preview.status}`);
const anonPreview = await page(`/preview/stories/${id}`);
check("   Preview requires sign-in", anonPreview.status === 307 && anonPreview.location?.includes("/admin/login"), `status ${anonPreview.status}`);

// 9. Editor publishes
const pub = await editor("PATCH", `/api/stories/${id}`, { _status: "published" });
check("9. Editor publishes", pub.status === 200 && pub.body.doc?.workflowStatus === "published", `status ${pub.status}`);

// 10–13. Story appears everywhere
const home = await page("/");
check("10. Story appears in the public mobile feed", home.html.includes(title));
const article = await page(`/stories/${slug}`);
check("11. Read Full Story opens the right article", article.status === 200 && article.html.includes(`zebrafinch${RUN}`), `status ${article.status}`);
const catPage = await page(`/category/${categoryDoc.slug}`);
check("12. Category page lists the story", catPage.status === 200 && catPage.html.includes(title), `status ${catPage.status}`);
const search = await anon("GET", `/api/search?q=${encodeURIComponent(`E2E story ${RUN}`)}`);
check("13. Search finds the story", search.body.results?.some((r) => r.slug === slug), `${search.body.total} results`);

// 14–15. Edit and republish
const newTitle = `E2E story ${RUN} updated`;
await editor("PATCH", `/api/stories/${id}?draft=true`, { title: newTitle });
const beforeRepublish = await page(`/stories/${slug}`);
check("   Saving a draft does not change the live article", beforeRepublish.html.includes(title) && !beforeRepublish.html.includes(newTitle));
const republish = await editor("PATCH", `/api/stories/${id}`, { _status: "published" });
const afterRepublish = await page(`/stories/${slug}`);
check("14/15. Editor republishes; the update is live immediately", republish.status === 200 && afterRepublish.html.includes(newTitle));

// 16–18. Unpublish
const unpub = await editor("PATCH", `/api/stories/${id}`, { _status: "draft" });
check("16. Editor unpublishes", unpub.status === 200, `status ${unpub.status}`);
const goneHome = await page("/");
const goneArticle = await page(`/stories/${slug}`);
const goneSearch = await anon("GET", `/api/search?q=${encodeURIComponent(newTitle)}`);
const goneCategory = await page(`/category/${categoryDoc.slug}`);
check("17. Story disappears from feed, category page and search", !goneHome.html.includes(newTitle) && !goneCategory.html.includes(newTitle) && !goneSearch.body.results?.some((r) => r.slug === slug));
const directApi = await anon("GET", `/api/stories/${id}`);
check("18. Direct public access is denied (page and API)", goneArticle.status === 404 && directApi.status >= 400, `page ${goneArticle.status}, api ${directApi.status}`);

// 20. Scheduled publishing, executed by the scheduler (not by this script)
const sched = await editor("POST", `/api/stories/${id}/workflow`, { action: "schedule", scheduledFor: new Date(Date.now() + 65_000).toISOString() });
check("20a. Editor schedules publication ~1 minute ahead", sched.status === 200, `status ${sched.status} ${sched.body.message ?? ""}`);
const deadline = Date.now() + 4 * 60_000;
let live = false;
while (Date.now() < deadline) {
  await new Promise((r) => setTimeout(r, 10_000));
  const res = await page(`/stories/${slug}`);
  if (res.status === 200) {
    live = true;
    break;
  }
}
check("20b. Scheduler publishes it without anyone signed in", live, live ? "went live" : "not live after 4 minutes");

// Cleanup
await admin("PATCH", `/api/stories/${id}`, { _status: "draft" });
const del = await admin("DELETE", `/api/stories/${id}`);
const delPerm = await admin("DELETE", `/api/stories?where[id][equals]=${id}&trash=true`);
await admin("DELETE", `/api/videos/${videoDoc?.id}`);
await admin("DELETE", `/api/media/${poster.body.doc?.id}`);
await admin("DELETE", `/api/categories/${categoryDoc.id}`);
await admin("DELETE", `/api/authors/${byline.body.doc.id}`);
console.log(`Cleanup: story ${del.status}/${delPerm.status}`);

console.log(`\n${results.filter((r) => r.startsWith("PASS")).length}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
