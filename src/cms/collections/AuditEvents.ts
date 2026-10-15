import type { CollectionConfig } from "payload";
import { isEditor } from "../access";
import { AUDIT_ACTIONS } from "../audit";

/** Append-only editorial activity log. Written by hooks; nobody can edit or delete entries through the API. */
export const AuditEvents: CollectionConfig = {
  slug: "audit-events",
  labels: { singular: "Activity", plural: "Activity log" },
  admin: {
    group: "Administration",
    useAsTitle: "entityTitle",
    defaultColumns: ["createdAt", "action", "entityTitle", "entityCollection", "user"],
    description: "Who changed what, and when.",
  },
  access: {
    read: isEditor,
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  defaultSort: "-createdAt",
  fields: [
    { name: "action", type: "select", required: true, index: true, options: AUDIT_ACTIONS.map((a) => ({ label: a.replace(/_/g, " "), value: a })) },
    { name: "entityCollection", type: "text", required: true, index: true, label: "Collection" },
    { name: "entityId", type: "text", required: true, index: true },
    { name: "entityTitle", type: "text", label: "Item" },
    { name: "note", type: "textarea" },
    { name: "user", type: "relationship", relationTo: "users" },
    { name: "system", type: "checkbox", admin: { description: "Performed by the scheduler or a script." } },
  ],
  timestamps: true,
};
