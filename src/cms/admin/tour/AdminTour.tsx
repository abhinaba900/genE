"use client";

import { useAuth, usePreferences } from "@payloadcms/ui";
import {
  BarChart3,
  CalendarClock,
  ClipboardCheck,
  Compass,
  Film,
  Home,
  Inbox,
  LayoutTemplate,
  MousePointerClick,
  Newspaper,
  Users,
  X,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import type React from "react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/** Fired by the "Take the tour" button (and anything else that wants to replay the tour). */
export const TOUR_EVENT = "gene:tour:start";
const PREFERENCE = "gene-admin-tour";
const VERSION = 1;

type Role = "admin" | "editor" | "author";
type Step = {
  id: string;
  /** CSS selector to highlight; without one (or if it isn't on screen) the step shows centred. */
  target?: string;
  title: string;
  body: React.ReactNode;
  roles?: Role[];
  kind?: "overview" | "finish";
};

const EDITORS: Role[] = ["admin", "editor"];

const FEATURES: { icon: typeof Compass; title: string; text: string; roles?: Role[] }[] = [
  { icon: Newspaper, title: "Stories", text: "Write vertical-video stories with a headline, summary, film and full article. Everything autosaves as a draft." },
  { icon: ClipboardCheck, title: "Review & publishing", text: "Authors submit for review; editors approve, request changes, publish now or schedule for later." },
  { icon: CalendarClock, title: "Scheduling", text: "Pick a date and time and the story goes live by itself — perfect for planned coverage.", roles: EDITORS },
  { icon: Film, title: "Videos & media", text: "Upload films with posters and captions, and keep every image in one searchable library." },
  { icon: LayoutTemplate, title: "Pages & blocks", text: "Build About, Contact and legal pages from ready-made blocks — no code needed.", roles: EDITORS },
  { icon: Inbox, title: "Form submissions", text: "Messages from the website's contact forms land here, ready to read and mark as replied.", roles: EDITORS },
  { icon: Home, title: "Homepage & navigation", text: "Choose what the homepage feed shows and edit the site's menus and footer links.", roles: EDITORS },
  { icon: BarChart3, title: "Content analytics", text: "See which stories people start, finish and come back to.", roles: EDITORS },
  { icon: Users, title: "Team & activity", text: "Invite teammates with the right role and see every change in the activity log.", roles: ["admin"] },
  { icon: MousePointerClick, title: "Quick edit drawers", text: "Open any story, video or page in a side drawer without leaving the list you're on." },
];

const STEPS: Step[] = [
  { id: "overview", kind: "overview", title: "Welcome to the gen.E newsroom", body: null },
  {
    id: "sidebar",
    target: ".gene-nav__sections",
    title: "Everything, grouped by task",
    body: "The sidebar is organised by what you're doing — writing, media, the website, insights and the team. Badges show what needs attention.",
  },
  {
    id: "kpis",
    target: ".gene-kpis",
    title: "Your pipeline at a glance",
    body: "Published, drafts, stories waiting for review and the schedule. Click any card to open that filtered list.",
  },
  {
    id: "new-story",
    target: ".gene-dashboard__actions .gene-btn--primary",
    title: "Start a story",
    body: "Opens a new story in a drawer. Add a headline, summary, video and article — it saves automatically as you type.",
  },
  {
    id: "recent",
    target: ".gene-dashboard__grid > .gene-panel",
    title: "Recent stories",
    body: "Click a headline for a quick edit in a drawer. The icons on the right preview the story or open the full editor.",
  },
  {
    id: "library",
    target: ".gene-library-panel",
    title: "Quick actions",
    body: "Jump to videos, categories and authors, or use the small button on each tile to add one straight away.",
  },
  {
    id: "activity",
    target: ".gene-tabs",
    title: "What's happening",
    body: "Recent activity shows who changed what; Upcoming lists stories scheduled to go live.",
    roles: EDITORS,
  },
  {
    id: "nav-content",
    target: '[data-tour="nav-content"]',
    title: "Content",
    body: "All stories, Drafts (including unpublished edits to live stories), Awaiting review, Scheduled, plus categories, tags and author bylines.",
  },
  {
    id: "nav-media",
    target: '[data-tour="nav-media"]',
    title: "Media",
    body: "Upload films (vertical 9:16 plays best) and manage every image in the media library.",
  },
  {
    id: "nav-website",
    target: '[data-tour="nav-website"]',
    title: "Website",
    body: "Homepage & feed, information pages built from blocks, contact form submissions, menus and site settings.",
    roles: EDITORS,
  },
  {
    id: "nav-insights",
    target: '[data-tour="nav-insights"]',
    title: "Insights",
    body: "Content analytics: which stories people start, finish and engage with.",
    roles: EDITORS,
  },
  {
    id: "nav-administration",
    target: '[data-tour="nav-administration"]',
    title: "Administration",
    body: "Team members and roles, the full activity log, and your own profile.",
  },
  {
    id: "replay",
    target: '[data-tour="tour-button"]',
    title: "Take the tour again",
    body: "You can replay this tour any time from here.",
  },
  { id: "finish", kind: "finish", title: "You're all set", body: null },
];

type Rect = { top: number; left: number; width: number; height: number };
const PAD = 8;

/**
 * Guided tour of the admin. Starts by itself on a person's first visit to the dashboard
 * (remembered per user in Payload preferences, so it follows them across devices) and can
 * be replayed from the sidebar. Steps adapt to the person's role and skip anything not on screen.
 */
export function AdminTour({ children }: { children?: React.ReactNode }) {
  const { user } = useAuth<{ id: number; role?: Role; name?: string }>();
  const { getPreference, setPreference } = usePreferences();
  const pathname = usePathname();
  const router = useRouter();
  const [index, setIndex] = useState<number | null>(null);
  const checked = useRef(false);

  const role: Role = user?.role ?? "author";
  const steps = STEPS.filter((s) => !s.roles || s.roles.includes(role));
  const onDashboard = pathname === "/admin" || pathname === "/admin/";

  const start = useCallback(() => {
    if (!onDashboard) {
      // The tour points at the dashboard; go there and start once it has loaded.
      router.push("/admin?tour=1");
      return;
    }
    setIndex(0);
  }, [onDashboard, router]);

  const finish = useCallback(() => {
    setIndex(null);
    setPreference(PREFERENCE, { completed: VERSION }).catch(() => undefined);
  }, [setPreference]);

  // First visit: start automatically once per user (and again if the tour gets a new version).
  useEffect(() => {
    if (!user || !onDashboard || checked.current) return;
    checked.current = true;
    if (new URLSearchParams(window.location.search).get("tour") === "1") {
      window.history.replaceState(null, "", "/admin");
      setIndex(0);
      return;
    }
    getPreference<{ completed?: number } | undefined>(PREFERENCE)
      .then((pref) => {
        if (!pref || (pref.completed ?? 0) < VERSION) setIndex(0);
      })
      .catch(() => undefined);
  }, [user, onDashboard, getPreference]);

  useEffect(() => {
    const onStart = () => start();
    window.addEventListener(TOUR_EVENT, onStart);
    return () => window.removeEventListener(TOUR_EVENT, onStart);
  }, [start]);

  return (
    <>
      {children}
      {user && index !== null && steps[index] && (
        <TourStep
          key={steps[index].id}
          step={steps[index]}
          index={index}
          total={steps.length}
          role={role}
          name={user.name}
          onNext={() => (index + 1 < steps.length ? setIndex(index + 1) : finish())}
          onBack={() => setIndex(Math.max(0, index - 1))}
          onClose={finish}
        />
      )}
    </>
  );
}

function TourStep({
  step,
  index,
  total,
  role,
  name,
  onNext,
  onBack,
  onClose,
}: {
  step: Step;
  index: number;
  total: number;
  role: Role;
  name?: string;
  onNext: () => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const [rect, setRect] = useState<Rect | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardPos, setCardPos] = useState<{ top: number; left: number } | null>(null);
  const isModal = step.kind === "overview" || step.kind === "finish";

  // Find the target, scroll it into view, and keep the highlight aligned on resize/scroll.
  useLayoutEffect(() => {
    if (isModal || !step.target) return setRect(null);
    const el = document.querySelector<HTMLElement>(step.target);
    // Missing, hidden, or inside the sidebar while it's collapsed: show the step centred instead.
    const navClosed = (node: HTMLElement) => Boolean(node.closest(".nav")) && !document.querySelector(".template-default--nav-open");
    if (!el || el.getClientRects().length === 0 || navClosed(el)) return setRect(null);
    el.scrollIntoView({ block: "nearest", inline: "nearest" });
    const measure = () => {
      const r = el.getBoundingClientRect();
      setRect({ top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 });
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [step.target, isModal]);

  // Place the card beside the highlight: right, then left, then below, then above — always on screen.
  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card || !rect) return setCardPos(null);
    const { innerWidth: vw, innerHeight: vh } = window;
    const w = card.offsetWidth;
    const h = card.offsetHeight;
    const gap = 14;
    const clampTop = (t: number) => Math.min(Math.max(16, t), vh - h - 16);
    const clampLeft = (l: number) => Math.min(Math.max(16, l), vw - w - 16);
    if (rect.left + rect.width + gap + w < vw - 16) setCardPos({ left: rect.left + rect.width + gap, top: clampTop(rect.top) });
    else if (rect.left - gap - w > 16) setCardPos({ left: rect.left - gap - w, top: clampTop(rect.top) });
    else if (rect.top + rect.height + gap + h < vh - 16) setCardPos({ left: clampLeft(rect.left), top: rect.top + rect.height + gap });
    else setCardPos({ left: clampLeft(rect.left), top: clampTop(rect.top - gap - h) });
  }, [rect]);

  // Keyboard: Esc closes, arrows move. Focus the card so screen readers announce the step.
  useEffect(() => {
    cardRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") onNext();
      else if (e.key === "ArrowLeft" && index > 0) onBack();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onNext, onBack, index]);

  const titleId = `gene-tour-title-${step.id}`;
  const firstName = name?.replace(/\(.*?\)/g, "").trim().split(" ")[0];
  const features = FEATURES.filter((f) => !f.roles || f.roles.includes(role));

  return (
    <div className="gene-tour" role="presentation">
      {rect ? (
        <div className="gene-tour__spotlight" style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }} />
      ) : (
        <div className="gene-tour__backdrop" onClick={onClose} />
      )}

      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`gene-tour__card${isModal || !rect ? " gene-tour__card--modal" : ""}${step.kind === "overview" ? " gene-tour__card--wide" : ""}`}
        style={rect && cardPos ? { top: cardPos.top, left: cardPos.left } : rect ? { visibility: "hidden" } : undefined}
      >
        <button type="button" className="gene-tour__close" onClick={onClose} aria-label="Close tour">
          <X size={16} aria-hidden />
        </button>

        {step.kind === "overview" ? (
          <>
            <span className="gene-chip gene-chip--blue gene-tour__icon">
              <Compass size={18} aria-hidden />
            </span>
            <h2 id={titleId}>{firstName ? `Welcome, ${firstName}` : step.title}</h2>
            <p className="gene-tour__lede">
              Here's everything you can do in the gen.E CMS. Take the 2-minute tour to see where it all lives — you can replay it any time
              from <strong>Take the tour</strong> in the sidebar.
            </p>
            <ul className="gene-tour__features">
              {features.map((f) => {
                const Icon = f.icon;
                return (
                  <li key={f.title}>
                    <Icon size={16} aria-hidden />
                    <span>
                      <strong>{f.title}</strong>
                      {f.text}
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
        ) : step.kind === "finish" ? (
          <>
            <span className="gene-chip gene-chip--green gene-tour__icon">
              <ClipboardCheck size={18} aria-hidden />
            </span>
            <h2 id={titleId}>{step.title}</h2>
            <ul className="gene-tour__tips">
              <li>Everything autosaves — nothing goes live until it's published.</li>
              <li>Click a row to edit it in a drawer; Ctrl/⌘-click opens the full page.</li>
              <li>Use <strong>Preview</strong> to see a story exactly as readers will.</li>
              {role !== "author" ? <li>Schedule a story and it publishes itself at that time.</li> : <li>When a story is ready, use <strong>Submit for review</strong>.</li>}
            </ul>
          </>
        ) : (
          <>
            <h2 id={titleId}>{step.title}</h2>
            <p>{step.body}</p>
          </>
        )}

        <div className="gene-tour__footer">
          <span className="gene-tour__progress" aria-label={`Step ${index + 1} of ${total}`}>
            {Array.from({ length: total }, (_, i) => (
              <span key={i} className={i === index ? "is-active" : i < index ? "is-done" : undefined} />
            ))}
          </span>
          <span className="gene-tour__actions">
            {step.kind === "overview" ? (
              <button type="button" className="gene-btn gene-btn--ghost" onClick={onClose}>
                Skip
              </button>
            ) : (
              index > 0 && (
                <button type="button" className="gene-btn gene-btn--ghost" onClick={onBack}>
                  Back
                </button>
              )
            )}
            <button type="button" className="gene-btn gene-btn--primary" onClick={onNext}>
              {step.kind === "overview" ? "Start the tour" : step.kind === "finish" ? "Done" : "Next"}
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}
