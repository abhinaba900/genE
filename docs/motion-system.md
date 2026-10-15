# gen.E motion system

Balanced, editorial motion with almost no runtime cost: **CSS** for entrances, scroll reveals and hovers, with one shared IntersectionObserver to trigger reveals. **Motion for React** (`motion@14`) is used only inside the lazily loaded menu drawer, search sheet and search results. **Lenis** (`lenis@1.3`) adds smooth page scrolling and is downloaded only on mouse/trackpad devices.

## Why no GSAP

GSAP and ScrollTrigger aren't installed. Nothing on the site needs what they add: there are no pinned scenes or scrubbed timelines worth having on a news site, and the image-mask reveal is a plain CSS clip-path transition. Adding GSAP would mean a second animation runtime in the bundle with no gain, so no element is animated by both.

## Pieces

| Piece | Where | What it does |
| --- | --- | --- |
| `.enter` / `[--step:n]` | `globals.css` | Fade plus a 20px lift, sequenced in 80ms steps. Used for page openers, so above-the-fold text never waits for hydration and stays visible without JS. |
| `.enter-media` + `.enter-settle` | `globals.css` | Bottom-up clip-path wipe (850ms) and a 1.06 → 1 image settle for hero media. Set the corner radius with `[--wipe-radius:22px]`. |
| `.enter-band` | `globals.css` | Top-down wipe for the pastel category masthead. |
| `player-in` keyframe | `globals.css` | 0.97 → 1 fade/scale for the framed desktop `/watch` player. |
| `Reveal` | `components/motion/Reveal.tsx` + `reveal-observer.ts` | Fade-lift when a block is genuinely in view: its top has passed ~78% of the way down the screen. Server HTML is visible and plays a first-paint entrance; after hydration, only items still below the fold are set to `data-reveal-state="pending"` (hidden) and flip to `"shown"` on scroll. If an item can't climb that far, it plays when the reader reaches the end of the page. `index` staggers siblings (capped at 4 steps); pass `i % columns` for row-by-row grids. |
| `ImageReveal` | `components/motion/ImageReveal.tsx` | Same model: a wipe and settle for one lead image per page (`StoryCard reveal`). |
| `SmoothScroll` | `components/motion/SmoothScroll.tsx` | Lenis smooth wheel/trackpad scrolling (`lerp 0.1`). Mouse and trackpad only, never touch; off for reduced motion; reacts if either setting changes. Pauses while the drawer or search sheet is open, settles instantly on route change, and leaves anchors native so the skip link still moves focus. The reel feed, drawer and search sheet opt out with `data-lenis-prevent`. |
| Tokens | `components/motion/tokens.ts` and the `--motion-*` vars | Ease `cubic-bezier(0.22, 1, 0.36, 1)`, text 550–600ms, media 850ms, stagger 70–80ms, rise 20px. |

Rules of thumb:
- Page openers use `.enter`; anything below the fold uses `Reveal`.
- Use one `ImageReveal` per page.
- Leave body copy still.
- Never hide content in the server HTML. Reveals start visible, and JS only hides what's off screen, so FCP/LCP never wait for hydration and no-JS visitors see everything.
- Reveals are independent, so nesting one inside another is fine.
- The clip lives on an inner layer because IntersectionObserver honours a target's own `clip-path`: a fully clipped element never counts as in view.

Hover feedback is CSS only. Tailwind's `hover:` applies only on hover-capable pointers, `group-focus-within:` mirrors every hover state for keyboard users, and `active:scale` gives tap feedback on touch.

## Reduced motion

`prefers-reduced-motion: reduce` affects all three layers:
- **CSS:** the global rule collapses animation durations and delays, so everything renders in its final state immediately.
- **Reveals:** the same rule makes their transitions instant, so revealed content simply appears.
- **Drawer and search sheet:** Motion's own reduced-motion handling applies inside them.

Smooth scrolling (Lenis) is switched off entirely. Existing behaviour is unchanged: no autoplay, and no hover previews.

## Route inventory

All routes were checked in the browser at 1440px. `/`, `/latest`, `/categories` and one story page were also checked at 375px, and `/` at 768px.

