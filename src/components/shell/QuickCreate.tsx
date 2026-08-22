import { useEffect, useMemo, useState } from 'react';
import { useApp, type QuickKind } from '@/state/appStore';
import { useWorkspace } from '@/state/workspaceStore';
import { usePlanner, startOfDay, addDays, DAY_NAMES } from '@/state/plannerStore';
import { useGoals } from '@/state/goalStore';
import { useGame, gameContext } from '@/state/gameStore';
import { notify } from '@/state/toastStore';
import { METRIC_ICON, METRIC_LABEL, METRIC_UNIT } from '@/services/goalService';
import type { GoalMetric, PlannerItem } from '@/types';
import { useT, L, useLang } from '@/i18n';
import { S, PRIORITY } from '@/i18n/strings';
import { Modal, Select } from '../ui';
import { Button, Segmented, Sheet, useIsPhone } from '../kit';
import { Icon } from '../Icon';

const KIND_TITLE: Record<Exclude<QuickKind, null>, { bg: string; en: string }> = {
  task: { bg: 'Нова задача', en: 'New task' },
  exam: { bg: 'Нов изпит', en: 'New exam' },
  goal: { bg: 'Нова цел', en: 'New goal' },
  event: { bg: 'Нов час в програмата', en: 'New timetable slot' },
};

/**
 * One create dialog for the whole product.
 *
 * Making a task, an exam, a goal or a lesson used to mean finding the right
 * screen first. Here the kind is a switch at the top, the fields follow it,
 * and ⌘↵ saves — so capturing something takes about as long as thinking of it.
 */
export function QuickCreate() {
  const kind = useApp((s) => s.quick);
  const phone = useIsPhone();
  const t = useT();
  const close = () => useApp.getState().setQuick(null);

  if (!kind) return null;
  const body = <QuickForm kind={kind} onDone={close} />;
  const title = t(KIND_TITLE[kind]);

  return phone ? (
    <Sheet open onClose={close} title={title}>
      {body}
    </Sheet>
  ) : (
    <Modal open onClose={close} title={title} width={520}>
      {body}
    </Modal>
  );
}

