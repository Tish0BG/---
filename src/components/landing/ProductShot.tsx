import { useEffect, useRef, useState } from 'react';
import type { Lang } from '@/brand';
import { Icon } from '../Icon';
import { PlauviaTile } from '../brand/Logo';

/**
 * ─────────────────────────────────────────────────────── the product, moving ──
 *
 * The one object on the home page that is allowed to be an object, and the
 * only argument on it that a visitor cannot dismiss as marketing: the thing
 * itself, navigating between its own screens.
 *
 * It used to be a single frozen dashboard. That answered "is this a real
 * app?" and nothing else — somebody weighing up whether to sign up wants to
 * know what the other five screens look like, and a static picture of one of
 * them invites them to assume the rest do not exist yet. So the window and the
 * rail stay put and the content changes underneath, which is what the app
 * actually does when you click the rail. Swapping whole screenshots would read
 * as a slideshow; moving one pane reads as a product.
 *
 * Built from the app's own tokens rather than from a folder of PNGs: it stays
 * sharp at any size, follows the visitor's theme, and cannot quietly go out of
 * date the next time a padding value changes.
 *
 * Three things stop the motion, and all three matter more than the animation
 * does: the reader's own reduced-motion preference, the shot being scrolled
 * off screen, and a pointer resting on it. That last one is the one people
 * notice — a panel that changes under the cursor while you are reading it is
 * worse than one that never moved.
 */

type Scene = 'dashboard' | 'plan' | 'cards' | 'focus' | 'stats';

/** How long each screen holds before the next one. */
const DWELL = 3800;

const SCENES: Scene[] = ['dashboard', 'plan', 'cards', 'focus', 'stats'];

