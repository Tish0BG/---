import { useMemo, useState } from 'react';
import type { Grade } from '@/types';
import { useApp } from '@/state/appStore';
import { useWorkspace } from '@/state/workspaceStore';
import { useLibrary, progressOf } from '@/state/libraryStore';
import { useCards, dueCount } from '@/state/cardStore';
import { useSettings } from '@/state/settingsStore';
import {
  usePlanner,
  averageFor,
  neededForTarget,
  openItems,
  sortByDue,
  toMinutes,
} from '@/state/plannerStore';
import { minutesBySubject, useTimer } from '@/state/timerStore';
import { formatDate } from '@/lib/util';
import { Icon } from '../Icon';
import { useConfirm } from '../ui';
import { DueChip } from '../planner/DueChip';
import { useT, useLang, tr, L, formatDuration, weekdayNames, type Msg } from '@/i18n';
import { S } from '@/i18n/strings';
import { Button, Card, EmptyState, Tabs } from '../kit';
import { openDoc } from '@/services/openDoc';

type Tab = 'overview' | 'materials' | 'grades' | 'schedule';

const TABS: { id: Tab; label: Msg; icon: string }[] = [
  { id: 'overview', label: L('Преглед', 'Overview'), icon: 'dashboard' },
  { id: 'materials', label: L('Материали', 'Materials'), icon: 'drive' },
  { id: 'grades', label: L('Оценки', 'Grades'), icon: 'trophy' },
  { id: 'schedule', label: L('Часове', 'Classes'), icon: 'calendar' },
];

