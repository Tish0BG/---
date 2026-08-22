import type { Lang } from '@/brand';
import { Icon } from '../Icon';
import { PlauviaTile } from '../brand/Logo';

/**
 * The product, shown rather than described.
 *
 * Built from the app's own tokens instead of a screenshot: it stays sharp at
 * any size, follows the visitor's theme, and — unlike a PNG — cannot quietly
 * go out of date the next time the dashboard changes.
 */
export function ProductShot({ lang }: { lang: Lang }) {
  const bg = lang === 'bg';
  const T = {
    greeting: bg ? 'Добър ден, Ана' : 'Good afternoon, Ana',
    date: bg ? 'вторник, 4 март · 3 за днес · изпит след 6 дни' : 'Tuesday, 4 March · 3 due today · exam in 6 days',
    level: bg ? 'Ниво 7 · Ерудит' : 'Level 7 · Scholar',
    streak: bg ? 'дни поред' : 'day streak',
    focus: bg ? 'Започни фокус' : 'Start focus',
    today: bg ? 'Днешният план' : "Today's plan",
    week: bg ? 'Тази седмица' : 'This week',
    exams: bg ? 'Предстоящи изпити' : 'Upcoming exams',
    stats: bg
      ? [
          ['74 мин', 'ДНЕС', 'var(--c-brand)'],
          ['12', 'СЕРИЯ', 'var(--c-ember)'],
          ['3 / 5', 'ЗАДАЧИ ДНЕС', 'var(--c-aurora)'],
          ['23', 'ЗА ПРЕГОВОР', 'var(--c-deep)'],
        ]
      : [
          ['74 min', 'TODAY', 'var(--c-brand)'],
          ['12', 'STREAK', 'var(--c-ember)'],
          ['3 / 5', 'TASKS TODAY', 'var(--c-aurora)'],
          ['23', 'TO REVIEW', 'var(--c-deep)'],
        ],
    plan: bg
      ? [
          ['09:00', 'Математика', 'каб. 24', 'var(--c-brand)'],
          ['11:30', 'Химия', 'каб. 12', 'var(--c-aurora)'],
          ['', 'Задачи 12–20', 'Математика', 'var(--c-brand)'],
          ['', 'Есе — чернова', 'История', 'var(--c-ember)'],
        ]
      : [
          ['09:00', 'Mathematics', 'room 24', 'var(--c-brand)'],
          ['11:30', 'Chemistry', 'room 12', 'var(--c-aurora)'],
          ['', 'Problems 12–20', 'Mathematics', 'var(--c-brand)'],
          ['', 'Essay — draft', 'History', 'var(--c-ember)'],
        ],
    examRows: bg
      ? [
          ['6', 'Контролно по алгебра', 'Математика'],
          ['13', 'Класно по физика', 'Физика'],
        ]
      : [
          ['6', 'Algebra test', 'Mathematics'],
          ['13', 'Physics exam', 'Physics'],
        ],
    nav: bg
      ? ['Табло', 'Задачи', 'Календар', 'Цели', 'Изпити', 'Библиотека', 'Фокус', 'Статистика']
      : ['Dashboard', 'Tasks', 'Calendar', 'Goals', 'Exams', 'Library', 'Focus', 'Statistics'],
    subjects: bg ? ['Математика', 'Химия', 'История'] : ['Mathematics', 'Chemistry', 'History'],
  } as const;

  const NAV_ICONS = ['dashboard', 'listTodo', 'calendar', 'target', 'graduation', 'drive', 'timer', 'chartLine'];
  const week = [0.35, 0.62, 0.28, 0.86, 0.5, 0.15, 0.72];
  const days = bg ? ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'нд'] : ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  return (
    <div
      className="overflow-hidden rounded-[18px]"
      style={{
        background: 'var(--c-surface)',
        border: '1px solid var(--c-line)',
        boxShadow: 'var(--shadow-float)',
      }}
      aria-hidden
    >
      {/* window chrome */}
      <div
        className="flex h-9 items-center gap-2 border-b border-line px-3"
        style={{ background: 'var(--c-surface-2)' }}
      >
        <span className="flex gap-1.5">
          {['#f87171', '#fbbf24', '#34d399'].map((c) => (
            <span key={c} className="h-[9px] w-[9px] rounded-full" style={{ background: c, opacity: 0.75 }} />
          ))}
        </span>
        <span
          className="mx-auto rounded-md px-3 py-0.5 text-[10.5px] text-faint"
          style={{ background: 'var(--c-surface-3)' }}
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

          {T.nav.map((label, i) => (
            <span
              key={label}
              className="mb-0.5 flex items-center gap-2 rounded-[8px] px-2 py-[5px] text-[11px]"
              style={
                i === 0
                  ? { background: 'var(--c-accent-soft)', color: 'var(--c-accent)', fontWeight: 600 }
                  : { color: 'var(--c-muted)' }
              }
            >
              <Icon name={NAV_ICONS[i]} size={13} />
              {label}
              {i === 1 && (
                <span
                  className="ml-auto rounded-full px-1 text-[9px] font-semibold"
                  style={{ background: 'var(--c-surface-3)' }}
                >
                  5
                </span>
              )}
            </span>
          ))}

          <div className="mt-3 px-2 text-[8.5px] font-semibold uppercase tracking-[0.08em] text-faint">
            {bg ? 'Предмети' : 'Subjects'}
          </div>
          {T.subjects.map((s, i) => (
            <span key={s} className="flex items-center gap-2 px-2 py-[5px] text-[10.5px] text-muted">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: ['var(--c-brand)', 'var(--c-aurora)', 'var(--c-ember)'][i] }}
              />
              {s}
            </span>
          ))}

          <div className="mt-auto flex items-center gap-2 rounded-[10px] p-1.5" style={{ background: 'var(--c-surface-2)' }}>
            <span
              className="grid h-6 w-6 place-items-center rounded-full text-[11px]"
              style={{ background: 'color-mix(in srgb, var(--c-brand) 18%, transparent)' }}
            >
              🦊
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[10.5px] font-semibold">Ана</span>
              <span className="block truncate text-[9px] text-muted">{T.level}</span>
            </span>
          </div>
        </div>

        {/* ---------------------------------------------------------- content */}
        <div className="min-w-0 flex-1 p-3 sm:p-4" style={{ background: 'var(--c-bg)' }}>
          {/* hero band */}
          <div
            className="relative overflow-hidden rounded-[14px] p-3.5"
            style={{ background: 'var(--c-surface)', border: '1px solid var(--c-line)' }}
          >
            <span
              className="pointer-events-none absolute -right-10 -top-16 h-40 w-40 rounded-full opacity-25 blur-2xl"
              style={{ background: 'var(--grad-brand)' }}
            />
            <div className="relative flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="text-[16px] font-semibold tracking-[-0.02em]">{T.greeting}</div>
                <div className="mt-0.5 text-[10.5px] text-muted">{T.date}</div>
              </div>
              <span
                className="rounded-[8px] px-2.5 py-1 text-[10.5px] font-semibold text-white"
                style={{ background: 'var(--grad-brand)' }}
              >
                {T.focus}
              </span>
            </div>
            <div className="relative mt-3 flex items-center gap-3">
              <div className="flex-1">
                <div className="mb-1 flex justify-between text-[9px] text-muted">
                  <span>{T.level}</span>
                  <span>640 / 900 XP</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--c-surface-3)' }}>
                  <span className="block h-full w-[71%] rounded-full" style={{ background: 'var(--grad-brand)' }} />
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
          </div>

          {/* stat row */}
          <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {T.stats.map(([value, label, color]) => (
              <div
                key={label}
                className="rounded-[12px] p-2.5"
                style={{ background: 'var(--c-surface)', border: '1px solid var(--c-line)' }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[8.5px] font-semibold uppercase tracking-[0.07em] text-faint">{label}</span>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
                </div>
                <div className="mt-1.5 text-[15px] font-semibold tracking-[-0.02em]">{value}</div>
              </div>
            ))}
          </div>

          <div className="mt-2.5 grid gap-2.5 lg:grid-cols-[1.5fr_1fr]">
            {/* today */}
            <div
              className="rounded-[12px] p-3"
              style={{ background: 'var(--c-surface)', border: '1px solid var(--c-line)' }}
            >
              <div className="mb-2 text-[10.5px] font-semibold">{T.today}</div>
              {T.plan.map(([time, title, meta, color], i) => (
                <div key={i} className="flex items-center gap-2 py-[5px]">
                  <span className="w-[30px] shrink-0 text-right text-[9px] text-faint">{time}</span>
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />
                  <span className="min-w-0 flex-1 truncate text-[10.5px]">{title}</span>
                  <span className="shrink-0 text-[9px] text-muted">{meta}</span>
                </div>
              ))}

              <div className="mt-2 border-t border-line pt-2.5">
                <div className="mb-1.5 text-[10.5px] font-semibold">{T.week}</div>
                <div className="flex h-[52px] items-end gap-1.5">
                  {week.map((v, i) => (
                    <div key={i} className="flex flex-1 flex-col items-center gap-1">
                      <span
                        className="w-full rounded-t-[3px]"
                        style={{
                          height: `${v * 44}px`,
                          background:
                            i === 6
                              ? 'var(--c-brand)'
                              : 'color-mix(in srgb, var(--c-brand) 40%, var(--c-surface-3))',
                        }}
                      />
                      <span className="text-[8px] text-faint">{days[i]}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* exams */}
            <div
              className="rounded-[12px] p-3"
              style={{ background: 'var(--c-surface)', border: '1px solid var(--c-line)' }}
            >
              <div className="mb-2 text-[10.5px] font-semibold">{T.exams}</div>
              {T.examRows.map(([days_, title, subject]) => (
                <div key={title} className="flex items-center gap-2 py-1.5">
                  <span
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] text-[12px] font-semibold"
                    style={{
                      background: 'color-mix(in srgb, var(--c-brand) 12%, transparent)',
                      color: 'var(--c-brand)',
                    }}
                  >
                    {days_}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[10.5px] font-medium">{title}</span>
                    <span className="block truncate text-[9px] text-muted">{subject}</span>
                  </span>
                </div>
              ))}

              <div className="mt-2 border-t border-line pt-2.5">
                <div className="mb-1.5 text-[10.5px] font-semibold">{bg ? 'Цели' : 'Goals'}</div>
                {[
                  [bg ? 'Математика — 20 часа' : 'Maths — 20 hours', 0.62, 'var(--c-brand)'],
                  [bg ? '40 задачи по физика' : '40 physics problems', 0.35, 'var(--c-aurora)'],
                ].map(([label, value, color]) => (
                  <div key={label as string} className="mb-2">
                    <div className="mb-1 flex justify-between text-[9px]">
                      <span className="truncate text-muted">{label}</span>
                      <span>{Math.round((value as number) * 100)}%</span>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full" style={{ background: 'var(--c-surface-3)' }}>
                      <span
                        className="block h-full rounded-full"
                        style={{ width: `${(value as number) * 100}%`, background: color as string }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * A small, self-contained mockup used beside each showcase block — the same
 * trick as the big shot, at a size that fits in a column.
 */
export function MiniShot({ kind, lang }: { kind: 'calendar' | 'focus' | 'page'; lang: Lang }) {
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
            <span className="mt-1 block text-[9.5px] text-muted">{bg ? 'Учене' : 'Focus'}</span>
          </span>
        </div>
        <div className="mt-1 text-center text-[10.5px] text-muted">
          {bg ? 'Математика · Задачи 12–20' : 'Mathematics · Problems 12–20'}
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
              className="flex items-center gap-1.5 rounded-[7px] px-1.5 py-1 text-[8.5px] text-muted"
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
      className={`overflow-hidden rounded-[14px] p-3 ${center ? 'grid place-items-center' : ''}`}
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
