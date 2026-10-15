import type { CollectionConfig } from "payload";
import { isAdmin } from "../access";

export const ANALYTICS_EVENTS = ["page_view", "video_impression", "video_start", "video_complete"] as const;
export type AnalyticsEventType = (typeof ANALYTICS_EVENTS)[number];

/**
 * First-party, privacy-conscious engagement events.
 *
 * No cookies, no IP addresses, no user agents are stored. `session` is a random id
 * kept in the visitor's sessionStorage (one tab, discarded when it closes) and is used
 * only to de-duplicate: each story counts at most one impression, start and completion
 * per session, however many times the reel loops.
 *
 * Events are written by `POST /api/events` and are never exposed publicly.
 */
export const AnalyticsEvents: CollectionConfig = {
  slug: "analytics-events",
  labels: { singular: "Analytics event", plural: "Analytics events" },
  admin: { hidden: true },
  access: {
    read: isAdmin,
    create: () => false,
    update: () => false,
    delete: isAdmin,
  },
  fields: [
    { name: "type", type: "select", required: true, index: true, options: [...ANALYTICS_EVENTS] },
    { name: "story", type: "relationship", relationTo: "stories", index: true },
    { name: "category", type: "relationship", relationTo: "categories", index: true },
    { name: "path", type: "text" },
    { name: "session", type: "text", required: true, index: true },
    { name: "surface", type: "select", options: ["feed", "article", "watch", "home", "category", "other"] },
  ],
  indexes: [{ fields: ["type", "story", "session"], unique: true }],
  timestamps: true,
};