/** Everything about one subject in one place. */
export function SubjectDetail({ id }: { id: string }) {
  const t = useT();
  const lang = useLang();
  const subject = useWorkspace((s) => s.subject(id));
  const documents = useLibrary((s) => s.documents);
  const items = usePlanner((s) => s.items);
  const grades = usePlanner((s) => s.grades);
  const schedule = usePlanner((s) => s.schedule);
  const cards = useCards((s) => s.cards);
  const sessions = useTimer((s) => s.sessions);
  const [tab, setTab] = useState<Tab>('overview');

  const materials = useMemo(
    () => documents.filter((d) => d.subjectId === id && !d.deletedAt),
    [documents, id],
  );
  const work = useMemo(() => sortByDue(openItems(items).filter((i) => i.subjectId === id)), [items, id]);
  const subjectCards = useMemo(() => cards.filter((c) => c.subjectId === id), [cards, id]);
  const slots = useMemo(
    () => schedule.filter((s) => s.subjectId === id).sort((a, b) => a.day - b.day || toMinutes(a.start) - toMinutes(b.start)),
    [schedule, id],
  );
  const avg = averageFor(grades, id);
  const minutes = minutesBySubject(sessions, 30).find((r) => r.subjectId === id)?.minutes ?? 0;

  if (!subject) {
    return (
      <div className="grid h-full place-items-center text-muted">
        <Button variant="outline" icon="arrowLeft" onClick={() => useApp.getState().go('subjects')}>
          {t(L('Предметът не съществува — назад', 'That subject is gone — go back'))}
        </Button>
      </div>
    );
  }

  return (
    <div className="scroll-thin h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl px-5 py-6 sm:px-8">
        <button
          className="mb-3 flex cursor-pointer items-center gap-1 text-[12px] text-muted hover:text-ink"
          onClick={() => useApp.getState().go('subjects')}
        >
          <Icon name="chevronLeft" size={13} />
          {t(L('Всички предмети', 'All subjects'))}
        </button>

        <header className="mb-5 flex flex-wrap items-center gap-3">
          <span
            className="grid h-14 w-14 shrink-0 place-items-center rounded-[12px]"
            style={{ background: `color-mix(in srgb, ${subject.color} 15%, transparent)`, color: subject.color }}
          >
            <Icon name={subject.icon} size={26} />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="t-h1 truncate">{subject.name}</h1>
            <p className="mt-1 text-[13px] text-muted">
              {[
                subject.teacher,
                t(L(`${materials.length} материала`, `${materials.length} materials`)),
                t(L(`${subjectCards.length} карти`, `${subjectCards.length} cards`)),
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
          {avg.count > 0 && (
            <div className="text-right">
              <div className="t-num text-[28px] font-semibold leading-none" style={{ color: subject.color }}>
                {avg.average.toFixed(2)}
              </div>
              <div className="text-[11px] text-muted">{t(L('среден успех', 'average'))}</div>
            </div>
          )}
        </header>

        <Tabs
          className="mb-4"
          value={tab}
          onChange={setTab}
          items={TABS.map((item) => ({ id: item.id, label: t(item.label), icon: item.icon }))}
        />

        {tab === 'overview' && (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title={t(S.tasks)} icon="listTodo">
              {work.length === 0 ? (
                <p className="py-4 text-center text-[12.5px] text-muted">
                  {t(L('Няма отворени задачи.', 'No open tasks.'))}
                </p>
              ) : (
                <div className="space-y-0.5">
                  {work.slice(0, 6).map((item) => (
                    <div key={item.id} className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 hover:bg-surface-2">
                      <button
                        onClick={() => void usePlanner.getState().toggleItem(item.id)}
                        className="h-[17px] w-[17px] shrink-0 cursor-pointer rounded-full border"
                        style={{ borderColor: subject.color }}
                        aria-label={t(S.done)}
                      />
                      <span className="min-w-0 flex-1 truncate text-[13px]">{item.title}</span>
                      {item.due !== null && <DueChip due={item.due} />}
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card title={t(L('Учене', 'Studying'))} icon="timer">
              <div className="grid grid-cols-2 gap-2">
                <Stat value={formatDuration(minutes, lang)} label={t(L('за 30 дни', 'in 30 days'))} />
                <Stat value={String(dueCount(subjectCards))} label={t(L('карти за днес', 'cards due'))} />
              </div>
              <Button
                variant="primary"
                icon="brain"
                block
                className="mt-3"
                disabled={!dueCount(subjectCards)}
                onClick={() => {
                  const deck = subjectCards[0]?.deck ?? null;
                  useCards.getState().startReview(deck);
                  useApp.getState().go('cards');
                }}
              >
                {t(L('Учи картите', 'Review the cards'))}
              </Button>
            </Card>

            {slots.length > 0 && (
              <Card className="lg:col-span-2" title={t(L('Часове през седмицата', 'Classes this week'))} icon="calendar">
                <div className="flex flex-wrap gap-1.5">
                  {slots.map((s) => (
                    <span
                      key={s.id}
                      className="chip"
                      style={{ background: `color-mix(in srgb, ${subject.color} 12%, transparent)`, color: subject.color }}
                    >
                      {weekdayNames(lang)[(s.day + 6) % 7]} {s.start}–{s.end}
                      {s.room ? ` · ${s.room}` : ''}
                    </span>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}

        {tab === 'materials' && (
          <div className="space-y-1.5">
            {materials.length === 0 ? (
              <Card>
                <EmptyState
                  compact
                  icon="drive"
                  title={t(L('Няма материали с този предмет', 'No materials tagged with this subject'))}
                  body={t(L('Отбележи ги от библиотеката и се появяват тук.', 'Tag them in the library and they show up here.'))}
                  action={{ label: t(S.library), icon: 'arrowRight', onClick: () => useApp.getState().go('drive') }}
                />
              </Card>
            ) : (
              materials.map((d) => (
                <button
                  key={d.id}
                  onClick={() => void openDoc(d.id)}
                  className="card flex w-full cursor-pointer items-center gap-3 p-3 text-left transition-colors hover:bg-surface-2"
                >
                  <Icon
                    name={d.kind === 'board' ? 'board' : 'file'}
                    size={17}
                    className="shrink-0"
                    style={{ color: subject.color }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium">{d.name}</span>
                    <span className="block text-[11px] text-muted">
                      {Math.round(progressOf(d) * 100)}% · {formatDate(d.openedAt)}
                    </span>
                  </span>
                  <span className="h-1 w-20 shrink-0 overflow-hidden rounded-full bg-surface-3">
                    <span
                      className="block h-full rounded-full"
                      style={{ width: `${progressOf(d) * 100}%`, background: subject.color }}
                    />
                  </span>
                </button>
              ))
            )}
          </div>
        )}

        {tab === 'grades' && <GradesTab subjectId={id} color={subject.color} />}
        {tab === 'schedule' && <ScheduleTab subjectId={id} color={subject.color} />}
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-lg py-2.5 text-center" style={{ background: 'var(--c-surface-2)' }}>
      <div className="text-[17px] font-medium leading-none tabular-nums">{value}</div>
      <div className="mt-1 text-[11px] text-muted">{label}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ grades */

const WEIGHTS: { value: number; label: Msg }[] = [
  { value: 1, label: L('Текуща', 'Ordinary') },
  { value: 2, label: L('Контролно', 'Test') },
  { value: 3, label: L('Изпит', 'Exam') },
];

function GradesTab({ subjectId, color }: { subjectId: string; color: string }) {
  const t = useT();
  // Select the raw array and narrow it in a memo: a selector that filters
  // hands React a new array on every render and spins forever.
  const all = usePlanner((s) => s.grades);
  const grades = useMemo(() => all.filter((g) => g.subjectId === subjectId), [all, subjectId]);
  const scale = useSettings((s) => s.gradeScale);
  const { confirm, element } = useConfirm();
  const [label, setLabel] = useState('');
  const [value, setValue] = useState(scale.max);
  const [weight, setWeight] = useState(1);
  const [target, setTarget] = useState(5);

  const sorted = useMemo(() => [...grades].sort((a, b) => b.date - a.date), [grades]);
  const avg = averageFor(grades, subjectId);
  const needed = neededForTarget(grades, subjectId, target, 2, scale.max);

  const add = () => {
    void usePlanner.getState().addGrade({
      subjectId,
      label: label.trim() || t(L('Оценка', 'Grade')),
      value,
      weight,
    });
    setLabel('');
  };

  return (
    <div className="space-y-4">
      {element}
      <Card title={t(L('Нова оценка', 'New grade'))} icon="plus">
        <div className="flex flex-wrap items-end gap-2">
          <label className="min-w-[140px] flex-1">
            <span className="t-label mb-1 block">{t(L('За какво', 'What for'))}</span>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && add()}
              placeholder={t(L('напр. Контролно 2', 'e.g. Test 2'))}
              className="field"
            />
          </label>
          <label>
            <span className="t-label mb-1 block">{t(L('Оценка', 'Grade'))}</span>
            <div className="flex gap-1">
              {range(scale.min, scale.max).map((n) => (
                <button
                  key={n}
                  onClick={() => setValue(n)}
                  className="h-8 w-8 cursor-pointer rounded-lg text-[13px] font-medium transition-colors"
                  style={
                    value === n
                      ? { background: color, color: '#fff' }
                      : { background: 'var(--c-surface-2)', color: 'var(--c-muted)' }
                  }
                >
                  {n}
                </button>
              ))}
            </div>
          </label>
          <label>
            <span className="t-label mb-1 block">{t(L('Тежест', 'Weight'))}</span>
            <div className="flex gap-1">
              {WEIGHTS.map((w) => (
                <button
                  key={w.value}
                  onClick={() => setWeight(w.value)}
                  className={`btn ${weight === w.value ? 'btn-ghost-active' : 'btn-outline'}`}
                >
                  {t(w.label)}
                </button>
              ))}
            </div>
          </label>
          <Button variant="primary" icon="plus" onClick={add}>
            {t(S.add)}
          </Button>
        </div>
      </Card>

      {avg.count > 0 && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[12px] text-muted">
                {t(L(`Среден успех от ${avg.count} оценки`, `Average of ${avg.count} grades`))}
              </div>
              <div className="t-num text-[30px] font-semibold leading-tight" style={{ color }}>
                {avg.average.toFixed(2)}
              </div>
            </div>
            <div className="text-right text-[12px]">
              <div className="mb-1 flex items-center gap-1.5">
                <span className="text-muted">{t(L('Целя се на', 'Aiming for'))}</span>
                {range(scale.pass, scale.max).map((n) => (
                  <button
                    key={n}
                    onClick={() => setTarget(n)}
                    className="h-6 w-6 cursor-pointer rounded text-[12px] transition-colors"
                    style={
                      target === n
                        ? { background: color, color: '#fff' }
                        : { background: 'var(--c-surface-2)', color: 'var(--c-muted)' }
                    }
                  >
                    {n}
                  </button>
                ))}
              </div>
              <div className="text-muted">
                {needed === null
                  ? t(L('Целта е постигната.', 'Target reached.'))
                  : needed > scale.max
                    ? t(L('Няма как да стане само с една оценка.', 'One more grade cannot get you there.'))
                    : t(
                        L(
                          `Трябва ти ${needed.toFixed(2)} на следващото контролно.`,
                          `You need ${needed.toFixed(2)} on the next test.`,
                        ),
                      )}
              </div>
            </div>
          </div>
        </Card>
      )}

      <div className="space-y-1">
        {sorted.length === 0 ? (
          <Card>
            <EmptyState
              compact
              icon="trophy"
              title={t(L('Още няма оценки', 'No grades yet'))}
              body={t(L('Добави първата и средният успех се смята сам.', 'Add the first one and the average takes care of itself.'))}
            />
          </Card>
        ) : (
          sorted.map((g) => <GradeRow key={g.id} grade={g} color={color} confirm={confirm} />)
        )}
      </div>
    </div>
  );
}

function GradeRow({
  grade,
  color,
  confirm,
}: {
  grade: Grade;
  color: string;
  confirm: (m: string, cb: () => void) => void;
}) {
  return (
    <div className="group flex items-center gap-3 rounded-lg px-2.5 py-2 transition-colors hover:bg-surface-2">
      <span
        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[15px] font-semibold tabular-nums"
        style={{ background: `color-mix(in srgb, ${color} 14%, transparent)`, color }}
      >
        {grade.value}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px]">{grade.label}</span>
        <span className="block text-[11px] text-muted">
          {tr(WEIGHTS.find((w) => w.value === grade.weight)?.label ?? L('', ''))} · {formatDate(grade.date)}
        </span>
      </span>
      <button
        className="icon-btn h-7 w-7 opacity-0 group-hover:opacity-100"
        onClick={() =>
          confirm(tr(L('Да изтрия ли оценката?', 'Delete this grade?')), () =>
            void usePlanner.getState().removeGrade(grade.id),
          )
        }
      >
        <Icon name="trash" size={14} />
      </button>
    </div>
  );
}

const range = (from: number, to: number): number[] =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);

/* --------------------------------------------------------------- schedule */

function ScheduleTab({ subjectId, color }: { subjectId: string; color: string }) {
  const t = useT();
  const lang = useLang();
  const all = usePlanner((s) => s.schedule);
  const slots = useMemo(
    () =>
      all
        .filter((x) => x.subjectId === subjectId)
        .sort((a, b) => a.day - b.day || toMinutes(a.start) - toMinutes(b.start)),
    [all, subjectId],
  );
  const [day, setDay] = useState(1);
  const [start, setStart] = useState('08:00');
  const [end, setEnd] = useState('08:45');
  const [room, setRoom] = useState('');

  return (
    <div className="space-y-4">
      <section className="panel p-4">
        <h2 className="t-label mb-2.5">{t(L('Добави час', 'Add a class'))}</h2>
        <div className="flex flex-wrap items-end gap-2">
          <label>
            <span className="t-label mb-1 block">{t(L('Ден', 'Day'))}</span>
            <select value={day} onChange={(e) => setDay(Number(e.target.value))} className="field w-32">
              {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                <option key={d} value={d}>
                  {weekdayNames(lang, 'long')[(d + 6) % 7]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="t-label mb-1 block">{t(L('От', 'From'))}</span>
            <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="field w-28" />
          </label>
          <label>
            <span className="t-label mb-1 block">{t(L('До', 'To'))}</span>
            <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="field w-28" />
          </label>
          <label className="min-w-[100px] flex-1">
            <span className="t-label mb-1 block">{t(L('Кабинет', 'Room'))}</span>
            <input value={room} onChange={(e) => setRoom(e.target.value)} className="field" />
          </label>
          <button
            className="btn btn-primary"
            onClick={() => {
              void usePlanner.getState().addSlot({ subjectId, day, start, end, room: room.trim() });
              setRoom('');
            }}
          >
            <Icon name="plus" size={15} />
            {t(S.add)}
          </button>
        </div>
      </section>

      <div className="space-y-1">
        {slots.length === 0 ? (
          <p className="py-10 text-center text-[13px] text-faint">
            {t(L('Няма записани часове.', 'No classes yet.'))}
          </p>
        ) : (
          slots.map((s) => (
            <div
              key={s.id}
              className="group flex items-center gap-3 rounded-lg px-2.5 py-2 transition-colors hover:bg-surface-2"
            >
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
              <span className="w-28 shrink-0 text-[13px]">{weekdayNames(lang, 'long')[(s.day + 6) % 7]}</span>
              <span className="flex-1 text-[13px] tabular-nums text-muted">
                {s.start}–{s.end}
                {s.room ? ` · ${s.room}` : ''}
              </span>
              <button
                className="icon-btn h-7 w-7 opacity-0 group-hover:opacity-100"
                onClick={() => void usePlanner.getState().removeSlot(s.id)}
              >
                <Icon name="trash" size={14} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