function QuickForm({ kind, onDone }: { kind: Exclude<QuickKind, null>; onDone: () => void }) {
  const t = useT();
  const lang = useLang();
  const allSubjects = useWorkspace((s) => s.subjects);
  const subjects = useMemo(() => allSubjects.filter((x) => !x.archived), [allSubjects]);
  const filterSubject = useApp((s) => s.filterSubjectId);

  const [title, setTitle] = useState('');
  const [subjectId, setSubjectId] = useState<string | null>(filterSubject);
  const [due, setDue] = useState<string>(kind === 'exam' ? isoDay(addDays(7)) : '');
  const [priority, setPriority] = useState<0 | 1 | 2>(kind === 'exam' ? 1 : 0);
  const [notes, setNotes] = useState('');
  /* goals */
  const [metric, setMetric] = useState<GoalMetric>('minutes');
  const [target, setTarget] = useState(600);
  /* timetable */
  const [day, setDay] = useState(new Date().getDay() || 1);
  const [start, setStart] = useState('08:00');
  const [end, setEnd] = useState('08:45');

  const subjectOptions = useMemo(
    () => [
      { value: '', label: t(S.noSubject) },
      ...subjects.map((s) => ({ value: s.id, label: s.name, color: s.color })),
    ],
    [subjects, t],
  );

  const canSave = kind === 'event' ? !!subjectId : title.trim().length > 0;

  const save = async () => {
    if (!canSave) return;
    if (kind === 'goal') {
      const goals = useGoals.getState();
      await goals.add(
        {
          title: title.trim(),
          subjectId,
          metric,
          target: Math.max(1, target),
          deadline: due ? startOfDay(new Date(due)) : null,
        },
        gameContext(),
      );
      notify.ok(t(L('Целта е създадена', 'Goal created')));
    } else if (kind === 'event') {
      await usePlanner.getState().addSlot({ subjectId: subjectId ?? '', day, start, end });
      notify.ok(t(L('Часът е добавен в програмата', 'Added to your timetable')));
    } else {
      const patch: Partial<PlannerItem> = {
        kind: kind === 'exam' ? 'exam' : 'task',
        title: title.trim(),
        notes,
        subjectId,
        priority,
        due: due ? startOfDay(new Date(due)) : null,
      };
      await usePlanner.getState().addItem(patch);
      notify.ok(kind === 'exam' ? t(L('Изпитът е добавен', 'Exam added')) : t(L('Задачата е добавена', 'Task added')));
    }
    void useGame.getState().refresh();
    onDone();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        void save();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  return (
    <div className="space-y-4">
      {kind !== 'event' && (
        <div>
          <label className="t-label mb-1.5 block">
            {kind === 'goal' ? t(L('Какво искаш да постигнеш?', 'What do you want to reach?')) : t(L('Какво трябва да се направи?', 'What needs doing?'))}
          </label>
          <input
            autoFocus
            className="field field-lg"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={
              kind === 'exam'
                ? t(L('Контролно по алгебра', 'Algebra test'))
                : kind === 'goal'
                  ? t(L('20 часа математика този месец', '20 hours of maths this month'))
                  : t(L('Реши задачи 12–20', 'Solve problems 12–20'))
            }
          />
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="t-label mb-1.5 block">{t(S.subject)}</label>
          <Select
            value={subjectId ?? ''}
            options={subjectOptions}
            width={240}
            onChange={(v) => setSubjectId(v || null)}
            placeholder={t(S.noSubject)}
          />
        </div>

        {kind !== 'event' && (
          <div>
            <label className="t-label mb-1.5 block">
              {kind === 'goal' ? t(S.deadline) : kind === 'exam' ? t(L('Дата', 'Date')) : t(L('Срок', 'Due'))}
            </label>
            <input
              type="date"
              className="field"
              value={due}
              onChange={(e) => setDue(e.target.value)}
            />
            <div className="mt-1.5 flex flex-wrap gap-1">
              {[
                { label: t(S.today), value: isoDay(new Date()) },
                { label: t(L('Утре', 'Tomorrow')), value: isoDay(addDays(1)) },
                { label: t(L('След седмица', 'Next week')), value: isoDay(addDays(7)) },
              ].map((chip) => (
                <button
                  key={chip.value}
                  onClick={() => setDue(chip.value)}
                  className={`chip cursor-pointer transition-colors ${
                    due === chip.value ? 'btn-ghost-active' : 'hover:bg-surface-3'
                  }`}
                  style={due === chip.value ? undefined : { background: 'var(--c-surface-2)', color: 'var(--c-muted)' }}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {kind === 'task' || kind === 'exam' ? (
        <div>
          <label className="t-label mb-1.5 block">{t(S.priority)}</label>
          <Segmented
            value={String(priority)}
            onChange={(v) => setPriority(Number(v) as 0 | 1 | 2)}
            items={[
              { id: '0', label: t(PRIORITY[0]) },
              { id: '1', label: t(PRIORITY[1]) },
              { id: '2', label: t(PRIORITY[2]) },
            ]}
          />
        </div>
      ) : null}

      {kind === 'goal' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="t-label mb-1.5 block">{t(L('Измерва се в', 'Measured in'))}</label>
            <Select
              value={metric}
              width={240}
              options={(['minutes', 'tasks', 'cards', 'pages', 'custom'] as GoalMetric[]).map((m) => ({
                value: m,
                label: t(METRIC_LABEL[m]),
                icon: METRIC_ICON[m],
              }))}
              onChange={(v) => {
                const next = v as GoalMetric;
                setMetric(next);
                setTarget(next === 'minutes' ? 600 : next === 'cards' ? 200 : next === 'pages' ? 150 : 20);
              }}
            />
          </div>
          <div>
            <label className="t-label mb-1.5 block">{t(L('Цел', 'Target'))}</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                className="field t-num"
                value={target}
                onChange={(e) => setTarget(Number(e.target.value))}
              />
              <span className="shrink-0 text-[12.5px] text-muted">{t(METRIC_UNIT[metric])}</span>
            </div>
          </div>
        </div>
      )}

      {kind === 'event' && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="t-label mb-1.5 block">{t(L('Ден', 'Day'))}</label>
            <Select
              value={String(day)}
              width={200}
              options={[1, 2, 3, 4, 5, 6, 0].map((d) => ({
                value: String(d),
                label:
                  lang === 'bg'
                    ? DAY_NAMES[d]
                    : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d],
              }))}
              onChange={(v) => setDay(Number(v))}
            />
          </div>
          <div>
            <label className="t-label mb-1.5 block">{t(L('От', 'From'))}</label>
            <input type="time" className="field t-num" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div>
            <label className="t-label mb-1.5 block">{t(L('До', 'To'))}</label>
            <input type="time" className="field t-num" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
        </div>
      )}

      {kind === 'task' && (
        <div>
          <label className="t-label mb-1.5 block">{t(L('Бележки', 'Notes'))}</label>
          <textarea
            className="field h-20 resize-none py-2"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t(L('По желание', 'Optional'))}
          />
        </div>
      )}

      <div className="flex items-center justify-between gap-3 pt-1">
        <span className="hidden items-center gap-1.5 text-[11.5px] text-faint sm:flex">
          <kbd className="kbd">⌘</kbd>
          <kbd className="kbd">↵</kbd>
          {t(L('за запис', 'to save'))}
        </span>
        <div className="ml-auto flex gap-2">
          <Button onClick={onDone}>{t(S.cancel)}</Button>
          <Button variant="primary" icon="check" disabled={!canSave} onClick={() => void save()}>
            {t(S.create)}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** `YYYY-MM-DD` in local time — `toISOString` would shift the day in +03. */
export function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Small helper shared by the screens: a chip that shows an icon and a count. */
export function QuickHint({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-muted">
      <Icon name={icon} size={13} />
      {children}
    </span>
  );
}
