import { APIError, type CollectionConfig } from "payload";
import { ROLES, hasRole, isAdmin, isAdminField, staffUser } from "../access";

/**
 * CMS accounts (team members). Deliberately separate from public author profiles:
 * an author byline does not need a login, and a login does not imply a byline.
 */
export const Users: CollectionConfig = {
  slug: "users",
  labels: { singular: "Team member", plural: "Team members" },
  auth: {
    // Login rate limiting: lock the account for 15 minutes after 5 failed attempts.
    maxLoginAttempts: 5,
    lockTime: 15 * 60 * 1000,
    tokenExpiration: 60 * 60 * 8,
    cookies: { sameSite: "Lax", secure: process.env.NODE_ENV === "production" },
    useSessions: true,
  },
  admin: {
    useAsTitle: "name",
    defaultColumns: ["name", "email", "role", "authorProfile", "updatedAt"],
    group: "Administration",
    description: "People who can sign in to the gen.E CMS. Public bylines are managed under Authors.",
  },
  access: {
    // Editors see the team (to know who wrote what); authors see only their own account.
    read: ({ req }) => {
      const user = staffUser(req);
      if (!user) return false;
      if (user.role === "admin" || user.role === "editor") return true;
      return { id: { equals: user.id } };
    },
    create: isAdmin,
    update: ({ req }) => {
      const user = staffUser(req);
      if (!user) return false;
      if (user.role === "admin") return true;
      return { id: { equals: user.id } };
    },
    delete: ({ req }) => {
      const user = staffUser(req);
      if (user?.role !== "admin") return false;
      return { id: { not_equals: user.id } };
    },
    // Any team member may sign in to the admin panel.
    admin: ({ req }) => Boolean(staffUser(req)),
  },
  fields: [
    { name: "name", type: "text", required: true },
    {
      name: "role",
      type: "select",
      required: true,
      defaultValue: "author",
      saveToJWT: true,
      options: [
        { label: "Administrator", value: "admin" },
        { label: "Editor", value: "editor" },
        { label: "Author", value: "author" },
      ],
      access: { create: isAdminField, update: isAdminField },
      admin: {
        position: "sidebar",
        description: "Administrators manage everything. Editors review and publish. Authors write and submit for review.",
      },
    },
    {
      name: "authorProfile",
      type: "relationship",
      relationTo: "authors",
      admin: {
        position: "sidebar",
        description: "Optional. Pre-selects this byline when the person creates a story.",
      },
    },
  ],
  hooks: {
    beforeChange: [
      async ({ data, operation, req, originalDoc }) => {
        // The very first account is always an administrator.
        if (operation === "create") {
          const { totalDocs } = await req.payload.count({ collection: "users", overrideAccess: true, req });
          if (totalDocs === 0) data.role = "admin";
        }
        // Never demote the last administrator.
        if (operation === "update" && originalDoc?.role === "admin" && data.role && data.role !== "admin") {
          const { totalDocs } = await req.payload.count({
            collection: "users",
            where: { role: { equals: "admin" } },
            overrideAccess: true,
            req,
          });
          if (totalDocs <= 1) throw new APIError("gen.E needs at least one administrator.", 400, undefined, true);
        }
        if (data.role && !ROLES.includes(data.role)) throw new APIError("Unknown role.", 400, undefined, true);
        return data;
      },
    ],
    beforeDelete: [
      async ({ id, req }) => {
        const target = await req.payload.findByID({ collection: "users", id, overrideAccess: true, req, depth: 0 });
        if (target?.role !== "admin" || !hasRole(req, "admin")) return;
        const { totalDocs } = await req.payload.count({
          collection: "users",
          where: { role: { equals: "admin" } },
          overrideAccess: true,
          req,
        });
        if (totalDocs <= 1) throw new APIError("You can't delete the last administrator.", 400, undefined, true);
      },
    ],
  },
  timestamps: true,
};
