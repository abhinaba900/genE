import { NavHamburger, NavWrapper } from "@payloadcms/next/client";
import { Logout } from "@payloadcms/ui";
import Link from "next/link";
import type { Payload, SanitizedPermissions } from "payload";
import { DRAFTS_QUERY } from "../workflow/status";
import { NavClient, type NavSection } from "./NavClient";

type Props = { payload: Payload; permissions: SanitizedPermissions; user?: { role?: string; name?: string; email?: string } | null };

const list = (slug: string, query = "") => `/admin/collections/${slug}${query}`;

/**
 * Editorial sidebar. Groups the CMS by task (Content, Media, Website, Insights,
 * Administration) instead of Payload's flat collection list. Items the user cannot
 * read are left out — the server still enforces access on every request.
 */
export async function Nav({ payload, permissions, user }: Props) {
  const can = (slug: string) => Boolean(permissions?.collections?.[slug]?.read);
  const canGlobal = (slug: string) => Boolean(permissions?.globals?.[slug]?.read && permissions?.globals?.[slug]?.update);
  const role = user?.role ?? "author";
  const isEditor = role === "admin" || role === "editor";

  const [inReview, scheduled, newMessages] = isEditor
    ? await Promise.all([
        payload.count({ collection: "stories", where: { workflowStatus: { equals: "in_review" } } }).then((r) => r.totalDocs),
        payload.count({ collection: "stories", where: { workflowStatus: { equals: "scheduled" } } }).then((r) => r.totalDocs),
        payload.count({ collection: "form-submissions", where: { status: { equals: "new" } } }).then((r) => r.totalDocs),
      ]).catch(() => [0, 0, 0])
    : [0, 0, 0];

  const sections: NavSection[] = [
    { label: "Overview", items: [{ label: "Dashboard", href: "/admin", icon: "dashboard", exact: true }] },
    {
      label: "Content",
      items: [
        { label: "All stories", href: list("stories"), icon: "stories", match: { pathname: list("stories"), noQuery: "where" } },
        { label: "Create story", href: list("stories", "/create"), icon: "create", drawer: "stories" },
        { label: "Drafts", href: list("stories", `?${DRAFTS_QUERY}`), icon: "drafts", match: { param: "where[or][0][workflowStatus][in]" } },
        isEditor && { label: "Awaiting review", href: list("stories", "?where[workflowStatus][equals]=in_review"), icon: "review", badge: inReview, match: { query: "in_review" } },
        { label: "Scheduled", href: list("stories", "?where[workflowStatus][equals]=scheduled&sort=scheduledFor"), icon: "scheduled", badge: scheduled, match: { query: "scheduled" } },
        can("categories") && { label: "Categories", href: list("categories"), icon: "categories" },
        can("tags") && { label: "Tags", href: list("tags"), icon: "tags" },
        can("authors") && { label: "Authors", href: list("authors"), icon: "authors" },
      ],
    },
    {
      label: "Media",
      items: [
        can("videos") && { label: "Videos", href: list("videos"), icon: "videos" },
        can("media") && { label: "Media library", href: list("media"), icon: "media" },
      ],
    },
    {
      label: "Website",
      items: [
        canGlobal("homepage") && { label: "Homepage & feed", href: "/admin/globals/homepage", icon: "homepage" },
        isEditor && can("pages") && { label: "Pages", href: list("pages"), icon: "pages" },
        can("form-submissions") && { label: "Form submissions", href: list("form-submissions"), icon: "inbox", badge: newMessages },
        canGlobal("navigation") && { label: "Navigation", href: "/admin/globals/navigation", icon: "navigation" },
        canGlobal("site-settings") && { label: "Site settings", href: "/admin/globals/site-settings", icon: "settings" },
        { label: "View website", href: "/", icon: "external", external: true },
      ],
    },
    { label: "Insights", items: [isEditor && { label: "Content analytics", href: "/admin/analytics", icon: "analytics" }] },
    {
      label: "Administration",
      items: [
        role === "admin" && { label: "Team members", href: list("users"), icon: "team" },
        isEditor && { label: "Activity log", href: list("audit-events"), icon: "activity" },
        { label: "My profile", href: "/admin/account", icon: "profile" },
      ],
    },
  ]
    .map((s) => ({ ...s, items: s.items.filter(Boolean) as NavSection["items"] }))
    .filter((s) => s.items.length > 0);

  return (
    <NavWrapper baseClass="nav">
      <nav className="nav__wrap gene-nav" aria-label="CMS">
        <Link href="/admin" className="gene-nav__brand" prefetch={false}>
          {/* eslint-disable-next-line @next/next/no-img-element -- static brand mark */}
          <img src="/brand/gen-e-mark.png" alt="" width={34} height={34} />
          <span>
            <strong>gen.E</strong>
            <small>Editorial CMS</small>
          </span>
        </Link>
        <NavClient sections={sections} />
        <div className="nav__controls gene-nav__user">
          <span className="gene-avatar" aria-hidden>
            {initials(user?.name || user?.email)}
          </span>
          <span className="gene-nav__user-text">
            <strong>{user?.name || user?.email || "Signed in"}</strong>
            <small>{ROLE_LABEL[role] ?? role}</small>
          </span>
          <Logout />
        </div>
      </nav>
      <div className="nav__header">
        <div className="nav__header-content">
          <NavHamburger baseClass="nav" />
        </div>
      </div>
    </NavWrapper>
  );
}

const ROLE_LABEL: Record<string, string> = { admin: "Administrator", editor: "Editor", author: "Author" };

function initials(name?: string) {
  const parts = (name ?? "").replace(/\(.*?\)|@.*/g, "").trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : parts[0]?.slice(0, 2) ?? "?").toUpperCase();
}
