/**
 * One IntersectionObserver for every scroll reveal on the page.
 *
 * Reveals are server-rendered visible (with a CSS first-paint entrance), so content that's
 * on screen at load never waits for JavaScript — good for FCP/LCP and for no-JS visitors.
 * After hydration, only items that are still below the fold are hidden ("pending") and
 * then shown once their top passes the reveal line.
 */
const LINE = "0px 0px -22% 0px"; // ≈ 78% down the viewport

let io: IntersectionObserver | null = null;
const pending = new Set<Element>();

function show(el: Element) {
  el.setAttribute("data-reveal-state", "shown");
  io?.unobserve(el);
  pending.delete(el);
}

// Items in the last stretch of a short page can't climb past the line; show them at the end.
function onScroll() {
  if (window.innerHeight + window.scrollY < document.documentElement.scrollHeight - 4) return;
  for (const el of [...pending]) if (el.getBoundingClientRect().top < window.innerHeight) show(el);
}

function observer() {
  if (!io) {
    io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && show(e.target)),
      { rootMargin: LINE },
    );
    window.addEventListener("scroll", onScroll, { passive: true });
  }
  return io;
}

/** Registers a reveal element; returns its cleanup. */
export function registerReveal(el: Element) {
  const rect = el.getBoundingClientRect();
  // Already on screen (or not laid out, e.g. inside a hidden breakpoint): leave the CSS entrance alone.
  if (rect.height === 0 || rect.top < window.innerHeight) return () => {};
  el.setAttribute("data-reveal-state", "pending");
  pending.add(el);
  observer().observe(el);
  return () => {
    io?.unobserve(el);
    pending.delete(el);
  };
}
