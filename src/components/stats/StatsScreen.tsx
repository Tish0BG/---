import { useMemo, useState } from 'react';
import { useWorkspace } from '@/state/workspaceStore';
import { useLibrary } from '@/state/libraryStore';
import { useApp } from '@/state/appStore';
import { useCards } from '@/state/cardStore';
import { usePlanner, averageFor } from '@/state/plannerStore';
import { useSettings } from '@/state/settingsStore';
import {
  dayKey,
  lastDays,
  minutesByDocument,
  minutesBySubject,
  statsForDay,
  streak,
  useTimer,
} from '@/state/timerStore';
import { Icon } from '../Icon';

const RANGES = [
  { days: 7, label: '7 дни' },
  { days: 30, label: '30 дни' },
  { days: 90, label: '3 месеца' },
];

/** The long view: how much, on what, and whether it is going anywhere. */
export function StatsScreen() {
  const sessions = useTimer((s) => s.sessions);
  const subjects = useWorkspace((s) => s.subjects);
  const documents = useLibrary((s) => s.documents);
  const cards = useCards((s) => s.cards);
  const grades = usePlanner((s) => s.grades);
  const goal = useSettings((s) => s.timer.goal);
  const [range, setRange] = useState(30);

  const days = useMemo(() => lastDays(sessions, range), [sessions, range]);
  const total = days.reduce((sum, d) => sum + d.minutes, 0);
  const active = days.filter((d) => d.minutes > 0).length;
  const max = Math.max(1, ...days.map((d) => d.minutes));
  const today = statsForDay(sessions, dayKey());
  const bySubject = useMemo(() => minutesBySubject(sessions, range), [sessions, range]);
  const byDoc = useMemo(() => minutesByDocument(sessions, range).slice(0, 6), [sessions, range]);
  const subjectTotal = bySubject.reduce((sum, r) => sum + r.minutes, 0);

  const cardStats = useMemo(() => {
    const now = Date.now();
    return {
      total: cards.length,
      due: cards.filter((c) => !c.suspended && c.due <= now).length,
      mature: cards.filter((c) => c.interval >= 21).length,
      young: cards.filter((c) => c.reps > 0 && c.interval < 21).length,
      fresh: cards.filter((c) => c.reps === 0).length,
    };
  }, [cards]);

  return (
    <div className="scroll-thin h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl px-5 py-6 sm:px-8">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight">Статистика</h1>
            <p className="mt-0.5 text-[13px] text-muted">Само това, което наистина си учил — без ръчно въвеждане.</p>
          </div>
          <div className="flex gap-0.5 rounded-lg p-0.5" style={{ background: 'var(--c-surface-3)' }}>
            {RANGES.map((r) => (
              <button
                key={r.days}
                onClick={() => setRange(r.days)}
                className={`cursor-pointer rounded-md px-2.5 py-1.5 text-[12px] transition-colors ${
                  range === r.days ? 'bg-surface font-medium shadow-[var(--shadow-panel)]' : 'text-muted'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Big value={`${Math.floor(total / 60)} ч ${total % 60} м`} label={`общо за ${range} дни`} icon="clock" />
          <Big
            value={`${Math.round(total / Math.max(1, active))} мин`}
            label="средно в активен ден"
            icon="target"
          />
          <Big value={`${streak(sessions)}`} label="дни поред" icon="flame" color="var(--c-warn)" />
          <Big
            value={`${today.minutes}/${goal}`}
            label="минути днес"
            icon="bolt"
            color={today.minutes >= goal ? 'var(--c-success)' : 'var(--c-accent)'}
          />
        </div>

        <section className="panel mb-4 p-4">
          <h2 className="mb-3 label">Активност</h2>
          <div className="flex h-[150px] items-end gap-[3px]">
            {days.map((d, i) => (
              <div key={d.day} className="group relative flex h-full flex-1 flex-col justify-end">
                <div
                  className="w-full rounded-sm transition-[height] duration-500"
                  style={{
                    height: `${Math.max(2, (d.minutes / max) * 100)}%`,
                    background:
                      i === days.length - 1
                        ? 'var(--c-focus)'
                        : d.minutes >= goal
                          ? 'var(--c-success)'
                          : 'var(--c-line-strong)',
                  }}
                  title={`${d.day}: ${d.minutes} мин`}
                />
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-[11px] text-muted">
            <span>преди {range} дни</span>
            <span>
              {active} активни дни · зелено = целта е изпълнена
            </span>
            <span>днес</span>
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="panel p-4">
            <h2 className="mb-3 label">По предмети</h2>
            {bySubject.length === 0 ? (
              <p className="py-6 text-center text-[12px] text-muted">
                Отбележи материалите си с предмет и това ще се напълни само.
              </p>
            ) : (
              <div className="space-y-2.5">
                {bySubject.map((row) => {
                  const subject = subjects.find((s) => s.id === row.subjectId);
                  if (!subject) return null;
                  const share = Math.round((row.minutes / Math.max(1, subjectTotal)) * 100);
                  const avg = averageFor(grades, subject.id);
                  return (
                    <button
                      key={row.subjectId}
                      onClick={() => useApp.getState().openSubject(subject.id)}
                      className="block w-full cursor-pointer text-left"
                    >
                      <div className="mb-1 flex items-center gap-2 text-[12px]">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: subject.color }} />
                        <span className="min-w-0 flex-1 truncate">{subject.name}</span>
                        {avg.count > 0 && (
                          <span className="shrink-0 tabular-nums text-faint">среден {avg.average.toFixed(2)}</span>
                        )}
                        <span className="shrink-0 tabular-nums text-muted">
                          {Math.floor(row.minutes / 60) ? `${Math.floor(row.minutes / 60)} ч ` : ''}
                          {row.minutes % 60} м
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                        <div
                          className="h-full rounded-full transition-[width] duration-500"
                          style={{ width: `${share}%`, background: subject.color }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section className="panel p-4">
            <h2 className="mb-3 label">Флашкарти</h2>
            <div className="mb-3 grid grid-cols-2 gap-2">
              <Mini value={cardStats.total} label="общо карти" />
              <Mini value={cardStats.due} label="за преговор" accent />
            </div>
            <div className="flex h-2 overflow-hidden rounded-full bg-surface-3">
              <span
                style={{ width: `${pct(cardStats.mature, cardStats.total)}%`, background: 'var(--c-success)' }}
              />
              <span style={{ width: `${pct(cardStats.young, cardStats.total)}%`, background: 'var(--c-accent)' }} />
              <span style={{ width: `${pct(cardStats.fresh, cardStats.total)}%`, background: 'var(--c-line-strong)' }} />
            </div>
            <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted">
              <Legend color="var(--c-success)" label={`научени ${cardStats.mature}`} />
              <Legend color="var(--c-accent)" label={`в процес ${cardStats.young}`} />
              <Legend color="var(--c-line-strong)" label={`нови ${cardStats.fresh}`} />
            </div>
          </section>

          {byDoc.length > 0 && (
            <section className="panel p-4 lg:col-span-2">
              <h2 className="mb-3 label">
                Най-много време по материали
              </h2>
              <div className="space-y-1">
                {byDoc.map((row) => {
                  const doc = documents.find((d) => d.id === row.docId);
                  if (!doc) return null;
                  const subject = subjects.find((s) => s.id === doc.subjectId);
                  return (
                    <div key={row.docId} className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5">
                      <Icon
                        name={doc.kind === 'board' ? 'board' : 'file'}
                        size={14}
                        className="shrink-0"
                        style={{ color: subject?.color ?? 'var(--c-faint)' }}
                      />
                      <span className="min-w-0 flex-1 truncate text-[13px]">{doc.name}</span>
                      <span className="shrink-0 text-[12px] tabular-nums text-muted">{row.minutes} мин</span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

const pct = (part: number, total: number) => (total ? (part / total) * 100 : 0);

function Big({
  value,
  label,
  icon,
  color = 'var(--c-accent)',
}: {
  value: string;
  label: string;
  icon: string;
  color?: string;
}) {
  return (
    <div className="panel flex items-center gap-3 p-3.5">
      <span
        className="grid h-11 w-11 shrink-0 place-items-center rounded-xl"
        style={{ background: `color-mix(in srgb, ${color} 14%, transparent)`, color }}
      >
        <Icon name={icon} size={19} />
      </span>
      <span className="min-w-0">
        <span className="block text-[18px] font-medium leading-none tabular-nums">{value}</span>
        <span className="mt-1 block text-[12px] text-muted">{label}</span>
      </span>
    </div>
  );
}

function Mini({ value, label, accent }: { value: number; label: string; accent?: boolean }) {
  return (
    <div className="rounded-lg py-2 text-center" style={{ background: 'var(--c-surface-2)' }}>
      <div
        className="text-[17px] font-medium leading-none tabular-nums"
        style={accent && value > 0 ? { color: 'var(--c-accent)' } : undefined}
      >
        {value}
      </div>
      <div className="mt-0.5 text-[11px] text-muted">{label}</div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}
