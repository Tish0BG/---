import { useMemo } from 'react';
import { useApp } from '@/state/appStore';
import { useWorkspace } from '@/state/workspaceStore';
import { usePlanner, upcomingExams } from '@/state/plannerStore';
import { useLibrary } from '@/state/libraryStore';
import { useTimer } from '@/state/timerStore';
import { useT, L, type Msg } from '@/i18n';
import { Icon } from '../Icon';

/**
 * The one thing worth doing next, chosen from what setup was told.
 *
 * This is not a recommendation engine and does not pretend to be one. It is a
 * short list of gaps between what somebody said they were here for and what
 * the workspace actually contains — "you said you are preparing for an exam
 * and there is no exam in here" — ordered so the most concrete comes first.
 * Every suggestion opens the screen that closes the gap, and the card
 * disappears entirely once there are none left, because a permanent panel
 * telling people to do things is nagging.
 */

interface Suggestion {
  id: string;
  icon: string;
  title: Msg;
  body: Msg;
  action: Msg;
  run: () => void;
}

export function NextStep() {
  const t = useT();
  const learning = useWorkspace((s) => s.learning);
  const subjects = useWorkspace((s) => s.subjects);
  const profile = useWorkspace((s) => s.profile);
  const items = usePlanner((s) => s.items);
  const documents = useLibrary((s) => s.documents);
  const sessions = useTimer((s) => s.sessions);

  const suggestion = useMemo<Suggestion | null>(() => {
    const go = useApp.getState().go;
    const live = documents.filter((d) => !d.deletedAt);

    // An interest that never became a subject: the answer is one click away
    // and everything else in the app hangs off subjects.
    const missing = learning.interests.filter(
      (name) => !subjects.some((s) => s.name.toLowerCase() === name.toLowerCase()),
    );
    if (missing.length > 0) {
      return {
        id: 'subject',
        icon: 'layers',
        title: L(`Още не си добавил ${missing[0]}`, `${missing[0]} is not in here yet`),
        body: L(
          'Каза, че учиш това. Предметите подреждат материалите, задачите и часовете — всичко останало виси на тях.',
          'You said you are studying it. Subjects organise the materials, the tasks and the hours — everything else hangs off them.',
        ),
        action: L('Добави предмет', 'Add the subject'),
        run: () => go('subjects'),
      };
    }

    // Said "exam", has no exam.
    if (learning.goals.includes('exam') && upcomingExams(items, 3650).length === 0) {
      return {
        id: 'exam',
        icon: 'target',
        title: L('Изпитът още не е вътре', 'The exam is not in here yet'),
        body: L(
          'Сложи датата и Plauvia започва да смята готовността ти от задачите, картите и часовете, които наистина си направил.',
          'Put the date in and Plauvia starts working out your readiness from the tasks, cards and hours you have actually done.',
        ),
        action: L('Добави изпит', 'Add the exam'),
        run: () => go('exams'),
      };
    }

    // Nothing to study from.
    if (live.length === 0) {
      return {
        id: 'library',
        icon: 'book',
        title: L('Библиотеката е празна', 'The library is empty'),
        body: L(
          'Пусни един учебник в PDF или започни на празна дъска — решаването става направо върху страницата.',
          'Drop in a PDF textbook or start on a blank board — the solving happens straight on the page.',
        ),
        action: L('Отвори библиотеката', 'Open the library'),
        run: () => go('drive'),
      };
    }

    // Everything is set up and nothing has been logged: the hours are what
    // every other number on the dashboard is made of.
    if (sessions.length === 0) {
      const minutes = learning.sessionMinutes || 25;
      return {
        id: 'session',
        icon: 'timer',
        title: L('Първата сесия още не е започнала', 'The first session has not started'),
        body: L(
          `${minutes} минути с включен таймер и статистиката, целите и нивата спират да бъдат празни — те се смятат от тях.`,
          `${minutes} minutes with the timer on and the statistics, goals and levels stop being empty — they are made of those.`,
        ),
        action: L('Започни фокус', 'Start a focus session'),
        run: () => useTimer.getState().setView('full'),
      };
    }

    // The profile is usable without a name, but the greeting is not.
    if (!profile.name.trim()) {
      return {
        id: 'name',
        icon: 'user',
        title: L('Как да те наричаме?', 'What should we call you?'),
        body: L(
          'Едно име, само за поздрава. Нищо не се изпраща никъде.',
          'One name, only for the greeting. Nothing is sent anywhere.',
        ),
        action: L('Отвори настройките', 'Open settings'),
        run: () => useApp.getState().setSettings(true),
      };
    }

    return null;
  }, [learning, subjects, items, documents, sessions, profile.name]);

  if (!suggestion) return null;

  return (
    <section
      className="animate-rise card mt-5 flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5"
      aria-labelledby="next-step-title"
    >
      <span
        className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px]"
        style={{ background: 'var(--c-accent-soft)', color: 'var(--c-accent)' }}
      >
        <Icon name={suggestion.icon} size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="t-label">{t(L('Следваща стъпка', 'Next step'))}</p>
        <h2 id="next-step-title" className="mt-0.5 text-[15px] font-semibold tracking-[-0.012em]">
          {t(suggestion.title)}
        </h2>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">{t(suggestion.body)}</p>
      </div>
      <button className="btn btn-outline shrink-0" onClick={suggestion.run}>
        {t(suggestion.action)}
        <Icon name="arrowRight" size={15} />
      </button>
    </section>
  );
}