| URL | Source | Motion |
| --- | --- | --- |
| `/` | `app/(frontend)/page.tsx` → `components/home/HomeView.tsx` | **Desktop:** hero sequence (eyebrow → headline → standfirst → byline → CTAs) with a wipe and settle on the featured reel; Today's reels staggered; lead story `ImageReveal`; panels two per row; sidebar fade; topic tiles by row. **Mobile:** reel feed, unchanged. |
| `/latest` | `app/(frontend)/latest/page.tsx` | Header sequence; each row reveals on its own (no queued delays across 19 rows); row thumbnail zoom and headline underline on hover or focus. |
| `/categories` | `app/(frontend)/categories/page.tsx` + `CategoryTiles` | Header sequence; tiles by row; the poster fan opens on hover or focus; arrow chip fills; pastel wash; "Stories coming soon" for empty topics. |
| `/category/[slug]` (environment, waste-and-recycling, innovation, cities-and-living, energy, mobility, food-and-farming, society) | `app/(frontend)/category/[slug]/page.tsx` (one shared template) | **Desktop:** masthead band wipe; title, description and CTA sequence; lead `ImageReveal`; panels two per row; calm sidebar fade. **Mobile:** reel feed. |
| `/stories/[slug]` (19 stories) | `stories/[slug]/page.tsx` → `StoryArticle` | Header sequence; film wipe (no scale, since it may be playing); existing reading-progress bar; images and pull quotes reveal; paragraphs stay still; related reels staggered. |
| `/watch`, `/watch/[category]` | `components/feed/VideoFeed.tsx` | Framed desktop player fades and scales in. Playback, keyboard, captions and the per-story backdrop crossfade are unchanged. |
| `/search` | `search/page.tsx` + `SearchInterface` | Label and field entrance; the field underline thickens on focus; result rows keyed by story, so only new results lift in on each query. |
| `/about` (feature template) | `[...slug]/page.tsx` → `PageView` | Header sequence; sections reveal one by one. |
| `/contact` (contact template) | `PageView` + `ContactForm` | Header and form entrance; the input rule thickens on focus; errors fade in; the form-level error rises. |
| `/privacy`, `/terms`, `/dummy` (standard template) | `PageView` | One quiet 8px header fade, and nothing else, for readability. |
| `/preview/*` | CMS previews | Use the same components, so they get the same motion. |
| `/admin`, `/api/*`, `sitemap.xml`, `robots.txt` | Payload / generated | Untouched. |

## Checks (15 Oct 2026)

- **Automated:** `npm run typecheck`, `npm run build` and `npm test` (34/34) all pass.
- **Page metrics:** CLS 0 before and after; no long tasks.

## Performance (Lighthouse 13.5, production build, 15 Oct 2026)

Medians of 3 mobile runs (simulated slow 4G, 4× CPU) and 1 desktop run, across `/`, `/latest`, `/categories`, `/category/environment`, a story, `/watch` and `/about`.

| | Before | After |
| --- | --- | --- |
| Mobile performance | 81–90 | 86–94 |
| Mobile FCP | 1.07–1.09 s | 0.91 s |
| Mobile LCP | 3.7–4.3 s | 3.2–4.2 s |
| Mobile TBT | 38–101 ms | 42–56 ms |
| CLS (mobile feed pages) | 0.12–0.13 | 0 |
| Desktop performance | 99–100 | 98–100 |
| Accessibility | 94–100 | 100 |
| Best practices | 96–100 | 100 |
| SEO | 100 | 100 |

What changed:
- **Client hints scoped to `/admin`** (`next.config.ts`). `withPayload` sent `Critical-CH` on every route, which makes browsers re-request each page (Lighthouse's ~600 ms "redirect").
- **Reveals no longer hide server HTML** and use CSS instead of a JS animation runtime.
- **Motion and the menu/search UI are lazy chunks**, loaded on intent (hover, focus, touch) or on idle. Lenis is dynamically imported.
- **Reel overlay is CLS-free:** its compact mode uses opacity and transforms only.
- **LCP images load eagerly:** the first rows on `/latest`, the first topic tiles, and the About strip. The article poster is preloaded, and the media CDN is preconnected.
- **Contrast fixes:** low-opacity text raised to WCAG AA. About's pillar headings are now in sequence.

Remaining mobile LCP: in-browser LCP is 0.2–0.3 s. The simulated 3–4 s comes from Lighthouse's throttled model, which counts the shared React/Next.js runtime (about 70 + 45 KB compressed) and the two web fonts that load before first paint. To push it further you'd need fewer fonts, or field data (CrUX) showing real-world LCP is already fine.
