# gen.E — frontend

A video-first news platform: **Watch the story. Explore the details.**

On phones, gen.E opens straight into an immersive, vertically-swipeable reel of story films. Every film leads to a full editorial article. On larger screens the homepage becomes an editorial video magazine, and the reel is still available at `/watch` as a framed 9:16 column.

> **Content.** Stories are gen.E's own short films, imported from the official YouTube channel ([@gen.e_media](https://www.youtube.com/@gen.e_media/shorts)). Each article uses the client's video title and description verbatim, with stills taken from the film (see [Media import](#media-import)). Branding, colours and the "gen.E" wordmark are still provisional placeholders.

---

## Quick start

Requirements: **Node.js 20.9+** (developed on Node 24).

```bash
npm install
npm run dev          # http://localhost:3000
```

Other scripts:

| Command | What it does |
| --- | --- |
| `npm run build` | Production build (pre-renders all story, category and static pages) |
| `npm start` | Serve the production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run media` | Re-import gen.E films, posters, stills and metadata (needs Python 3, `yt-dlp`, ffmpeg and Node) |

Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_SITE_URL` to the public origin. It is used for canonical URLs, Open Graph tags, the sitemap and share links.

**Tip:** to see the mobile experience on a desktop browser, open dev tools and switch to a phone viewport (≤ 767px), or visit `/watch`.

---

## Stack

- **Next.js 16** (App Router, React Server Components, static generation)
- **React 19**, **TypeScript** (strict)
- **Tailwind CSS v4** (CSS-first tokens in `src/app/globals.css`)
- **lucide-react** icons
- **motion** (Framer Motion), used only for the navigation drawer via `LazyMotion` to keep the bundle small
- Native HTML5 `<video>` with custom controls. No video or UI framework dependencies.

---

## Routes

| Route | Mobile | Desktop |
| --- | --- | --- |
| `/` | Full-screen reel feed ("For you") | Editorial homepage: featured film, reels row, latest, sidebar, topics |
| `/category/[slug]` | Reel feed filtered to the category | Category masthead, story grid, sidebar |
| `/watch`, `/watch/[category]` | Reel feed | Reel framed as a 9:16 column with arrow controls |
| `/stories/[slug]` | Article | Article (two-column opener with the film) |
| `/latest` | Newest-first list | List + sidebar |
| `/categories` | Topic tiles | Topic tiles |
| `/search?q=` | Live search | Live search |
| `/about`, `/contact`, `/privacy`, `/terms` | Static pages (placeholder copy is clearly marked) | |
| `/api/search?q=` | JSON search endpoint used by the search UI | |
| `/sitemap.xml`, `/robots.txt` | Generated | |

The feed keeps its place in the URL (`?story=slug`). Opening an article and pressing back returns you to the same story, and a feed URL with `?story=` can be shared directly.

---

## Project structure

```
src/
  app/                      Routes (App Router)
    page.tsx                Home: mobile reel + desktop editorial
    stories/[slug]/         Article page (+ metadata, JSON-LD)
    category/[slug]/        Category page (+ loading state)
    watch/                  Reel on any screen size
    search/  latest/  categories/  about/  contact/  privacy/  terms/
    api/search/route.ts     Search endpoint
    sitemap.ts  robots.ts  not-found.tsx  error.tsx  layout.tsx  globals.css
  components/
    feed/                   VideoFeed, VideoFeedItem, VideoPlayer, VideoControls,
                            VideoOverlay, CategorySelector, FeedStory type
    article/                ArticleHeader, ArticleBody (block renderer), ArticleMedia,
                            RelatedStories, ReadingProgress
    stories/                StoryCard (reel | panel | wide | compact), StoryRow,
                            FeaturedStory, FeaturedVideo, HoverVideo, CategoryTiles
    layout/                 SiteHeader, HeaderShell, DesktopNavigation, MobileNavigation
                            (drawer), Sidebar, SiteFooter, StaticPage, nav data loader
    search/                 SearchInterface
    ui/                     ShareButton, EmptyState, LoadingSkeleton, SectionHeading, ContactForm
    seo/                    JsonLd + NewsArticle / VideoObject / Breadcrumb builders
    brand/                  Wordmark (placeholder)
  lib/
    content/
      types.ts              Content model: Story, Category, Author, ArticleBlock, SiteSettings…
      source.ts             ContentSource interface (the contract a CMS adapter implements)
      index.ts              Data access layer: the only module pages import content from
      search.ts             Relevance scoring for the mock source
      mock/gen-e-videos.json Imported film metadata (title, description, date, tags)
      mock/data.ts          Maps the imported films to stories, categories and authors
      mock/source.ts        In-memory ContentSource implementation
    hooks/useMediaQuery.ts  SSR-safe media query, reduced-motion and save-data hooks
    site.ts  format.ts  cn.ts
scripts/import-gen-e-videos.py  Imports gen.E films from YouTube into local media + JSON
public/media/               Films (720×1280 H.264), 9:16 posters and article stills
```

---

## Architecture notes

### Content and CMS readiness

- Pages call functions from `@/lib/content` (`getStories`, `getStory`, `getCategories`, `searchStories`…). They never import the mock data.
- `lib/content/source.ts` defines a `ContentSource` interface. `mockSource` implements it today. To connect **Payload CMS** (or any headless CMS), write a `payloadSource` that calls the CMS API and maps responses onto the types in `types.ts`, then switch the one line in `lib/content/index.ts`.
- Article bodies are typed **blocks** (`paragraph`, `heading`, `image`, `quote`, `list`, `video`), which map naturally onto Payload's Blocks / Lexical fields. `ArticleBody` renders them as semantic HTML.
- Site settings (navigation and tagline), categories (name, description, tint colour, order) and authors are all data, so they can be edited in the CMS.
- Search goes through `/api/search`, so swapping in a real search index changes only the data layer.
- Server functions are wrapped in React `cache()`. For CMS content, add `revalidate` / tag-based revalidation (`revalidateTag`) from a CMS webhook.

### The reel feed (`components/feed`)

- **One story per viewport** with CSS scroll-snap (`snap-mandatory` and `scroll-snap-stop: always`) for native-feeling touch swipes.
- **Wheel and trackpad**: a gesture-aware handler moves exactly one story per gesture and ignores trailing inertia.
- **Keyboard**: ↑/↓, PageUp/PageDown, J/K, Home/End, Space (play/pause), M (sound). Previous and next buttons are available to keyboard and switch users, and shown beside the frame on desktop `/watch`.
- **Playback**: only the active story plays. It starts muted, tapping pauses or resumes, and it pauses when the tab is hidden. If the browser refuses unmuted playback, the feed falls back to muted automatically.
- **Resource management**: only the active story and its neighbours mount a `<video>`. The next story is preloaded (`preload="auto"`), the previous one keeps metadata only, and everything else is a lightweight optimised poster image. The progress bar is driven by `requestAnimationFrame` straight to the DOM, so playback never re-renders React. Feed items are memoised.
- **Reduced motion / Save-Data / 2G**: autoplay is off and next-story preloading is skipped until the visitor presses play once. After that the feed continues on its own.
- **States**: delayed loading spinner, error state with retry, an end-of-feed card, and an empty state for categories without stories.
- On `/` and `/category/*` the mobile feed sits beside the desktop layout and stays **dormant** above 767px: no video loads and no listeners attach.

### Desktop video

Only one video ever autoplays: the featured story, muted, and only while on screen. Grid cards play a muted preview on hover (fine pointers only, after a short delay). The `<video>` element isn't created until the first hover.

### SEO

- Server-rendered, statically generated articles with semantic `<article>` markup.
- Per-page `generateMetadata`: title, description, canonical, Open Graph (`article` and `og:video`), Twitter card.
- JSON-LD: `NewsArticle` with an embedded `VideoObject`, `BreadcrumbList`, and `WebSite` with a `SearchAction`.
- `sitemap.xml` with image and video extensions. `robots.txt` disallows `/api/` and search result pages.
- `/watch/[category]` canonicalises to the editorial `/category/[slug]` page.

### Accessibility

Skip link, visible focus rings, semantic landmarks and headings, labelled controls (`aria-pressed` on sound toggles), a focus-trapped drawer with Escape to close, live regions for share and search feedback, accessible range seeking in the article player, 44px minimum touch targets, and `prefers-reduced-motion` support. The article player renders native `controls` until JavaScript loads, so articles (text and video) work without JavaScript.

---

## Media import

`npm run media` runs `scripts/import-gen-e-videos.py`. For each YouTube Short listed in its `STORIES` table (video id, category, featured flag), it:

1. reads the title, description, upload date, duration and tags (channel-wide SEO tags are filtered out)
2. downloads the original into `.media-cache/` (git-ignored)
3. encodes a web copy, 720×1280 H.264 + AAC with fast-start (about 1.2–1.4 Mbps), into `public/media/video/<slug>.mp4`
4. extracts a poster frame and two stills into `public/media/posters/` and `public/media/images/`
5. writes `src/lib/content/mock/gen-e-videos.json`

To add a film, append its id to `STORIES` and re-run. Article text is the video description, unchanged apart from removing links and `@`/`#` markers. The only title edit is a typo fix listed in `TITLE_FIXES`. Each article links back to the original Short.

Install the requirements once with `pip install yt-dlp pillow numpy`; ffmpeg and Node.js must be on your PATH. In production, editors will upload films to the CMS instead, and this script will be retired.

## Design tokens

All colours, fonts and motion curves are tokens in the `@theme` block of `src/app/globals.css` (`--color-ink`, `--color-paper`, `--color-accent`, …). Category tint colours live on each category record. Swap these, and the `Wordmark` component, when the official gen.E identity arrives.

Typefaces: **Newsreader** (editorial serif) and **Geist** (UI sans), self-hosted via `next/font`.

---

## Not in this phase (by design)

No backend, CMS, authentication, database, accounts, likes, comments or follows. "Trending" is ordered by recency until analytics exist. The contact form validates input but **does not send anything**, and says so in the UI. Legal and About copy is clearly marked placeholder text.

### Suggested next phase

CMS and editorial dashboard (e.g. Payload): video upload and transcoding, article block editor, categories, feed ordering and featured slots, scheduled publishing, and webhooks for on-demand revalidation.
