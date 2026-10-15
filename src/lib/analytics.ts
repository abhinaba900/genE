"use client";

/**
 * First-party, privacy-conscious engagement events (see `cms/collections/AnalyticsEvents`).
 *
 * - No cookies. A random id lives in sessionStorage for this tab only, so repeat plays
 *   of a looping reel count once.
 * - Each (event, story) pair is sent at most once per tab session.
 * - Respects Do Not Track / Global Privacy Control, and never fires on preview pages.
 */
export type TrackEvent = "page_view" | "video_impression" | "video_start" | "video_complete";
export type Surface = "feed" | "article" | "watch" | "home" | "category" | "other";

const SID_KEY = "gene:sid";
const SENT_KEY = "gene:sent";

function optedOut() {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return nav.doNotTrack === "1" || nav.globalPrivacyControl === true || location.pathname.startsWith("/preview");
}

function session(): string | null {
  try {
    let sid = sessionStorage.getItem(SID_KEY);
    if (!sid) {
      sid = crypto.randomUUID();
      sessionStorage.setItem(SID_KEY, sid);
    }
    return sid;
  } catch {
    return null;
  }
}

function firstTime(key: string) {
  try {
    const sent = new Set<string>(JSON.parse(sessionStorage.getItem(SENT_KEY) ?? "[]"));
    if (sent.has(key)) return false;
    sent.add(key);
    sessionStorage.setItem(SENT_KEY, JSON.stringify([...sent].slice(-500)));
    return true;
  } catch {
    return false;
  }
}

export function track(type: TrackEvent, story?: string, surface: Surface = "other") {
  if (typeof window === "undefined" || optedOut()) return;
  const sid = session();
  if (!sid || !firstTime(`${type}:${story ?? location.pathname}`)) return;
  const body = JSON.stringify({ type, story, session: sid, surface, path: location.pathname });
  const blob = new Blob([body], { type: "application/json" });
  if (!navigator.sendBeacon?.("/api/events", blob)) {
    fetch("/api/events", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {});
  }
}
