<div align="center">
  <img src="public/icons/icon-192.png" width="72" height="72" alt="Plauvia">
  <h1>Plauvia</h1>
  <p><strong>From plan to progress.</strong></p>
  <p><a href="https://www.plauvia.com">plauvia.com</a></p>
</div>

---

Plauvia keeps your textbooks, tasks, flashcards and study time in one place — so the
work you plan is the work that actually gets done.

Open a PDF or start on blank paper and solve straight on the page. Cut a problem out
and it becomes a flashcard. Keep a calculator, a periodic table or a ruler docked
beside your work. Plan the week, run a focus session, and watch the hours turn into
goals, streaks and levels.

Everything is written to your device first and works offline. Sign in and the same
library is on your phone — through a database you own.

**Plan → Study → Focus → Track → Improve**

---

## What is inside

| Screen | What it does |
| --- | --- |
| **Dashboard** | Greeting, level, streak, the four numbers that decide today, the day's timeline, the week's hours, upcoming exams and goals |
| **Tasks** | Today / Overdue / Upcoming / Someday / Completed, quick add, subject filters, in-place rescheduling |
| **Calendar** | Month, week, day and the weekly timetable — deadlines drag onto another day to reschedule |
| **Goals** | Measured in minutes, tasks, cards, pages or your own units; progress, pace and milestones |
| **Exams** | Countdown plus a readiness figure computed from tasks, cards and hours actually logged |
| **Library** | PDFs and whiteboards, folders, stars, a bin, grid or table |
| **Flashcards** | Decks and SM-2 review, with `space` and `1`–`4` on the keyboard |
| **Focus** | Full-screen session, then a completion screen with the minutes, the XP and the streak |
| **Statistics** | Range switch, activity by day, distribution by subject, when you study, consistency |
| **Achievements** | Levels, XP by source, nineteen badges |
| **Profile** | Hours, streaks, goals and badges, plus the twenty-week activity calendar |

Nothing on those screens is typed in by hand. Levels, goals, streaks and readiness are
all recomputed from the records the app already keeps — focus sessions, completed
tasks, card reviews — so a number can never drift away from the thing it counts.

## Bilingual

The whole interface is Bulgarian and English, switched in **Settings → Appearance &
language**. Strings live next to the markup as `L('български', 'english')` pairs, so a
sentence and its translation are always the same edit.

## Brand

| | |
| --- | --- |
| Name | Plauvia |
| Tagline | From plan to progress. · От план към резултат. |
| Domain | plauvia.com |
| Accent | `#1857d6` — Plauvia blue |

The mark is a capital **P wearing a mortarboard** — not a cap parked above a letter,
but one silhouette: the board's underside is the letter's shoulder and the brim
overhangs the bowl. It has no tassel, because every version that had one collapsed into
a downward arrow at sixteen pixels, which is where a favicon actually lives. The
geometry lives in `src/components/brand/mark.ts` and every raster — favicon, Android
tiles, Apple touch icon, social preview — is generated from it:

```bash
npm run brand
```

Icons drift the moment they are drawn twice; generating them means they cannot disagree.

## Design system

Tokens live in `src/styles/index.css` — one palette, one type scale, one elevation
scale, one motion curve. Everything visible is assembled from `src/components/kit`
(Button, Card, StatCard, Badge, Tabs, ProgressRing, EmptyState, Skeleton, Sheet, the
charts), so five screens keep looking like one product.

The charts are inline SVG with no charting dependency, and their categorical colours
are checked for colour-vision separation rather than chosen by eye.

Nothing in the palette is picked by eye either. Every pairing a person actually reads —
white on the primary button, the accent on its soft ground, muted and faint text on both
surfaces — is measured, and the value that failed is the value that changed. The six
selectable accents each clear 4.5:1 in both themes; the brand mark keeps
`--grad-brand` while the accent moves `--grad-accent`, so choosing green recolours the
buttons without repainting the logo.

**Settings → Accessibility** carries text size (which scales the whole ramp through one
`--type-scale`), motion (system / reduced / full, and the OS preference wins unless
overridden) and high contrast.

## The public web

The app's screens are state, not addresses — moving between them must not touch history
while a document is mid-save. What does need addresses is the public site, so
`src/state/routeStore.ts` owns exactly those.

**Every public page exists twice, once per language, at an address of its own.**
Bulgarian is served from the unprefixed path and English from `/en`:

| Bulgarian  | English       |
| ---------- | ------------- |
| `/`        | `/en`         |
| `/about`   | `/en/about`   |
| `/faq`     | `/en/faq`     |
| `/contact` | `/en/contact` |
| `/privacy` | `/en/privacy` |
| `/terms`   | `/en/terms`   |
| `/cookies` | `/en/cookies` |

There is deliberately no `/bg/…`: a prefix for the language that already owns the
unprefixed path is a second address for one page, so `/bg/faq` is a 301 to `/faq`.
**The address decides the language**, not a cookie and not the browser — `/faq` is the
Bulgarian page for everybody. Nothing redirects by location or by `Accept-Language`;
a visitor whose browser asks for English is *offered* `/en` as a link and can ignore it.
Following a language link is what writes the preference, and that preference is then
what the app — which has no public addresses — opens in.

One table in `src/seo/routes.ts` is read by five things that must never disagree: the
router, the head-tag writer, the language switch, the JSON-LD builder in
`src/seo/schema.ts`, and the build step in `scripts/make-seo-assets.mjs`. That step
emits `sitemap.xml`, `robots.txt` and **a real file per address per language** — so
`/en/about` is answered from the filesystem with its own title, description, canonical,
`hreflang` set and structured data in the first byte, without a server and without a
catch-all rewrite. Adding a public page means adding a row to the table; nothing else.

`/login`, `/signup` and `/app` get shells of their own carrying `noindex`, and
`/app/*` is the single rewrite in `vercel.json` because a screen's address can carry an
id. They are *not* disallowed in `robots.txt`: a crawler has to be allowed to fetch a
page in order to read the `noindex` in it.

Anything that is not one of those files is a real **404** — `dist/404.html`, branded,
`noindex`, with no canonical. The soft-404 alternative (rewriting everything to
`index.html`) would have quietly folded every mistyped URL into the home page.

The operator's own details (registered name, address, the three e-mail addresses) live
in `src/legal.ts`. Until they are filled in, every legal page shows a banner saying it
is a draft, rather than presenting an invented address as real.

## Security

`vercel.json` is the single source for the security headers, and `vite.config.ts` reads
it back so `npm run dev` and `npm run preview` send the same ones.

Hashed assets are **not** served `immutable, max-age=1y`, and that is deliberate. A
header rule matches by path, not by status, so a 404 during a deploy gets stamped with
the same year-long lifetime as the file it failed to find — and a CDN will then serve
that 404 for a year to everyone behind that edge, which is a white screen nobody can
clear. The service worker already caches hashed assets cache-first, so the long HTTP
lifetime bought very little and could cost the whole site. A
Content-Security-Policy exercised only in production is a policy discovered by users;
`npm run preview` serves the real build under the real policy — no `unsafe-inline`, no
exceptions — which is how you find out that the PDF worker still starts.

## Data

IndexedDB first, always. Sync is optional and runs through Supabase: every record is a
flat row with an `updatedAt`, so merging two devices is "the newer write wins" and needs
no server logic. `supabase/schema.sql` sets it up in one run, and
`supabase/usernames.sql` adds the unique-handle table — optional, because the app
validates the shape and stores the name locally either way.

Row-level security stops one account from reading another's rows. It does not apply to
whoever owns the Supabase project, and the privacy policy says so in those words rather
than claiming that nobody but you can reach it.
