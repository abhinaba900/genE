import type { Access, FieldAccess, PayloadRequest, Where } from "payload";

/**
 * Role model.
 *
 *  admin  — everything, including team members and site settings.
 *  editor — all editorial content: review, publish, unpublish, categories, tags, media, homepage.
 *  author — creates stories, edits their own, submits for review. Cannot publish.
 *
 * Every rule here runs on the server (REST, GraphQL, Local API and the admin UI all
 * go through it). Hiding a button is a convenience, never the enforcement.
 */
export const ROLES = ["admin", "editor", "author"] as const;
export type Role = (typeof ROLES)[number];

type StaffUser = { id: number | string; role?: Role | null; collection?: string };

export function staffUser(req: PayloadRequest): StaffUser | null {
  const user = req.user as StaffUser | null | undefined;
  return user && user.collection === "users" ? user : null;
}

export function hasRole(req: PayloadRequest, ...roles: Role[]): boolean {
  const user = staffUser(req);
  return Boolean(user?.role && roles.includes(user.role));
}

export const isAdmin: Access = ({ req }) => hasRole(req, "admin");
export const isEditor: Access = ({ req }) => hasRole(req, "admin", "editor");
export const isStaff: Access = ({ req }) => Boolean(staffUser(req));

export const isAdminField: FieldAccess = ({ req }) => hasRole(req, "admin");
export const isEditorField: FieldAccess = ({ req }) => hasRole(req, "admin", "editor");

/** Public visitors only ever see live, published, non-archived stories whose publish time has passed. */
export function publicStoryWhere(): Where {
  return {
    and: [
      { _status: { equals: "published" } },
      { workflowStatus: { not_equals: "archived" } },
      { publishedAt: { less_than_equal: new Date().toISOString() } },
    ],
  };
}

export const storyRead: Access = ({ req }) => (staffUser(req) ? true : publicStoryWhere());

/**
 * Authors may update only stories they created, and never into a published state.
 * Payload asks this same function with `data: { _status: "published" }` to decide
 * whether to show the Publish button, so this one rule hides it *and* enforces it.
 */
export const storyUpdate: Access = ({ req, data }) => {
  const user = staffUser(req);
  if (!user) return false;
  if (user.role === "admin" || user.role === "editor") return true;
  if (data?._status === "published") return false;
  return { createdBy: { equals: user.id } };
};

/** Authors can delete their own stories only while those stories have never been published. */
export const storyDelete: Access = ({ req }) => {
  const user = staffUser(req);
  if (!user) return false;
  if (user.role === "admin" || user.role === "editor") return true;
  const own: Where = {
    and: [{ createdBy: { equals: user.id } }, { _status: { equals: "draft" } }, { firstPublishedAt: { exists: false } }],
  };
  return own;
};

/** Pages and globals: anyone can read the published version; staff can read drafts. */
export const publishedOrStaff: Access = ({ req }) => (staffUser(req) ? true : { _status: { equals: "published" } });