export function ProductShot({ lang }: { lang: Lang }) {
  const bg = lang === 'bg';
  const [scene, setScene] = useState<Scene>('dashboard');
  /** true once somebody has clicked the rail: their choice outranks the loop */
  const [held, setHeld] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [visible, setVisible] = useState(true);
  const frame = useRef<HTMLDivElement>(null);

  /** Off screen is not worth animating, and on a phone it is most of the page. */
  useEffect(() => {
    const node = frame.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0.25 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const still =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches &&
    document.documentElement.dataset.motion !== 'full';

  useEffect(() => {
    if (still || held || hovered || !visible) return;
    const id = window.setInterval(() => {
      setScene((current) => SCENES[(SCENES.indexOf(current) + 1) % SCENES.length]);
    }, DWELL);
    return () => window.clearInterval(id);
  }, [still, held, hovered, visible]);

  const NAV: { id: Scene | null; icon: string; label: string; badge?: string }[] = [
    { id: 'dashboard', icon: 'dashboard', label: bg ? 'Табло' : 'Dashboard' },
    { id: 'plan', icon: 'listTodo', label: bg ? 'План' : 'Plan', badge: '5' },
    { id: null, icon: 'calendar', label: bg ? 'Календар' : 'Calendar' },
    { id: 'cards', icon: 'cards', label: bg ? 'Флашкарти' : 'Flashcards', badge: '23' },
    { id: null, icon: 'drive', label: bg ? 'Библиотека' : 'Library' },
    { id: 'focus', icon: 'timer', label: bg ? 'Фокус' : 'Focus' },
    { id: null, icon: 'layers', label: bg ? 'Предмети' : 'Subjects' },
    { id: 'stats', icon: 'chartLine', label: bg ? 'Статистика' : 'Statistics' },
  ];

  return (
    /* No border and no shadow of its own: on the home page this sits inside
       the `.showcase` frame, and two frames around one screenshot is how a
       mockup starts looking like a slide deck. */
    <div
      ref={frame}
      className="overflow-hidden"
      style={{ background: 'var(--c-surface)' }}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      role="group"
      aria-label={bg ? 'Преглед на Plauvia' : 'A preview of Plauvia'}
    >
      {/* window chrome */}
      <div
        className="flex h-9 items-center gap-2 border-b border-line px-3"
        style={{ background: 'var(--c-surface-2)' }}
      >
        <span className="flex gap-1.5" aria-hidden>
          {['#f87171', '#fbbf24', '#34d399'].map((c) => (
            <span key={c} className="h-[9px] w-[9px] rounded-full" style={{ background: c, opacity: 0.75 }} />
          ))}
        </span>
        <span
          className="mx-auto rounded-md px-3 py-0.5 text-[10.5px] text-faint"
          style={{ background: 'var(--c-surface-3)' }}
          aria-hidden
        >
          plauvia.com
        </span>
      </div>

      <div className="flex" style={{ minHeight: 380 }}>
        {/* -------------------------------------------------------- sidebar */}
        <div className="hidden w-[172px] shrink-0 flex-col border-r border-line p-2.5 sm:flex">
          <div className="mb-3 flex items-center gap-2 px-1">
            <PlauviaTile size={22} />
            <span className="text-[12.5px] font-semibold tracking-[-0.02em]">Plauvia</span>
          </div>

          {NAV.map((entry) => {
            const active = entry.id !== null && entry.id === scene;
            const body = (
              <>
                <Icon name={entry.icon} size={13} />
                {entry.label}
                {entry.badge && (
                  <span
                    className="ml-auto rounded-full px-1 text-[9px] font-semibold"
                    style={{ background: active ? 'transparent' : 'var(--c-surface-3)' }}
                  >
                    {entry.badge}
                  </span>
                )}
              </>
            );
            const style = active
              ? { background: 'var(--c-accent-soft)', color: 'var(--c-accent)', fontWeight: 500 }
              : { color: 'var(--c-muted)' };

            /* The five screens the shot can actually draw are buttons; the
               three it cannot are painted rail, and a button that does nothing
               is worse than a label. */
            return entry.id === null ? (
              <span
                key={entry.label}
                className="mb-0.5 flex items-center gap-2 rounded-[8px] px-2 py-[5px] text-[11px]"
                style={style}
                aria-hidden
              >
                {body}
              </span>
            ) : (
              <button
                key={entry.label}
                type="button"
                onClick={() => {
                  setScene(entry.id as Scene);
                  setHeld(true);
                }}
                aria-pressed={active}
                className="mb-0.5 flex cursor-pointer items-center gap-2 rounded-[8px] px-2 py-[5px] text-left text-[11px] transition-colors"
                style={style}
              >
                {body}
              </button>
            );
          })}

          <div className="mt-3 px-2 text-[9.5px] text-faint" aria-hidden>
            {bg ? 'Предмети' : 'Subjects'}
          </div>
          {(bg ? ['Работа', 'Здраве', 'Учене'] : ['Work', 'Health', 'Study']).map((s, i) => (
            <span
              key={s}
              className="flex items-center gap-2 px-2 py-[5px] text-[10.5px] text-muted"
              aria-hidden
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: ['var(--c-brand)', 'var(--c-aurora)', 'var(--c-ember)'][i] }}
              />
              {s}
            </span>
          ))}

          <div
            className="mt-auto flex items-center gap-2 rounded-[10px] p-1.5"
            style={{ background: 'var(--c-surface-2)' }}
            aria-hidden
          >
            <span
              className="grid h-6 w-6 place-items-center rounded-full text-[11px] font-semibold text-white"
              style={{ background: 'var(--c-brand)' }}
            >
              А
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[10.5px] font-semibold">{bg ? 'Ана' : 'Ana'}</span>
              <span className="block truncate text-[9px] text-muted">
                {bg ? 'Ниво 7 · Ерудит' : 'Level 7 · Scholar'}
              </span>
            </span>
          </div>
        </div>

        {/* ---------------------------------------------------------- content */}
        <div className="min-w-0 flex-1 p-3 sm:p-4" style={{ background: 'var(--c-bg)' }} aria-hidden>
          {/* `key` is what makes the fade happen: React replaces the subtree
              rather than reconciling it, so the entering pane animates from
              scratch instead of the old one morphing into the new. */}
          <div key={scene} className="animate-rise">
            {scene === 'dashboard' && <DashboardScene bg={bg} />}
            {scene === 'plan' && <PlanScene bg={bg} />}
            {scene === 'cards' && <CardsScene bg={bg} />}
            {scene === 'focus' && <FocusScene bg={bg} />}
            {scene === 'stats' && <StatsScene bg={bg} />}
          </div>
        </div>
      </div>

      {/* Below `sm` the rail is hidden, and with it the only way to steer the
          shot. These are that control, and nothing more: on a wide screen the
          rail already says which screen is showing and can change it, so a
          second set of the same affordance would just be clutter. */}
      <div className="flex justify-center gap-1.5 border-t border-line py-2.5 sm:hidden">
        {SCENES.map((id) => {
          const active = id === scene;
          return (
            <button
              key={id}
              type="button"
              onClick={() => {
                setScene(id);
                setHeld(true);
              }}
              aria-label={LABELS[id][bg ? 'bg' : 'en']}
              aria-pressed={active}
              /* The tap target is 28 px of button around a 6 px dot: a row of
                 six-pixel targets on a phone is a row of near-misses. */
              className="grid h-7 w-7 cursor-pointer place-items-center"
            >
              <span
                className="rounded-full transition-all duration-200"
                style={{
                  width: active ? 16 : 6,
                  height: 6,
                  background: active ? 'var(--c-accent)' : 'var(--c-line-strong)',
                }}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Named for the dots, which have no room for a word. */
const LABELS: Record<Scene, { bg: string; en: string }> = {
  dashboard: { bg: 'Табло', en: 'Dashboard' },
  plan: { bg: 'План', en: 'Plan' },
  cards: { bg: 'Флашкарти', en: 'Flashcards' },
  focus: { bg: 'Фокус', en: 'Focus' },
  stats: { bg: 'Статистика', en: 'Statistics' },
};

/* ------------------------------------------------------------------ pieces */

/** The mockup's card: one surface, one hairline, no shadow. */
function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-[12px] p-3 ${className}`}
      style={{ background: 'var(--c-surface)', border: '1px solid var(--c-line)' }}
    >
      {children}
    </div>
  );
}

function Heading({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-2">
      <span className="text-[10.5px] font-semibold">{children}</span>
      {right && <span className="text-[9px] text-muted">{right}</span>}
    </div>
  );
}

/* ------------------------------------------------------------------ scenes */

function DashboardScene({ bg }: { bg: boolean }) {
  const stats: [string, string, string][] = bg
    ? [
        ['74 мин', 'Днес', 'var(--c-brand)'],
        ['12', 'Серия', 'var(--c-ember)'],
        ['3 / 5', 'Задачи днес', 'var(--c-aurora)'],
        ['23', 'За преговор', 'var(--c-deep)'],
      ]
    : [
        ['74 min', 'Today', 'var(--c-brand)'],
        ['12', 'Streak', 'var(--c-ember)'],
        ['3 / 5', 'Tasks today', 'var(--c-aurora)'],
        ['23', 'To review', 'var(--c-deep)'],
      ];

  const plan: [string, string, string, string][] = bg
    ? [
        ['09:00', 'Среща с екипа', 'Работа', 'var(--c-brand)'],
        ['18:00', 'Тренировка', 'Здраве', 'var(--c-aurora)'],
        ['', 'Плати сметките', 'Дом', 'var(--c-ember)'],
        ['', 'Прочети 20 страници', 'Учене', 'var(--c-deep)'],
      ]
    : [
        ['09:00', 'Team stand-up', 'Work', 'var(--c-brand)'],
        ['18:00', 'Training', 'Health', 'var(--c-aurora)'],
        ['', 'Pay the bills', 'Home', 'var(--c-ember)'],
        ['', 'Read 20 pages', 'Study', 'var(--c-deep)'],
      ];

  const exams: [string, string, string][] = bg
    ? [
        ['6', 'Данъчна декларация', 'Финанси'],
        ['13', 'Изпит по физика', 'Учене'],
      ]
    : [
        ['6', 'Tax return', 'Money'],
        ['13', 'Physics exam', 'Study'],
      ];

  return (
    <>
      <Panel className="!p-3.5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="text-[16px] font-semibold tracking-[-0.02em]">
              {bg ? 'Добър ден, Ана' : 'Good afternoon, Ana'}
            </div>
            <div className="mt-0.5 text-[10.5px] text-muted">
              {bg
                ? 'вторник, 4 март · 3 за днес · напомняне в 18:00'
                : 'Tuesday, 4 March · 3 due today · a reminder at 18:00'}
            </div>
          </div>
          <span
            className="rounded-[8px] px-2.5 py-1 text-[10.5px] font-medium"
            style={{ background: 'var(--c-accent)', color: 'var(--c-accent-text)' }}
          >
            {bg ? 'Започни фокус' : 'Start focus'}
          </span>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <div className="flex-1">
            <div className="mb-1 flex justify-between text-[9px] text-muted">
              <span>{bg ? 'Ниво 7 · Ерудит' : 'Level 7 · Scholar'}</span>
              <span>640 / 900 XP</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--c-surface-3)' }}>
              <span className="block h-full w-[71%] rounded-full" style={{ background: 'var(--c-accent)' }} />
            </div>
          </div>
          <span
            className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{ background: 'color-mix(in srgb, var(--c-ember) 14%, transparent)', color: 'var(--c-ember)' }}
          >
            <Icon name="flame" size={10} fill />
            12
          </span>
        </div>
      </Panel>

      <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stats.map(([value, label, color]) => (
          <Panel key={label} className="!p-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[9.5px] text-faint">{label}</span>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
            </div>
            <div className="mt-1.5 text-[15px] font-semibold tracking-[-0.02em]">{value}</div>
          </Panel>
        ))}
      </div>

      <div className="mt-2.5 grid gap-2.5 lg:grid-cols-[1.5fr_1fr]">
        <Panel>
          <Heading>{bg ? 'Днешният план' : "Today's plan"}</Heading>
          {plan.map(([time, title, meta, color], i) => (
            <div key={i} className="flex items-center gap-2 py-[5px]">
              <span className="w-[30px] shrink-0 text-right text-[9px] text-faint">{time}</span>
              <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />
              <span className="min-w-0 flex-1 truncate text-[10.5px]">{title}</span>
              <span className="shrink-0 text-[9px] text-muted">{meta}</span>
            </div>
          ))}
          <div className="mt-2 border-t border-line pt-2.5">
            <Heading>{bg ? 'Тази седмица' : 'This week'}</Heading>
            <WeekBars bg={bg} />
          </div>
        </Panel>

        <Panel>
          <Heading>{bg ? 'Предстоящи срокове' : 'Deadlines ahead'}</Heading>
          {exams.map(([days, title, subject]) => (
            <div key={title} className="flex items-center gap-2 py-1.5">
              <span
                className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px] text-[12px] font-semibold"
                style={{
                  background: 'color-mix(in srgb, var(--c-brand) 12%, transparent)',
                  color: 'var(--c-brand)',
                }}
              >
                {days}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[10.5px] font-medium">{title}</span>
                <span className="block truncate text-[9px] text-muted">{subject}</span>
              </span>
            </div>
          ))}
          <div className="mt-2 border-t border-line pt-2.5">
            <Heading>{bg ? 'Цели' : 'Goals'}</Heading>
            {(
              [
                [bg ? 'Ремонт — 30 часа' : 'The flat — 30 hours', 0.62, 'var(--c-brand)'],
                [bg ? '12 тренировки този месец' : '12 workouts this month', 0.35, 'var(--c-aurora)'],
              ] as [string, number, string][]
            ).map(([label, value, color]) => (
              <div key={label} className="mb-2">
                <div className="mb-1 flex justify-between text-[9px]">
                  <span className="truncate text-muted">{label}</span>
                  <span>{Math.round(value * 100)}%</span>
                </div>
                <div className="h-1 overflow-hidden rounded-full" style={{ background: 'var(--c-surface-3)' }}>
                  <span
                    className="block h-full rounded-full"
                    style={{ width: `${value * 100}%`, background: color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </>
  );
}

function PlanScene({ bg }: { bg: boolean }) {
  const groups: { day: string; rows: [string, string, string, boolean, string][] }[] = bg
    ? [
        {
          day: 'Днес · вторник, 4 март',
          rows: [
            ['Плати сметките', 'Дом', 'var(--c-ember)', true, ''],
            ['Прочети глава 5 и си запиши', 'Учене', 'var(--c-deep)', false, '18:00'],
            ['Реши задачи 12–20 от сборника', 'Математика', 'var(--c-brand)', false, 'просрочена'],
          ],
        },
        {
          day: 'Утре',
          rows: [
            ['Есе за „Под игото“', 'Литература', 'var(--c-aurora)', false, ''],
            ['Тренировка 45 мин', 'Здраве', 'var(--c-aurora)', false, '19:30'],
          ],
        },
      ]
    : [
        {
          day: 'Today · Tuesday, 4 March',
          rows: [
            ['Pay the bills', 'Home', 'var(--c-ember)', true, ''],
            ['Read chapter 5 and take notes', 'Study', 'var(--c-deep)', false, '18:00'],
            ['Problems 12–20 from the book', 'Maths', 'var(--c-brand)', false, 'overdue'],
          ],
        },
        {
          day: 'Tomorrow',
          rows: [
            ['Essay on Under the Yoke', 'Literature', 'var(--c-aurora)', false, ''],
            ['Training, 45 min', 'Health', 'var(--c-aurora)', false, '19:30'],
          ],
        },
      ];

  return (
    <>
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[13px] font-semibold tracking-[-0.02em]">{bg ? 'План' : 'Plan'}</span>
        <span className="flex items-center gap-1.5">
          {(bg ? ['Днес', 'Седмица', 'Всички'] : ['Today', 'Week', 'All']).map((l, i) => (
            <span
              key={l}
              className="rounded-[6px] px-2 py-0.5 text-[9.5px]"
              style={
                i === 0
                  ? { background: 'var(--c-accent-soft)', color: 'var(--c-accent)', fontWeight: 500 }
                  : { color: 'var(--c-muted)' }
              }
            >
              {l}
            </span>
          ))}
          <span
            className="ml-1 rounded-[6px] px-2 py-0.5 text-[9.5px] font-medium"
            style={{ background: 'var(--c-accent)', color: 'var(--c-accent-text)' }}
          >
            + {bg ? 'Задача' : 'Task'}
          </span>
        </span>
      </div>

      {groups.map((group) => (
        <Panel key={group.day} className="mb-2.5">
          <Heading right={`${group.rows.length}`}>{group.day}</Heading>
          {group.rows.map(([title, subject, color, done, when]) => (
            <div key={title} className="flex items-center gap-2.5 py-[6px]">
              <span
                className="grid h-[13px] w-[13px] shrink-0 place-items-center rounded-[4px]"
                style={{
                  background: done ? 'var(--c-accent)' : 'transparent',
                  border: `1.5px solid ${done ? 'var(--c-accent)' : 'var(--c-line-strong)'}`,
                }}
              >
                {done && (
                  <Icon name="check" size={8} strokeWidth={3.4} style={{ color: 'var(--c-accent-text)' }} />
                )}
              </span>
              <span
                className="min-w-0 flex-1 truncate text-[10.5px]"
                style={
                  done
                    ? { textDecoration: 'line-through', color: 'var(--c-faint)' }
                    : undefined
                }
              >
                {title}
              </span>
              <span className="flex shrink-0 items-center gap-1 text-[9px] text-muted">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
                {subject}
              </span>
              {when && (
                <span
                  className="shrink-0 rounded-[5px] px-1.5 py-px text-[8.5px] font-medium"
                  style={
                    when === 'просрочена' || when === 'overdue'
                      ? {
                          background: 'color-mix(in srgb, var(--c-danger) 12%, transparent)',
                          color: 'var(--c-danger)',
                        }
                      : { background: 'var(--c-surface-3)', color: 'var(--c-muted)' }
                  }
                >
                  {when}
                </span>
              )}
            </div>
          ))}
        </Panel>
      ))}
    </>
  );
}

function CardsScene({ bg }: { bg: boolean }) {
  return (
    <>
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[13px] font-semibold tracking-[-0.02em]">
          {bg ? 'Флашкарти' : 'Flashcards'}
        </span>
        <span className="text-[9.5px] text-muted">{bg ? '7 от 23 · Физика' : '7 of 23 · Physics'}</span>
      </div>

      <div className="mb-2.5 h-1 overflow-hidden rounded-full" style={{ background: 'var(--c-surface-3)' }}>
        <span className="block h-full w-[30%] rounded-full" style={{ background: 'var(--c-accent)' }} />
      </div>

      <Panel className="!p-0 overflow-hidden">
        <div className="px-4 py-6 text-center">
          <div className="text-[9px] uppercase tracking-[0.08em] text-faint">
            {bg ? 'Въпрос' : 'Question'}
          </div>
          <div className="mt-2 text-[15px] font-semibold leading-snug tracking-[-0.02em]">
            {bg ? 'Какво измерва специфичният топлинен капацитет?' : 'What does specific heat capacity measure?'}
          </div>
        </div>
        <div className="border-t border-dashed border-line px-4 py-5 text-center" style={{ background: 'var(--c-surface-2)' }}>
          <div className="text-[9px] uppercase tracking-[0.08em] text-faint">{bg ? 'Отговор' : 'Answer'}</div>
          <div className="mt-2 text-[11px] leading-relaxed text-muted">
            {bg
              ? 'Енергията, нужна за загряване на 1 kg вещество с 1 °C.'
              : 'The energy needed to raise 1 kg of a substance by 1 °C.'}
          </div>
        </div>
      </Panel>

      <div className="mt-2.5 grid grid-cols-4 gap-1.5">
        {(
          [
            [bg ? 'Отново' : 'Again', 'var(--c-danger)'],
            [bg ? 'Трудно' : 'Hard', 'var(--c-warn)'],
            [bg ? 'Добре' : 'Good', 'var(--c-success)'],
            [bg ? 'Лесно' : 'Easy', 'var(--c-info)'],
          ] as [string, string][]
        ).map(([label, color]) => (
          <span
            key={label}
            className="rounded-[8px] py-1.5 text-center text-[9.5px] font-medium"
            style={{
              background: `color-mix(in srgb, ${color} 11%, transparent)`,
              color,
              border: `1px solid color-mix(in srgb, ${color} 22%, transparent)`,
            }}
          >
            {label}
          </span>
        ))}
      </div>

      <Panel className="mt-2.5">
        <Heading right={bg ? '4 тестета' : '4 decks'}>{bg ? 'Тестета' : 'Decks'}</Heading>
        {(
          [
            [bg ? 'Физика · Топлина' : 'Physics · Heat', 23, 0.7, 'var(--c-brand)'],
            [bg ? 'Английски · Думи' : 'English · Vocabulary', 8, 0.45, 'var(--c-aurora)'],
            [bg ? 'История · Дати' : 'History · Dates', 0, 1, 'var(--c-ember)'],
          ] as [string, number, number, string][]
        ).map(([name, due, progress, color]) => (
          <div key={name} className="flex items-center gap-2 py-[5px]">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />
            <span className="min-w-0 flex-1 truncate text-[10.5px]">{name}</span>
            <span className="h-1 w-10 shrink-0 overflow-hidden rounded-full" style={{ background: 'var(--c-surface-3)' }}>
              <span className="block h-full rounded-full" style={{ width: `${progress * 100}%`, background: color }} />
            </span>
            <span className="w-[46px] shrink-0 text-right text-[9px] text-muted">
              {due ? (bg ? `${due} за днес` : `${due} due`) : bg ? 'готово' : 'done'}
            </span>
          </div>
        ))}
      </Panel>
    </>
  );
}

function FocusScene({ bg }: { bg: boolean }) {
  const size = 132;
  const r = (size - 9) / 2;
  const c = 2 * Math.PI * r;
  const progress = 0.62;

  return (
    <div className="flex min-h-[352px] flex-col items-center justify-center">
      <span
        className="mb-4 rounded-full px-2.5 py-1 text-[9.5px] font-medium"
        style={{ background: 'color-mix(in srgb, var(--c-aurora) 13%, transparent)', color: 'var(--c-aurora)' }}
      >
        {bg ? 'Сесия 3 от 4 · дълбок фокус' : 'Session 3 of 4 · deep focus'}
      </span>

      <div className="relative grid place-items-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="absolute inset-0 -rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--c-surface-3)" strokeWidth={7} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--c-timer-focus)"
            strokeWidth={7}
            strokeLinecap="round"
            strokeDasharray={`${c * progress} ${c}`}
          />
        </svg>
        <div className="text-center">
          <div className="t-num text-[26px] font-semibold leading-none tracking-[-0.03em]">15:24</div>
          <div className="mt-1 text-[9px] text-faint">{bg ? 'остават' : 'remaining'}</div>
        </div>
      </div>

      <div className="mt-5 text-center">
        <div className="text-[9px] uppercase tracking-[0.08em] text-faint">
          {bg ? 'Работиш по' : 'Working on'}
        </div>
        <div className="mt-1 text-[12px] font-medium">
          {bg ? 'Реши задачи 12–20 от сборника' : 'Problems 12–20 from the book'}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <span
          className="grid h-8 w-8 place-items-center rounded-full"
          style={{ background: 'var(--c-surface)', border: '1px solid var(--c-line)', color: 'var(--c-muted)' }}
        >
          <Icon name="skip" size={13} />
        </span>
        <span
          className="flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[10.5px] font-medium"
          style={{ background: 'var(--c-accent)', color: 'var(--c-accent-text)' }}
        >
          <Icon name="pause" size={12} fill />
          {bg ? 'Пауза' : 'Pause'}
        </span>
        <span
          className="grid h-8 w-8 place-items-center rounded-full"
          style={{ background: 'var(--c-surface)', border: '1px solid var(--c-line)', color: 'var(--c-muted)' }}
        >
          <Icon name="x" size={13} />
        </span>
      </div>

      <div className="mt-5 flex items-center gap-4 text-[9px] text-faint">
        <span>{bg ? '74 мин днес' : '74 min today'}</span>
        <span>·</span>
        <span>{bg ? 'цел 120 мин' : 'goal 120 min'}</span>
        <span>·</span>
        <span>{bg ? '12 дни поред' : '12-day streak'}</span>
      </div>
    </div>
  );
}

function StatsScene({ bg }: { bg: boolean }) {
  const subjects: [string, string, number, string][] = bg
    ? [
        ['Математика', '6 ч 20 мин', 0.9, 'var(--c-brand)'],
        ['Физика', '4 ч 05 мин', 0.58, 'var(--c-deep)'],
        ['Литература', '2 ч 40 мин', 0.38, 'var(--c-aurora)'],
        ['Английски', '1 ч 15 мин', 0.18, 'var(--c-ember)'],
      ]
    : [
        ['Maths', '6h 20m', 0.9, 'var(--c-brand)'],
        ['Physics', '4h 05m', 0.58, 'var(--c-deep)'],
        ['Literature', '2h 40m', 0.38, 'var(--c-aurora)'],
        ['English', '1h 15m', 0.18, 'var(--c-ember)'],
      ];

  const totals: [string, string, string][] = bg
    ? [
        ['14 ч 20 мин', 'Този месец', '+18%'],
        ['52 мин', 'Средно на ден', '+6%'],
        ['12', 'Дни поред', ''],
      ]
    : [
        ['14h 20m', 'This month', '+18%'],
        ['52 min', 'Daily average', '+6%'],
        ['12', 'Day streak', ''],
      ];

  return (
    <>
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[13px] font-semibold tracking-[-0.02em]">
          {bg ? 'Статистика' : 'Statistics'}
        </span>
        <span className="flex gap-1.5">
          {(bg ? ['Седмица', 'Месец', 'Година'] : ['Week', 'Month', 'Year']).map((l, i) => (
            <span
              key={l}
              className="rounded-[6px] px-2 py-0.5 text-[9.5px]"
              style={
                i === 1
                  ? { background: 'var(--c-accent-soft)', color: 'var(--c-accent)', fontWeight: 500 }
                  : { color: 'var(--c-muted)' }
              }
            >
              {l}
            </span>
          ))}
        </span>
      </div>

      <div className="mb-2.5 grid grid-cols-3 gap-2">
        {totals.map(([value, label, delta]) => (
          <Panel key={label} className="!p-2.5">
            <div className="text-[9.5px] text-faint">{label}</div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-[15px] font-semibold tracking-[-0.02em]">{value}</span>
              {delta && (
                <span className="text-[9px] font-medium" style={{ color: 'var(--c-success)' }}>
                  {delta}
                </span>
              )}
            </div>
          </Panel>
        ))}
      </div>

      <Panel className="mb-2.5">
        <Heading right={bg ? 'последните 7 дни' : 'the last 7 days'}>
          {bg ? 'Часове учене' : 'Hours studied'}
        </Heading>
        <WeekBars bg={bg} tall />
      </Panel>

      <Panel>
        <Heading right={bg ? 'този месец' : 'this month'}>{bg ? 'По предмет' : 'By subject'}</Heading>
        {subjects.map(([name, time, value, color]) => (
          <div key={name} className="mb-2 last:mb-0">
            <div className="mb-1 flex justify-between text-[9px]">
              <span className="text-muted">{name}</span>
              <span className="t-num">{time}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--c-surface-3)' }}>
              <span className="block h-full rounded-full" style={{ width: `${value * 100}%`, background: color }} />
            </div>
          </div>
        ))}
      </Panel>
    </>
  );
}

/** The week of bars, shared by the dashboard and the statistics scene. */
function WeekBars({ bg, tall }: { bg: boolean; tall?: boolean }) {
  const week = [0.35, 0.62, 0.28, 0.86, 0.5, 0.15, 0.72];
  const days = bg ? ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'нд'] : ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const max = tall ? 76 : 44;
  return (
    <div className="flex items-end gap-1.5" style={{ height: max + 14 }}>
      {week.map((v, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1">
          <span
            className="w-full rounded-t-[3px]"
            style={{
              height: `${v * max}px`,
              background:
                i === 6 ? 'var(--c-brand)' : 'color-mix(in srgb, var(--c-brand) 40%, var(--c-surface-3))',
            }}
          />
          <span className="text-[8px] text-faint">{days[i]}</span>
        </div>
      ))}
    </div>
  );
}

/** Every screen the public page can show a picture of. */
export type ShotKind =
  | 'calendar'
  | 'focus'
  | 'page'
  | 'tasks'
  | 'library'
  | 'cards'
  | 'exams'
  | 'goals'
  | 'stats';

/**
 * A small, self-contained mockup of one screen — the same trick as the big
 * shot, at a size that fits in a column.
 *
 * Nine of them now, because a visitor deciding whether to sign up is really
 * asking "what will I be looking at every day", and that question is answered
 * by pictures rather than by another paragraph. Every one is drawn from the
 * app's own tokens: they follow the visitor's theme, stay sharp on any
 * screen, and cannot quietly go out of date the way a folder of PNGs does the
 * first time a padding value changes.
 */
export function MiniShot({ kind, lang }: { kind: ShotKind; lang: Lang }) {
  const bg = lang === 'bg';

  if (kind === 'calendar') {
    const cells = Array.from({ length: 28 }, (_, i) => i);
    return (
      <Frame>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] font-semibold">{bg ? 'март 2026' : 'March 2026'}</span>
          <span className="flex gap-1">
            {[bg ? 'Месец' : 'Month', bg ? 'Седмица' : 'Week'].map((l, i) => (
              <span
                key={l}
                className="rounded-md px-1.5 py-0.5 text-[8.5px]"
                style={
                  i === 0
                    ? { background: 'var(--c-surface)', color: 'var(--c-text)', boxShadow: 'var(--shadow-sm)' }
                    : { color: 'var(--c-muted)' }
                }
              >
                {l}
              </span>
            ))}
          </span>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((i) => (
            <div
              key={i}
              className="rounded-[5px] p-1"
              style={{
                height: 30,
                background: i === 11 ? 'var(--c-accent-soft)' : 'var(--c-surface-2)',
                border: '1px solid var(--c-line)',
              }}
            >
              <span className="block text-[7.5px] text-faint">{i + 1}</span>
              {[3, 4, 11, 12, 18].includes(i) && (
                <span
                  className="mt-0.5 block h-[3px] rounded-full"
                  style={{
                    background: i === 11 ? 'var(--c-brand)' : i === 18 ? 'var(--c-warn)' : 'var(--c-aurora)',
                    width: '80%',
                  }}
                />
              )}
            </div>
          ))}
        </div>
      </Frame>
    );
  }

  if (kind === 'tasks') {
    const rows: [string, string, string, boolean][] = bg
      ? [
          ['Плати сметките', 'Дом', 'var(--c-brand)', true],
          ['Обади се на майстора', 'Дом', 'var(--c-ember)', false],
          ['Прочети 20 страници', 'Учене', 'var(--c-aurora)', false],
          ['Тренировка 45 мин', 'Здраве', 'var(--c-deep)', false],
        ]
      : [
          ['Pay the bills', 'Home', 'var(--c-brand)', true],
          ['Call the plumber', 'Home', 'var(--c-ember)', false],
          ['Read 20 pages', 'Study', 'var(--c-aurora)', false],
          ['Training, 45 min', 'Health', 'var(--c-deep)', false],
        ];
    return (
      <Frame>
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-[11px] font-semibold">{bg ? 'Днес' : 'Today'}</span>
          <span className="t-num text-[9.5px] text-faint">{bg ? '1 от 5 готови' : '1 of 5 done'}</span>
        </div>
        <div className="mb-2 flex gap-1">
          {(bg ? ['Днес', 'Просрочени', 'Предстоящи'] : ['Today', 'Overdue', 'Upcoming']).map((l, i) => (
            <span
              key={l}
              className="rounded-[5px] px-1.5 py-0.5 text-[8.5px]"
              style={
                i === 0
                  ? { background: 'var(--c-surface-3)', color: 'var(--c-text)' }
                  : { color: 'var(--c-muted)' }
              }
            >
              {l}
            </span>
          ))}
        </div>
        {rows.map(([title, subject, color, done], i) => (
          <div key={title} className="flex items-center gap-2 py-[6px]">
            <span
              className="grid h-[13px] w-[13px] shrink-0 place-items-center rounded-[4px] border"
              style={{
                borderColor: done ? 'var(--c-success)' : 'var(--c-line-strong)',
                background: done ? 'var(--c-success)' : 'transparent',
              }}
            >
              {done && <Icon name="check" size={9} strokeWidth={3} className="text-white" />}
            </span>
            <span
              className="min-w-0 flex-1 truncate text-[10.5px]"
              style={done ? { color: 'var(--c-faint)', textDecoration: 'line-through' } : undefined}
            >
              {title}
            </span>
            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />
            <span className="shrink-0 text-[8.5px] text-muted">{subject}</span>
            {i === 3 && (
              <span
                className="shrink-0 rounded-[4px] px-1 py-px text-[8px]"
                style={{ background: 'color-mix(in srgb, var(--c-danger) 13%, transparent)', color: 'var(--c-danger)' }}
              >
                {bg ? 'вчера' : 'yesterday'}
              </span>
            )}
          </div>
        ))}
      </Frame>
    );
  }

  if (kind === 'library') {
    const books: [string, string, number][] = bg
      ? [
          ['Математика 10.', 'var(--c-brand)', 0.62],
          ['Химия — сборник', 'var(--c-aurora)', 0.28],
          ['История, том 2', 'var(--c-ember)', 0.85],
          ['Дъска — задачи', 'var(--c-deep)', 0],
        ]
      : [
          ['Mathematics 10', 'var(--c-brand)', 0.62],
          ['Chemistry problems', 'var(--c-aurora)', 0.28],
          ['History, vol. 2', 'var(--c-ember)', 0.85],
          ['Board — problems', 'var(--c-deep)', 0],
        ];
    return (
      <Frame>
        <div className="mb-2 flex items-center gap-1.5">
          <Icon name="folder" size={11} className="text-faint" />
          <span className="text-[10px] text-muted">{bg ? 'Материали' : 'Materials'}</span>
          <span className="t-num ml-auto text-[9px] text-faint">{bg ? '12 материала' : '12 items'}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {books.map(([name, color, progress]) => (
            <div
              key={name}
              className="overflow-hidden rounded-[8px]"
              style={{ border: '1px solid var(--c-line)', background: 'var(--c-surface-2)' }}
            >
              <div
                className="grid place-items-center"
                style={{ height: 44, background: `color-mix(in srgb, ${color} 13%, transparent)`, color }}
              >
                <Icon name={progress === 0 ? 'board' : 'book'} size={18} strokeWidth={1.6} />
              </div>
              <div className="p-1.5">
                <div className="truncate text-[9.5px] font-medium">{name}</div>
                <div className="mt-1 h-[3px] overflow-hidden rounded-full" style={{ background: 'var(--c-surface-3)' }}>
                  <span
                    className="block h-full rounded-full"
                    style={{ width: `${progress * 100}%`, background: color }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </Frame>
    );
  }

  if (kind === 'cards') {
    const grades: [string, string][] = bg
      ? [
          ['Отново', 'var(--c-danger)'],
          ['Трудно', 'var(--c-warn)'],
          ['Добре', 'var(--c-aurora)'],
          ['Лесно', 'var(--c-brand)'],
        ]
      : [
          ['Again', 'var(--c-danger)'],
          ['Hard', 'var(--c-warn)'],
          ['Good', 'var(--c-aurora)'],
          ['Easy', 'var(--c-brand)'],
        ];
    return (
      <Frame>
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-[10px] text-muted">{bg ? 'Химия · Тесте 3' : 'Chemistry · Deck 3'}</span>
          <span className="t-num text-[9.5px] text-faint">12 / 34</span>
        </div>
        <div
          className="grid place-items-center rounded-[8px] px-3 text-center"
          style={{ minHeight: 96, background: 'var(--c-surface-2)', border: '1px solid var(--c-line)' }}
        >
          <span className="text-[12.5px] font-medium leading-snug">
            {bg ? 'Кое е условието за динамично равновесие?' : 'What is the condition for dynamic equilibrium?'}
          </span>
        </div>
        <div className="mt-2 grid grid-cols-4 gap-1">
          {grades.map(([label, color]) => (
            <span
              key={label}
              className="rounded-[6px] py-1 text-center text-[8.5px] font-medium"
              style={{ background: `color-mix(in srgb, ${color} 12%, transparent)`, color }}
            >
              {label}
            </span>
          ))}
        </div>
      </Frame>
    );
  }

  if (kind === 'exams') {
    const exams: [string, string, string, number][] = bg
      ? [
          ['6', 'Данъчна декларация', 'Финанси', 0.78],
          ['13', 'Изпит по физика', 'Учене', 0.41],
        ]
      : [
          ['6', 'Tax return', 'Money', 0.78],
          ['13', 'Physics exam', 'Study', 0.41],
        ];
    return (
      <Frame>
        <div className="mb-2 text-[10px] text-muted">{bg ? 'Предстоящи изпити' : 'Upcoming exams'}</div>
        {exams.map(([days, title, subject, ready], i) => (
          <div key={title} className={`flex items-center gap-2.5 ${i ? 'mt-2' : ''}`}>
            <span
              className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-[8px] text-center leading-none"
              style={{
                background: i === 0 ? 'color-mix(in srgb, var(--c-warn) 14%, transparent)' : 'var(--c-surface-2)',
                color: i === 0 ? 'var(--c-warn)' : 'var(--c-muted)',
                border: '1px solid var(--c-line)',
              }}
            >
              <span>
                <span className="t-num block text-[15px] font-semibold">{days}</span>
                <span className="mt-0.5 block text-[7px]">{bg ? 'дни' : 'days'}</span>
              </span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[10.5px] font-medium">{title}</span>
              <span className="block truncate text-[9px] text-muted">{subject}</span>
              <span className="mt-1 flex items-center gap-1.5">
                <span className="h-1 flex-1 overflow-hidden rounded-full" style={{ background: 'var(--c-surface-3)' }}>
                  <span
                    className="block h-full rounded-full"
                    style={{ width: `${ready * 100}%`, background: 'var(--c-aurora)' }}
                  />
                </span>
                <span className="t-num text-[8.5px] text-faint">
                  {Math.round(ready * 100)}% {bg ? 'готовност' : 'ready'}
                </span>
              </span>
            </span>
          </div>
        ))}
      </Frame>
    );
  }

  if (kind === 'goals') {
    const goals: [string, string, number, string][] = bg
      ? [
          ['30 часа за ремонта', '19 ч 50 мин от 30 ч', 0.66, 'var(--c-brand)'],
          ['12 тренировки този месец', '4 от 12 · изостава', 0.35, 'var(--c-warn)'],
          ['200 карти за срока', '188 от 200', 0.94, 'var(--c-aurora)'],
        ]
      : [
          ['30 hours on the flat', '19 h 50 min of 30 h', 0.66, 'var(--c-brand)'],
          ['12 workouts this month', '4 of 12 · behind', 0.35, 'var(--c-warn)'],
          ['200 cards by the deadline', '188 of 200', 0.94, 'var(--c-aurora)'],
        ];
    return (
      <Frame>
        <div className="mb-2 text-[10px] text-muted">{bg ? 'Цели' : 'Goals'}</div>
        {goals.map(([title, hint, value, color], i) => (
          <div key={title} className={i ? 'mt-3' : ''}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-[10.5px] font-medium">{title}</span>
              <span className="t-num shrink-0 text-[9.5px]" style={{ color }}>
                {Math.round(value * 100)}%
              </span>
            </div>
            <div className="mt-1.5 h-[5px] overflow-hidden rounded-full" style={{ background: 'var(--c-surface-3)' }}>
              <span className="block h-full rounded-full" style={{ width: `${value * 100}%`, background: color }} />
            </div>
            <div className="mt-1 text-[8.5px] text-faint">{hint}</div>
          </div>
        ))}
      </Frame>
    );
  }

  if (kind === 'stats') {
    const week = [0.35, 0.62, 0.28, 0.86, 0.5, 0.15, 0.72];
    const days = bg ? ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'нд'] : ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    const split: [string, number, string][] = bg
      ? [
          ['Работа', 0.46, 'var(--c-brand)'],
          ['Учене', 0.31, 'var(--c-aurora)'],
          ['Здраве', 0.23, 'var(--c-ember)'],
        ]
      : [
          ['Work', 0.46, 'var(--c-brand)'],
          ['Study', 0.31, 'var(--c-aurora)'],
          ['Health', 0.23, 'var(--c-ember)'],
        ];
    return (
      <Frame>
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-[10px] text-muted">{bg ? 'Тази седмица' : 'This week'}</span>
          <span className="t-num text-[11px] font-semibold">{bg ? '8 ч 40 мин' : '8 h 40 min'}</span>
        </div>
        <div className="flex h-[62px] items-end gap-1.5">
          {week.map((v, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <span
                className="w-full rounded-t-[3px]"
                style={{
                  height: `${v * 52}px`,
                  background: i === 6 ? 'var(--c-brand)' : 'color-mix(in srgb, var(--c-brand) 30%, transparent)',
                }}
              />
              <span className="text-[7.5px] text-faint">{days[i]}</span>
            </div>
          ))}
        </div>
        <div className="mt-2.5 border-t border-line pt-2">
          {split.map(([label, value, color]) => (
            <div key={label} className="mb-1.5 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />
              <span className="min-w-0 flex-1 truncate text-[9.5px] text-muted">{label}</span>
              <span className="t-num shrink-0 text-[9.5px]">{Math.round(value * 100)}%</span>
            </div>
          ))}
        </div>
      </Frame>
    );
  }

  if (kind === 'focus') {
    return (
      <Frame center>
        <div className="relative grid place-items-center py-4">
          <span
            className="pointer-events-none absolute h-40 w-40 rounded-full"
            style={{
              background: 'radial-gradient(circle, color-mix(in srgb, var(--c-brand) 22%, transparent), transparent 68%)',
            }}
          />
          <svg width={132} height={132} className="-rotate-90">
            <circle cx={66} cy={66} r={60} fill="none" stroke="var(--c-surface-3)" strokeWidth={4} />
            <circle
              cx={66}
              cy={66}
              r={60}
              fill="none"
              stroke="var(--c-brand)"
              strokeWidth={4}
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 60 * 0.68} ${2 * Math.PI * 60}`}
            />
          </svg>
          <span className="absolute text-center">
            <span className="block text-[26px] font-light tracking-[-0.04em]">17:24</span>
            <span className="mt-1 block text-[9.5px] text-muted">{bg ? 'Работа' : 'Focus'}</span>
          </span>
        </div>
        <div className="mt-1 text-center text-[10.5px] text-muted">
          {bg ? 'Работа · Дълбока сесия' : 'Work · Deep session'}
        </div>
      </Frame>
    );
  }

  return (
    <Frame>
      <div className="flex gap-2">
        <div
          className="relative flex-1 rounded-[8px] p-2"
          style={{ background: '#fff', minHeight: 150, boxShadow: 'var(--shadow-sm)' }}
        >
          {[92, 78, 86, 60, 88, 70].map((w, i) => (
            <span
              key={i}
              className="mb-1.5 block h-[5px] rounded-full"
              style={{ width: `${w}%`, background: '#e7e7ef' }}
            />
          ))}
          <span
            className="absolute left-3 top-[64px] block rounded-[6px]"
            style={{
              width: '62%',
              height: 44,
              border: '1.5px dashed var(--c-brand)',
              background: 'color-mix(in srgb, var(--c-brand) 8%, transparent)',
            }}
          />
          <svg viewBox="0 0 120 40" className="absolute bottom-4 left-4 w-[60%]">
            <path
              d="M4 30 C 20 6, 40 34, 58 18 S 96 6, 116 22"
              fill="none"
              stroke="var(--c-brand)"
              strokeWidth={2.2}
              strokeLinecap="round"
            />
          </svg>
        </div>
        <div className="w-[74px] shrink-0 space-y-1.5">
          {['calculator', 'flask', 'ruler', 'cards'].map((icon) => (
            <span
              key={icon}
              className="flex items-center gap-1.5 rounded-[6px] px-1.5 py-1 text-[8.5px] text-muted"
              style={{ background: 'var(--c-surface-2)', border: '1px solid var(--c-line)' }}
            >
              <Icon name={icon} size={11} />
            </span>
          ))}
        </div>
      </div>
    </Frame>
  );
}

function Frame({ children, center }: { children: React.ReactNode; center?: boolean }) {
  return (
    <div
      className={`overflow-hidden rounded-[12px] p-3 ${center ? 'grid place-items-center' : ''}`}
      style={{
        background: 'var(--c-surface)',
        border: '1px solid var(--c-line)',
        boxShadow: 'var(--shadow-panel)',
      }}
      aria-hidden
    >
      {children}
    </div>
  );
}
