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
streaks and levels.

Everything is written to your device first and works offline. Sign in and the same
library is on your phone — through a database you own.

**Plan → Study → Focus → Track → Improve**

---

## What is inside

| Screen | What it does |
| --- | --- |
| **Dashboard** | Greeting, level, streak, the four numbers that decide today, the day's timeline, the week's hours and upcoming exams |
| **Plan** | A day planner: the days side by side as columns, each with an estimate on every card, a capacity bar that says whether today fits, a backlog you drag from, the calendar on the same ruler, and a detail panel that saves as you type |
| **Calendar** | Month, week, day and the weekly timetable — deadlines drag onto another day to reschedule |
| **Library** | PDFs and whiteboards, folders, stars, a bin, grid or table |
| **Flashcards** | Decks and SM-2 review, with `space` and `1`–`4` on the keyboard |
| **Focus** | Full-screen session, then a completion screen with the minutes, the XP and the streak |
| **Statistics** | Range switch, activity by day, distribution by subject, when you study, consistency |
| **Achievements** | Levels, XP by source, nineteen badges |
| **Profile** | Hours, streaks and badges, plus the twenty-week activity calendar |

Nothing on those screens is typed in by hand. Levels, streaks and readiness are
all recomputed from the records the app already keeps — focus sessions, completed
tasks, card reviews — so a number can never drift away from the thing it counts.

On the plan, `←` and `→` move a day either way, `C` shows or hides the calendar and
`Esc` closes the detail panel. Everywhere else `T` starts a task, `E` an exam, `D` a
document and `B` a whiteboard.

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

**Every page and every screen has an address, and the address is its name.** No
`/app/` in front of anything, no state that hides behind `/`:

| Address                   | What it is                             |
| ------------------------- | -------------------------------------- |
| `/homepage`               | the marketing page (`/` is a 301 to it) |
| `/about` `/faq` `/contact`| public pages                            |
| `/privacy` `/terms` `/cookies` | the legal texts                    |
| `/login` `/register`      | the door                                |
| `/dashboard`              | the app's front screen                  |
| `/plan` `/calendar` `/exams` `/library` `/cards` `/focus` `/stats` `/achievements` `/subjects` `/profile` `/settings` | one per screen |
| `/document/:id` `/subjects/:id` `/settings/:section` | the addresses that carry an id |

`#how` and `#inside` are sections of `/homepage`, not pages — they are anchors, they
are not in the sitemap, and they are not meant to be indexed separately. `/about` and
`/faq` are pages, and they are.

Every public page exists twice, once per language. Bulgarian is served from the
unprefixed path and English from `/en`: `/homepage` and `/en/homepage`, `/faq` and
`/en/faq`, and so on. There is deliberately no `/bg/…` — a prefix for the language that
already owns the unprefixed path is a second address for one page, so `/bg/faq` is a 301
to `/faq`. **The address decides the language**, not a cookie and not the browser.
Nothing redirects by location or by `Accept-Language`; a visitor whose browser asks for
English is *offered* `/en` as a link and can ignore it.

The app's screens carry no language prefix — the app has no public addresses, so there
is nothing for a search engine to index twice — and they all answer `noindex`.

Old links keep working. `/`, `/home`, `/index` → `/homepage`; `/signup` → `/register`;
`/app` → `/dashboard`; `/app/tasks` → `/tasks`; `/app/d/:id` → `/document/:id`. The list
is in `redirectFor` in `src/seo/routes.ts` and mirrored into `vercel.json`, and both the
host and the browser apply it.

One table in `src/seo/routes.ts` is read by six things that must never disagree: the
router, the head-tag writer, the language switch, the redirect list, the JSON-LD builder
in `src/seo/schema.ts`, and the build step in `scripts/make-seo-assets.mjs`. That step
emits `sitemap.xml`, `robots.txt` and **a real file per address per language** — so
`/en/about` is answered from the filesystem with its own title, description, canonical,
`hreflang` set and structured data in the first byte, without a server. Adding a page
means adding a row to the table; nothing else.

Anything that is not one of those files is a real **404** — `dist/404.html`, branded,
`noindex`, with no canonical. The soft-404 alternative (rewriting everything to
`index.html`) would have folded every mistyped URL into the home page.

The operator's own details (registered name, address, the three e-mail addresses) live
in `src/legal.ts`. Until they are filled in, every legal page shows a banner saying it
is a draft, rather than presenting an invented address as real.

## The white screen

Two things exist only to stop one failure: a cached `index.html` that names a
JavaScript bundle no longer next to it. The browser fetches the only script the document
has, gets a 404, and draws nothing — no error, no message, nothing to report but "the
site is white".

`scripts/make-seo-assets.mjs` refuses to finish a build that would produce one, and
`public/recover.js` cleans up after the builds that already did: if `#root` is still
empty six seconds after load, it deletes every cache, unregisters every service worker
and reloads — once, guarded by `sessionStorage`, so a genuinely broken deploy cannot
become a reload loop.

The service worker is also **never registered on localhost**. `npm run preview` reuses
its port between builds, and a worker left by one build answering navigations for the
next is precisely how a white screen appears on a developer's machine while the live
site is fine. Any worker a previous preview left behind is unregistered on load.

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
