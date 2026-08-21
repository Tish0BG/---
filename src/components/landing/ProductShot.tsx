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
    date: bg ? 'Вторник, 4 март' : 'Tuesday, 4 March',
    today: bg ? 'ЗА ДНЕС' : 'TODAY',
    week: bg ? 'ПОСЛЕДНИТЕ 7 ДНИ' : 'LAST 7 DAYS',
    subjects: bg ? 'ПО ПРЕДМЕТИ' : 'BY SUBJECT',
    stats: bg
      ? [
          ['74', 'мин днес'],
          ['12', 'дни поред'],
          ['23', 'карти'],
          ['4', 'задачи'],
        ]
      : [
          ['74', 'min today'],
          ['12', 'day streak'],
          ['23', 'cards due'],
          ['4', 'tasks'],
        ],
    tasks: bg
      ? ['Химия — упражнение 4', 'Математика — задачи 12–20', 'История — есе, чернова']
      : ['Chemistry — exercise 4', 'Maths — problems 12–20', 'History — essay draft'],
    subjectRows: bg
      ? [
          ['Математика', 0.82, 'var(--c-brand)'],
          ['Химия', 0.58, 'var(--c-aurora)'],
          ['История', 0.34, 'var(--c-ember)'],
        ]
      : [
          ['Maths', 0.82, 'var(--c-brand)'],
          ['Chemistry', 0.58, 'var(--c-aurora)'],
          ['History', 0.34, 'var(--c-ember)'],
        ],
    nav: bg
      ? ['Табло', 'Библиотека', 'Планер', 'Флашкарти', 'Статистика']
      : ['Dashboard', 'Library', 'Planner', 'Cards', 'Stats'],
  } as const;

  const week = [0.35, 0.6, 0.28, 0.85, 0.5, 0.15, 0.72];

  return (
    <div
      className="panel overflow-hidden"
      style={{ boxShadow: 'var(--shadow-float)', borderRadius: 16 }}
      aria-hidden
    >
      {/* window chrome */}
      <div
        className="flex h-9 items-center gap-2 border-b border-line px-3.5"
        style={{ background: 'var(--c-surface-2)' }}
      >
        <span className="flex gap-1.5">
          {['#f5675b', '#f6bd50', '#61c454'].map((c) => (
            <span key={c} className="h-2.5 w-2.5 rounded-full" style={{ background: c, opacity: 0.75 }} />
          ))}
        </span>
        <span
          className="mx-auto hidden rounded-md px-3 py-0.5 text-[10.5px] text-faint sm:block"
          style={{ background: 'var(--c-surface-3)' }}
        >
          plauvia.com
        </span>
      </div>

      <div className="flex" style={{ background: 'var(--c-bg)' }}>
        {/* rail */}
        <div
          className="hidden w-[164px] shrink-0 flex-col gap-1 border-r border-line p-3 sm:flex"
          style={{ background: 'var(--c-surface)' }}
        >
          <span className="mb-3 flex items-center gap-2">
            <PlauviaTile size={22} />
            <span className="text-[12px] font-semibold tracking-[-0.02em]">Plauvia</span>
          </span>
          {T.nav.map((label, i) => (
            <span
              key={label}
              className="flex h-7 items-center gap-2 rounded-lg px-2 text-[11px]"
              style={
                i === 0
                  ? { background: 'var(--c-accent-soft)', color: 'var(--c-brand)', fontWeight: 500 }
                  : { color: 'var(--c-muted)' }
              }
            >
              <Icon
                name={['dashboard', 'drive', 'calendarCheck', 'cards', 'barChart'][i]}
                size={13}
              />
              {label}
            </span>
          ))}
        </div>

        {/* content */}
        <div className="min-w-0 flex-1 p-4 sm:p-6">
          <div className="text-[17px] font-semibold tracking-[-0.02em] sm:text-[21px]">{T.greeting}</div>
          <div className="mt-0.5 text-[11px] text-muted">{T.date}</div>

          <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
            {T.stats.map(([value, label], i) => (
              <div key={label} className="panel p-2.5">
                <div className="flex items-center gap-2">
                  <span
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-lg"
                    style={{
                      background: `color-mix(in srgb, ${
                        ['var(--c-brand)', 'var(--c-ember)', 'var(--c-aurora)', 'var(--c-brand)'][i]
                      } 14%, transparent)`,
                      color: ['var(--c-brand)', 'var(--c-ember)', 'var(--c-aurora)', 'var(--c-brand)'][i],
                    }}
                  >
                    <Icon name={['timer', 'flame', 'cards', 'listTodo'][i]} size={13} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[15px] font-medium leading-none tabular-nums">{value}</span>
                    <span className="mt-0.5 block truncate text-[9.5px] text-muted">{label}</span>
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-2.5 grid gap-2.5 lg:grid-cols-[1.3fr_1fr]">
            <div className="panel p-3.5">
              <div className="label mb-2">{T.today}</div>
              <div className="space-y-1.5">
                {T.tasks.map((task, i) => (
                  <div key={task} className="flex items-center gap-2">
                    <span
                      className="h-3.5 w-3.5 shrink-0 rounded-full border"
                      style={{
                        borderColor: ['var(--c-brand)', 'var(--c-aurora)', 'var(--c-ember)'][i],
                      }}
                    />
                    <span className="truncate text-[11.5px]">{task}</span>
                  </div>
                ))}
              </div>

              <div className="label mb-2 mt-4">{T.week}</div>
              <div className="flex h-14 items-end gap-1.5">
                {week.map((h, i) => (
                  <span
                    key={i}
                    className="flex-1 rounded-t-[3px]"
                    style={{
                      height: `${Math.max(8, h * 100)}%`,
                      background: i === week.length - 1 ? 'var(--c-brand)' : 'var(--c-line-strong)',
                    }}
                  />
                ))}
              </div>
            </div>

            <div className="panel p-3.5">
              <div className="label mb-2.5">{T.subjects}</div>
              <div className="space-y-2.5">
                {T.subjectRows.map(([name, value, color]) => (
                  <div key={name as string}>
                    <div className="mb-1 flex justify-between text-[10.5px]">
                      <span>{name as string}</span>
                      <span className="tabular-nums text-muted">{Math.round((value as number) * 100)}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--c-surface-3)' }}>
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
