import { useMemo, useState } from 'react';
import type { DocumentMeta } from '@/types';
import { useApp } from '@/state/appStore';
import { SUBJECT_COLORS, SUGGESTED_SUBJECTS, useWorkspace } from '@/state/workspaceStore';
import { progressOf, useLibrary } from '@/state/libraryStore';
import { useViewer } from '@/state/viewerStore';
import { useCards, dueCount } from '@/state/cardStore';
import {
  usePlanner,
  currentClass,
  dueToday,
  overdue,
  sortByDue,
  toMinutes,
  upcomingExams,
  daysUntil,
} from '@/state/plannerStore';
import {
  dayKey,
  lastDays,
  minutesBySubject,
  statsForDay,
  streak,
  useTimer,
} from '@/state/timerStore';
import { useSettings } from '@/state/settingsStore';
import { Icon } from '../Icon';
import { Ring } from '../timer/Ring';
import { DueChip } from '../planner/DueChip';
import { SubjectDot } from '../subjects/SubjectDot';

/**
 * The screen the app opens on: what is happening now, what is due, and how
 * the week is going. Everything here is a shortcut into somewhere else —
 * the dashboard answers "what should I do next" and then gets out of the way.
 */
export function Dashboard({ onNewBoard, onUpload }: { onNewBoard: () => void; onUpload: () => void }) {
  const profile = useWorkspace((s) => s.profile);
  const subjects = useWorkspace((s) => s.subjects);
  const documents = useLibrary((s) => s.documents);
  const items = usePlanner((s) => s.items);
  const schedule = usePlanner((s) => s.schedule);
  const sessions = useTimer((s) => s.sessions);
  const cards = useCards((s) => s.cards);
  const goal = useSettings((s) => s.timer.goal);

  const today = useMemo(() => statsForDay(sessions, dayKey()), [sessions]);
  const week = useMemo(() => lastDays(sessions), [sessions]);
  const days = useMemo(() => streak(sessions), [sessions]);
  const due = useMemo(() => dueCount(cards), [cards]);
  const todayWork = useMemo(() => sortByDue([...overdue(items), ...dueToday(items)]), [items]);
  const exams = useMemo(() => upcomingExams(items, 45).slice(0, 3), [items]);
  const now = useMemo(() => currentClass(schedule), [schedule]);
  const bySubject = useMemo(() => minutesBySubject(sessions, 7).slice(0, 5), [sessions]);

  const recent = useMemo(
    () =>
      documents
        .filter((d) => d.openedAt && !d.deletedAt)
        .sort((a, b) => (b.openedAt ?? 0) - (a.openedAt ?? 0))
        .slice(0, 4),
    [documents],
  );

  const maxWeek = Math.max(1, ...week.map((d) => d.minutes));
  const goalPct = Math.min(1, today.minutes / Math.max(1, goal));

  return (
    <div className="scroll-thin h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl px-5 py-6 sm:px-8 sm:py-8">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1
              className="font-semibold leading-[1.1]"
              style={{ fontSize: 'var(--text-title)', letterSpacing: 'var(--track-title)' }}
            >
              {greeting()}
              {profile.name ? (
                <>
                  , <span style={{ color: profile.color }}>{profile.name}</span>
                </>
              ) : null}
            </h1>
            <p className="mt-1 text-[13px] text-muted">{longDate()}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-outline h-9" onClick={onUpload}>
              <Icon name="upload" size={15} />
              Качи материал
            </button>
            <button className="btn btn-outline h-9" onClick={onNewBoard}>
              <Icon name="board" size={15} />
              Нова дъска
            </button>
            <button
              className="btn btn-primary h-9"
              onClick={() => {
                useCards.getState().startReview(null);
                useApp.getState().go('cards');
              }}
              disabled={!due}
            >
              <Icon name="brain" size={15} />
              Учи {due > 0 ? `(${due})` : ''}
            </button>
          </div>
        </header>

        {/* ------------------------------------------------------ top row */}
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="panel flex items-center gap-3 p-3.5">
            <Ring progress={goalPct} size={54} stroke={7} color="var(--c-focus)">
              <span className="text-[11px] font-medium tabular-nums">{Math.round(goalPct * 100)}%</span>
            </Ring>
            <div className="min-w-0">
              <div className="text-[19px] font-medium leading-none tabular-nums">
                {today.minutes}
                <span className="ml-1 text-[12px] font-normal text-muted">от {goal} мин</span>
              </div>
              <div className="mt-1 text-[12px] text-muted">
                {today.sessions ? `${today.sessions} сесии днес` : 'още не си започнал днес'}
              </div>
            </div>
          </div>

          <Tile
            icon="flame"
            color="var(--c-warn)"
            value={String(days)}
            label={days === 1 ? 'ден поред' : 'дни поред'}
          />
          <Tile
            icon="cards"
            color="var(--c-accent)"
            value={String(due)}
            label="карти за преговор"
            onClick={() => useApp.getState().go('cards')}
          />
          <Tile
            icon="listTodo"
            color={todayWork.length ? 'var(--c-danger)' : 'var(--c-success)'}
            value={String(todayWork.length)}
            label="задачи за днес"
            onClick={() => useApp.getState().go('planner')}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
          {/* --------------------------------------------------- left column */}
          <div className="space-y-4">
            {recent.length > 0 && (
              <Card title="Продължи оттам" action={{ label: 'Библиотека', onClick: () => useApp.getState().go('drive') }}>
                <div className="grid gap-2 sm:grid-cols-2">
                  {recent.map((d) => (
                    <ContinueCard key={d.id} doc={d} />
                  ))}
                </div>
              </Card>
            )}

            <Card
              title="За днес"
              action={{ label: 'Планер', onClick: () => useApp.getState().go('planner') }}
            >
              {todayWork.length === 0 ? (
                <Empty icon="checkCircle" text="Нищо не гори. Чист график за днес." />
              ) : (
                <div className="space-y-0.5">
                  {todayWork.slice(0, 6).map((t) => {
                    const subject = subjects.find((s) => s.id === t.subjectId) ?? null;
                    return (
                      <div
                        key={t.id}
                        className="group flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-surface-2"
                      >
                        <button
                          onClick={() => void usePlanner.getState().toggleItem(t.id)}
                          className="h-[17px] w-[17px] shrink-0 cursor-pointer rounded-full border transition-colors hover:bg-surface-3"
                          style={{ borderColor: subject?.color ?? 'var(--c-line-strong)' }}
                          aria-label="Готово"
                        />
                        <span className="min-w-0 flex-1 truncate text-[13px]">{t.title}</span>
                        {subject && <SubjectDot subject={subject} />}
                        {t.due !== null && <DueChip due={t.due} />}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            <Card title="Последните 7 дни">
              <div className="flex h-[120px] items-end gap-2">
                {week.map((d, i) => (
                  <div key={d.day} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                    <span className="text-[10px] tabular-nums text-faint">{d.minutes || ''}</span>
                    <div
                      className="w-full rounded-md transition-[height] duration-500"
                      style={{
                        height: `${Math.max(4, (d.minutes / maxWeek) * 100)}%`,
                        background: i === week.length - 1 ? 'var(--c-focus)' : 'var(--c-line-strong)',
                      }}
                    />
                    <span className="text-[11px] text-muted">{d.label}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* -------------------------------------------------- right column */}
          <div className="space-y-4">
            {now && (
              <Card title={now.now ? 'Сега' : 'Следващ час'}>
                <ClassRow slot={now.slot} live={now.now} />
              </Card>
            )}

            {exams.length > 0 && (
              <Card title="Предстоящи изпити">
                <div className="space-y-1.5">
                  {exams.map((e) => {
                    const subject = subjects.find((s) => s.id === e.subjectId) ?? null;
                    const left = e.due ? daysUntil(e.due) : 0;
                    return (
                      <div key={e.id} className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5">
                        <span
                          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[14px] font-semibold tabular-nums"
                          style={{
                            background: `color-mix(in srgb, ${subject?.color ?? 'var(--c-accent)'} 14%, transparent)`,
                            color: subject?.color ?? 'var(--c-accent)',
                          }}
                        >
                          {left}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13px]">{e.title}</div>
                          <div className="truncate text-[11px] text-muted">
                            {subject?.name ?? 'без предмет'} · {left <= 0 ? 'днес' : `след ${left} дни`}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}

            {bySubject.length > 0 && (
              <Card
                title="Тази седмица по предмети"
                action={{ label: 'Всички', onClick: () => useApp.getState().go('subjects') }}
              >
                <div className="space-y-2">
                  {bySubject.map((row) => {
                    const subject = subjects.find((s) => s.id === row.subjectId);
                    if (!subject) return null;
                    const max = bySubject[0].minutes || 1;
                    return (
                      <button
                        key={row.subjectId}
                        onClick={() => useApp.getState().openSubject(subject.id)}
                        className="block w-full cursor-pointer text-left"
                      >
                        <div className="mb-1 flex items-center justify-between text-[12px]">
                          <span className="truncate">{subject.name}</span>
                          <span className="shrink-0 tabular-nums text-muted">
                            {Math.floor(row.minutes / 60) ? `${Math.floor(row.minutes / 60)} ч ` : ''}
                            {row.minutes % 60} мин
                          </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                          <div
                            className="h-full rounded-full transition-[width] duration-500"
                            style={{ width: `${(row.minutes / max) * 100}%`, background: subject.color }}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </Card>
            )}

            {subjects.length === 0 ? (
              <FirstRun onUpload={onUpload} />
            ) : (
              bySubject.length === 0 &&
              !now &&
              exams.length === 0 && <NextSteps schedule={schedule.length} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * What the old welcome wizard used to ask, moved to where it belongs: inside
 * the app, after the door, and skippable. Nothing here blocks anything — the
 * dashboard is already usable, this only saves the first few clicks.
 */
function FirstRun({ onUpload }: { onUpload: () => void }) {
  const [picked, setPicked] = useState<string[]>(() => SUGGESTED_SUBJECTS.slice(0, 5).map((s) => s.name));
  const [busy, setBusy] = useState(false);

  return (
    <Card title="Започни оттук">
      <p className="mb-3 text-[12.5px] leading-relaxed text-muted">
        Предметите са оста на всичко останало — материалите, картите, задачите и статистиката се
        подреждат по тях. Избери своите:
      </p>

      <div className="flex flex-wrap gap-1.5">
        {SUGGESTED_SUBJECTS.map((s, i) => {
          const on = picked.includes(s.name);
          const c = SUBJECT_COLORS[i % SUBJECT_COLORS.length];
          return (
            <button
              key={s.name}
              onClick={() => setPicked((p) => (on ? p.filter((x) => x !== s.name) : [...p, s.name]))}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] transition-colors"
              style={{
                background: on ? `color-mix(in srgb, ${c} 16%, transparent)` : 'var(--c-surface-2)',
                color: on ? c : 'var(--c-muted)',
                outline: on ? `1px solid ${c}` : '1px solid var(--c-line)',
              }}
            >
              <Icon name={on ? 'check' : s.icon} size={13} />
              {s.name}
            </button>
          );
        })}
      </div>

      <button
        className="btn btn-primary mt-3 w-full"
        disabled={!picked.length || busy}
        onClick={() => {
          setBusy(true);
          void useWorkspace
            .getState()
            .createSubjects(picked)
            .finally(() => setBusy(false));
        }}
      >
        {busy ? <Icon name="refresh" size={15} className="animate-spin" /> : <Icon name="plus" size={15} />}
        Добави {picked.length} {picked.length === 1 ? 'предмет' : 'предмета'}
      </button>

      <div className="mt-2 flex gap-2">
        <button className="btn btn-outline flex-1" onClick={onUpload}>
          <Icon name="upload" size={14} />
          Качи учебник
        </button>
        <button className="btn btn-outline flex-1" onClick={() => useApp.getState().go('subjects')}>
          <Icon name="sliders" size={14} />
          Ръчно
        </button>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ pieces */

function Card({
  title,
  action,
  children,
}: {
  title: string;
  action?: { label: string; onClick: () => void };
  children: React.ReactNode;
}) {
  return (
    <section className="panel p-4">
      <div className="mb-2.5 flex items-center justify-between">
        <h2 className="label">{title}</h2>
        {action && (
          <button className="cursor-pointer text-[12px] text-accent hover:underline" onClick={action.onClick}>
            {action.label}
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

function Tile({
  icon,
  color,
  value,
  label,
  onClick,
}: {
  icon: string;
  color: string;
  value: string;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`panel flex items-center gap-3 p-3.5 text-left ${onClick ? 'panel-hover cursor-pointer' : ''}`}
    >
      <span
        className="grid h-11 w-11 shrink-0 place-items-center rounded-xl"
        style={{ background: `color-mix(in srgb, ${color} 14%, transparent)`, color }}
      >
        <Icon name={icon} size={19} />
      </span>
      <span className="min-w-0">
        <span className="block text-[19px] font-medium leading-none tabular-nums">{value}</span>
        <span className="mt-1 block text-[12px] text-muted">{label}</span>
      </span>
    </button>
  );
}

function ContinueCard({ doc }: { doc: DocumentMeta }) {
  const subject = useWorkspace((s) => s.subject(doc.subjectId));
  const pct = Math.round(progressOf(doc) * 100);
  return (
    <button
      onClick={() => void useViewer.getState().openDocument(doc.id)}
      className="panel-hover flex cursor-pointer items-center gap-3 rounded-xl border border-line p-2.5 text-left"
    >
      {doc.cover ? (
        <img
          src={doc.cover}
          alt=""
          className="h-14 w-11 shrink-0 rounded bg-white object-cover"
          style={{ boxShadow: 'var(--shadow-sm)' }}
        />
      ) : (
        <span className="grid h-14 w-11 shrink-0 place-items-center rounded bg-surface-2">
          <Icon name={doc.kind === 'board' ? 'board' : 'file'} size={17} className="text-faint" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium">{doc.name}</span>
        <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted">
          {subject && <SubjectDot subject={subject} />}
          стр. {doc.lastPage}
        </span>
        <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-surface-3">
          <span
            className="block h-full rounded-full"
            style={{ width: `${pct}%`, background: subject?.color ?? 'var(--c-accent)' }}
          />
        </span>
      </span>
    </button>
  );
}

function ClassRow({ slot, live }: { slot: { subjectId: string; start: string; end: string; room: string }; live: boolean }) {
  const subject = useWorkspace((s) => s.subject(slot.subjectId));
  const minutes = new Date().getHours() * 60 + new Date().getMinutes();
  const span = toMinutes(slot.end) - toMinutes(slot.start);
  const progress = live ? Math.min(1, Math.max(0, (minutes - toMinutes(slot.start)) / Math.max(1, span))) : 0;

  return (
    <div className="flex items-center gap-3">
      <Ring progress={live ? 1 - progress : 1} size={44} stroke={6} color={subject?.color ?? 'var(--c-accent)'}>
        <Icon name={subject?.icon ?? 'book'} size={16} style={{ color: subject?.color }} />
      </Ring>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-medium">{subject?.name ?? 'Час'}</div>
        <div className="text-[12px] text-muted">
          {slot.start}–{slot.end}
          {slot.room ? ` · каб. ${slot.room}` : ''}
          {live ? ` · остават ${Math.max(0, toMinutes(slot.end) - minutes)} мин` : ''}
        </div>
      </div>
    </div>
  );
}

function Empty({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-5 text-center">
      <Icon name={icon} size={22} className="text-faint" />
      <p className="max-w-xs text-[12px] leading-relaxed text-muted">{text}</p>
    </div>
  );
}

/**
 * Shown while the right column has nothing real to say yet — the three things
 * that make the rest of the dashboard come alive.
 */
function NextSteps({ schedule }: { schedule: number }) {
  const steps = [
    {
      icon: 'layers',
      label: 'Отбележи материалите с предмет',
      hint: 'от библиотеката, с десен бутон или чрез избор',
      go: () => useApp.getState().go('drive'),
    },
    {
      icon: 'calendar',
      label: schedule ? 'Допълни разписанието' : 'Въведи разписанието си',
      hint: 'таблото показва текущия и следващия час',
      go: () => useApp.getState().go('planner'),
    },
    {
      icon: 'timer',
      label: 'Пусни таймера, докато учиш',
      hint: 'времето се записва към отворения материал',
      go: () => useTimer.getState().toggleWidget(),
    },
  ];
  return (
    <Card title="Оттук нататък">
      <div className="space-y-1">
        {steps.map((s) => (
          <button
            key={s.label}
            onClick={s.go}
            className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-1.5 py-2 text-left transition-colors hover:bg-surface-2"
          >
            <Icon name={s.icon} size={16} className="shrink-0 text-accent" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px]">{s.label}</span>
              <span className="block truncate text-[11px] text-muted">{s.hint}</span>
            </span>
            <Icon name="chevronRight" size={14} className="shrink-0 text-faint" />
          </button>
        ))}
      </div>
    </Card>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Още си буден';
  if (h < 11) return 'Добро утро';
  if (h < 18) return 'Добър ден';
  return 'Добър вечер';
}

function longDate(): string {
  const s = new Date().toLocaleDateString('bg-BG', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  return s.charAt(0).toUpperCase() + s.slice(1);
}
