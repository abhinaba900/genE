import type { Category, NavLink } from "@/lib/content/types";

/** Serializable navigation data passed from server to client navigation components. */
export interface NavData {
  primary: NavLink[];
  secondary: NavLink[];
  legal: NavLink[];
  categories: Pick<Category, "slug" | "name">[];
  tagline: string;
  footer: { text?: string; copyright?: string; socials: { platform: string; url: string }[] };
  /** A few popular stories for quick access in search. */
  trending: { slug: string; title: string; category: string; poster: string }[];
}
