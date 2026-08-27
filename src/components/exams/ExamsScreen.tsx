import { useEffect, useMemo, useRef, useState } from 'react';
import type { PlannerItem } from '@/types';
import { useApp } from '@/state/appStore';
import { useWorkspace } from '@/state/workspaceStore';
import { useLibrary } from '@/state/libraryStore';
import { useCards } from '@/state/cardStore';
import { usePlanner, daysUntil, openItems, sortByDue } from '@/state/plannerStore';
import { useTimer } from '@/state/timerStore';
import { useT, L, useLang, formatDate, formatDuration } from '@/i18n';
import { S } from '@/i18n/strings';
import { Section } from '../shell/Screen';
import { Icon } from '../Icon';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ProgressBar,
  ProgressRing,
  Tabs,
} from '../kit';
import { TaskRow } from '../tasks/TaskRow';
import { openDoc } from '@/services/openDoc';

/**
 * Exams, with the only two questions that matter: how long is left, and how
 * ready are you.
 *
 * Readiness is not a slider anyone sets — it is computed from the work that
 * exists for the subject: tasks due before the exam that are already ticked,
 * cards in the deck that are not overdue, and hours logged since the exam was
 * put in. A preparation bar you fill in by hand measures optimism.
 */
export function ExamsScreen({ embedded }: { embedded?: boolean } = {}) {
  const t = useT();
  const items = usePlanner((s) => s.items);
  const focusId = useApp((s) => s.focusId);
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const [openId, setOpenId] = useState<string | null>(null);
  const refs = useRef(new Map<string, HTMLDivElement>());

  const exams = useMemo(() => items.filter((i) => i.kind === 'exam'), [items]);
  const upcoming = useMemo(
    () => sortByDue(exams.filter((e) => !e.done && (e.due ?? Infinity) >= new Date().setHours(0, 0, 0, 0))),
    [exams],
  );
  const past = useMemo(
    () =>
      exams
        .filter((e) => e.done || (e.due ?? 0) < new Date().setHours(0, 0, 0, 0))
        .sort((a, b) => (b.due ?? 0) - (a.due ?? 0)),
    [exams],
  );

  useEffect(() => {
    if (!focusId) return;
    setOpenId(focusId);
    const node = refs.current.get(focusId);
    node?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    useApp.getState().clearFocus();
  }, [focusId, upcoming.length]);

  const list = tab === 'upcoming' ? upcoming : past;
  const next = upcoming[0];

  return (
    <Section
      embedded={embedded}
      title={t(S.exams)}
      subtitle={
        next?.due != null
          ? t(
              L(
                `Следващият е ${next.title} — след ${Math.max(0, daysUntil(next.due))} дни.`,
                `Next up: ${next.title} — in ${Math.max(0, daysUntil(next.due))} days.`,
              ),
            )
          : t(L('Нищо не е насрочено.', 'Nothing scheduled.'))
      }
      actions={
        <Button variant="primary" icon="plus" onClick={() => useApp.getState().setQuick('item', 'exam')}>
          {t(L('Нов изпит', 'New exam'))}
        </Button>
      }
      toolbar={
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { id: 'upcoming', label: t(L('Предстоящи', 'Upcoming')), icon: 'graduation', count: upcoming.length },
            { id: 'past', label: t(L('Минали', 'Past')), icon: 'history', count: past.length },
          ]}
        />
      }
    >
      {list.length === 0 ? (
        <Card>
          <EmptyState
            icon="graduation"
            title={tab === 'upcoming' ? t(L('Няма насрочени изпити', 'No exams scheduled')) : t(L('Няма минали изпити', 'No past exams'))}
            body={t(
              L(
                'Добави изпит и получаваш обратно броене, готовност по предмета и всичко свързано с него на едно място.',
                'Add an exam and you get a countdown, a readiness read-out, and everything connected to it in one place.',
              ),
            )}
            action={
              tab === 'upcoming'
                ? { label: t(L('Добави изпит', 'Add exam')), icon: 'plus', onClick: () => useApp.getState().setQuick('item', 'exam') }
                : undefined
            }
          />
        </Card>
      ) : (
        <div className="stagger space-y-4">
          {list.map((exam) => (
            <div
              key={exam.id}
              ref={(node) => {
                if (node) refs.current.set(exam.id, node);
              }}
            >
              <ExamCard
                exam={exam}
                open={openId === exam.id}
                onToggle={() => setOpenId(openId === exam.id ? null : exam.id)}
              />
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

/* ------------------------------------------------------------------ card */

function ExamCard({ exam, open, onToggle }: { exam: PlannerItem; open: boolean; onToggle: () => void }) {
  const t = useT();
  const lang = useLang();
  const subjects = useWorkspace((s) => s.subjects);
  const items = usePlanner((s) => s.items);
  const sessions = useTimer((s) => s.sessions);
  const cards = useCards((s) => s.cards);
  const documents = useLibrary((s) => s.documents);

  const subject = subjects.find((s) => s.id === exam.subjectId) ?? null;
  const color = subject?.color ?? 'var(--c-brand)';
  const days = exam.due !== null ? daysUntil(exam.due) : null;
  const urgent = days !== null && days <= 3 && !exam.done;

  /* ------------------------------------------------------- readiness */
  const related = useMemo(
    () =>
      items.filter(
        (i) =>
          i.id !== exam.id &&
          i.kind !== 'exam' &&
          i.subjectId === exam.subjectId &&
          (exam.due === null || i.due === null || i.due <= exam.due),
      ),
    [items, exam],
  );
  const relatedDone = related.filter((i) => i.done).length;

  const minutes = useMemo(
    () =>
      sessions
        .filter((s) => s.subjectId === exam.subjectId && s.startedAt >= exam.createdAt)
        .reduce((sum, s) => sum + s.minutes, 0),
    [sessions, exam],
  );

  const deck = useMemo(() => cards.filter((c) => c.subjectId === exam.subjectId), [cards, exam.subjectId]);
  const deckKnown = deck.filter((c) => c.reps > 0 && c.due > Date.now()).length;

  const materials = useMemo(
    () => documents.filter((d) => !d.deletedAt && d.subjectId === exam.subjectId).slice(0, 4),
    [documents, exam.subjectId],
  );

  /**
   * Three signals, averaged over the ones that exist: ticked work, cards in
   * good standing, and hours put in against a rough four-hour expectation.
   */
  const signals: number[] = [];
  if (related.length) signals.push(relatedDone / related.length);
  if (deck.length) signals.push(deckKnown / deck.length);
  signals.push(Math.min(1, minutes / 240));
  const readiness = signals.reduce((a, b) => a + b, 0) / signals.length;

  return (
    <Card flush className={urgent ? 'ring-1' : ''} style={urgent ? { boxShadow: `0 0 0 1px color-mix(in srgb, var(--c-danger) 35%, transparent), var(--shadow-panel)` } : undefined}>
      <button onClick={onToggle} className="flex w-full cursor-pointer items-center gap-4 p-4 text-left">
        {/* countdown */}
        <div
          className="grid h-[74px] w-[74px] shrink-0 place-items-center rounded-[14px] text-center"
          style={{
            background: exam.done
              ? 'var(--c-success-soft)'
              : `color-mix(in srgb, ${urgent ? 'var(--c-danger)' : color} 12%, transparent)`,
            color: exam.done ? 'var(--c-success)' : urgent ? 'var(--c-danger)' : color,
          }}
        >
          {exam.done ? (
            <Icon name="check" size={26} strokeWidth={2.4} />
          ) : (
            <div>
              <div className="t-num text-[26px] font-semibold leading-none tracking-[-0.03em]">
                {days === null ? '—' : Math.max(0, days)}
              </div>
              <div className="mt-1 text-[10px] font-medium opacity-80">
                {days === 0 ? t(L('днес', 'today')) : t(days === 1 ? L('ден', 'day') : L('дни', 'days'))}
              </div>
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-[15.5px] font-semibold tracking-[-0.015em]">{exam.title}</h3>
            {exam.priority > 0 && (
              <Badge tone={exam.priority === 2 ? 'danger' : 'warn'} icon="flag">
                {t(exam.priority === 2 ? L('Спешен', 'Urgent') : L('Важен', 'Important'))}
              </Badge>
            )}
            {exam.done && <Badge tone="success" icon="check">{t(L('Взет', 'Done'))}</Badge>}
          </div>

          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted">
            {subject && (
              <span className="inline-flex items-center gap-1.5">
                <span className="badge-dot" style={{ background: subject.color }} />
                {subject.name}
              </span>
            )}
            {exam.due !== null && (
              <span className="inline-flex items-center gap-1">
                <Icon name="calendar" size={12} />
                {formatDate(exam.due, lang, { weekday: 'short', day: 'numeric', month: 'long' })}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Icon name="timer" size={12} />
              {formatDuration(minutes, lang)} {t(L('подготовка', 'prepared'))}
            </span>
          </p>

          <div className="mt-2.5 flex items-center gap-3">
            <ProgressBar value={readiness} color={color} height={7} className="flex-1" />
            <span className="t-num shrink-0 text-[12px] font-medium">{Math.round(readiness * 100)}%</span>
          </div>
        </div>

        <Icon name={open ? 'chevronUp' : 'chevronDown'} size={17} className="shrink-0 text-faint" />
      </button>

      {open && (
        <div className="animate-in border-t border-line p-4">
          <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
            <div className="flex items-center gap-4 lg:flex-col lg:items-start">
              <ProgressRing value={readiness} size={92} stroke={8} color={color} colorTo="var(--c-brand-lift)">
                <div>
                  <div className="t-num text-[19px] font-semibold leading-none">{Math.round(readiness * 100)}%</div>
                  <div className="mt-1 text-[10px] text-muted">{t(L('готовност', 'ready'))}</div>
                </div>
              </ProgressRing>
              <ul className="space-y-1.5 text-[12px] text-muted">
                <li className="flex items-center gap-2">
                  <Icon name="checkCircle" size={13} />
                  {t(L(`${relatedDone} от ${related.length} задачи`, `${relatedDone} of ${related.length} tasks`))}
                </li>
                <li className="flex items-center gap-2">
                  <Icon name="cards" size={13} />
                  {t(L(`${deckKnown} от ${deck.length} карти научени`, `${deckKnown} of ${deck.length} cards known`))}
                </li>
                <li className="flex items-center gap-2">
                  <Icon name="timer" size={13} />
                  {formatDuration(minutes, lang)} {t(L('учене', 'studied'))}
                </li>
              </ul>
            </div>

            <div className="space-y-4">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="t-label">{t(L('Свързани задачи', 'Related tasks'))}</h4>
                  <Button
                    size="sm"
                    icon="plus"
                    /* The subject travels with the dialog now. It used to be
                       "smuggled" by setting the global channel filter, which
                       changed what the whole app was showing and did not even
                       reach the composer. */
                    onClick={() =>
                      useApp.getState().setQuick('item', 'task', {
                        subjectId: exam.subjectId,
                        due: exam.due,
                      })
                    }
                  >
                    {t(S.add)}
                  </Button>
                </div>
                {related.length === 0 ? (
                  <p className="rounded-[12px] p-3 text-[12.5px] text-muted" style={{ background: 'var(--c-surface-2)' }}>
                    {t(L('Няма задачи по този предмет преди изпита. Добави няколко — готовността се смята от тях.', 'No tasks for this subject before the exam. Add a few — readiness is computed from them.'))}
                  </p>
                ) : (
                  <div className="rounded-[12px]" style={{ background: 'var(--c-surface-2)' }}>
                    {sortByDue(openItems(related)).slice(0, 5).map((item) => (
                      <TaskRow key={item.id} item={item} dense />
                    ))}
                  </div>
                )}
              </div>

              {materials.length > 0 && (
                <div>
                  <h4 className="t-label mb-2">{t(L('Материали по предмета', 'Materials for this subject'))}</h4>
                  <div className="flex flex-wrap gap-2">
                    {materials.map((doc) => (
                      <button
                        key={doc.id}
                        onClick={() => void openDoc(doc.id)}
                        className="flex cursor-pointer items-center gap-2 rounded-[10px] border border-line px-2.5 py-1.5 text-[12.5px] transition-colors hover:bg-surface-2"
                      >
                        <Icon name={doc.kind === 'board' ? 'board' : 'book'} size={13} className="text-faint" />
                        <span className="max-w-[190px] truncate">{doc.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="primary"
                  icon="timer"
                  onClick={() => {
                    useTimer.getState().setActiveTask(exam.id);
                    useApp.getState().go('focus');
                    useTimer.getState().start();
                  }}
                >
                  {t(L('Учи за изпита', 'Study for this'))}
                </Button>
                {deck.length > 0 && (
                  <Button
                    icon="cards"
                    onClick={() => {
                      useCards.getState().startReview(null);
                      useApp.getState().go('cards');
                    }}
                  >
                    {t(L('Преговори картите', 'Review the cards'))}
                  </Button>
                )}
                <Button
                  icon={exam.done ? 'refresh' : 'check'}
                  onClick={() => void usePlanner.getState().toggleItem(exam.id)}
                >
                  {exam.done ? t(L('Върни като предстоящ', 'Mark as upcoming')) : t(L('Отметни като взет', 'Mark as taken'))}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
