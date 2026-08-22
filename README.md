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
| Accent | `#6d5ae6` — Plauvia violet |

The mark is a geometric **P** whose stem is cut on a rising diagonal, so it reads as a
bookmark as much as a letter. Every raster — favicon, Android tiles, Apple touch icon,
social preview — is generated from that one path:

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

## Data

IndexedDB first, always. Sync is optional and runs through a Supabase project you own:
every record is a flat row with an `updatedAt`, so merging two devices is "the newer
write wins" and needs no server logic. `supabase/schema.sql` sets it up in one run.
