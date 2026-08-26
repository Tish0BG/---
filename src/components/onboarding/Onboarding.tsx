import { useEffect, useMemo, useState } from 'react';
import { useWorkspace, SUBJECT_COLORS, SUGGESTED_SUBJECTS } from '@/state/workspaceStore';
import { useSettings } from '@/state/settingsStore';
import { useGoals } from '@/state/goalStore';
import { useAuth } from '@/state/authStore';
import { gameContext } from '@/state/gameStore';
import { useT, L, plural, useLangStore, type Lang, type Msg } from '@/i18n';
import { S } from '@/i18n/strings';
import { BRAND } from '@/brand';
import type { Accent, LearningGoal, LearningLevel, LearningStyle } from '@/types';
import { normaliseUsername, suggestUsername, validateUsername } from '@/services/usernameService';
import { PlauviaMark, PlauviaTile, PlauviaWordmark } from '../brand/Logo';
import { Icon } from '../Icon';
import { Button, ProgressCells } from '../kit';

/**
 * The first few minutes.
 *
 * It asks for what the product cannot work out on its own and nothing else,
 * and every answer becomes a real record — so the dashboard behind it opens
 * with something on it instead of six empty states. Every step can be skipped
 * and every question can be left blank; the only field the app genuinely
 * cannot do without is a name to greet somebody by, and even that has a
 * fallback.
 *
 * The draft is written to localStorage as it goes. Setup that loses four
 * answers to a mistyped refresh is setup people do not come back to.
 */

const DRAFT_KEY = 'plauvia.onboarding.draft.v1';

const AVATARS = ['🦉', '🦊', '🐨', '🐼', '🦅', '🐙', '🌿', '🔭', '🎯', '⚡️', '🚀', '📐'];

const LEVELS: { id: LearningLevel; label: Msg; note: Msg }[] = [
  { id: 'beginner', label: L('Начинаещ', 'Beginner'), note: L('Тръгвам отначало', 'Starting from the beginning') },
  { id: 'basic', label: L('Основи', 'Basic'), note: L('Знам най-важното', 'I know the essentials') },
  { id: 'intermediate', label: L('Средно', 'Intermediate'), note: L('Справям се', 'I can hold my own') },
  { id: 'advanced', label: L('Напреднал', 'Advanced'), note: L('Гоня високо ниво', 'Aiming high') },
  { id: 'unsure', label: L('Не съм сигурен', 'Not sure'), note: L('Ще се разбере в движение', 'It will become clear') },
];

const GOALS: { id: LearningGoal; label: Msg; icon: string }[] = [
  { id: 'foundations', label: L('Ред в ежедневието', 'Order in my day'), icon: 'layers' },
  { id: 'exam', label: L('Голям срок или изпит', 'A big deadline or exam'), icon: 'target' },
  { id: 'grades', label: L('По-добри резултати', 'Better results'), icon: 'chartLine' },
  { id: 'university', label: L('Голяма цел напред', 'A big goal ahead'), icon: 'trophy' },
  { id: 'new-subject', label: L('Нещо ново за научаване', 'Something new to learn'), icon: 'sparkles' },
  { id: 'curiosity', label: L('От интерес', 'For my own interest'), icon: 'lightbulb' },
  { id: 'skills', label: L('Умения за работа', 'Skills for work'), icon: 'tools' },
];

const STYLES: { id: LearningStyle; label: Msg; icon: string }[] = [
  { id: 'short', label: L('Кратки уроци', 'Short sittings'), icon: 'timer' },
  { id: 'deep', label: L('Подробни обяснения', 'Detailed explanations'), icon: 'book' },
  { id: 'practice', label: L('Много упражнения', 'Lots of practice'), icon: 'pencil' },
  { id: 'examples', label: L('През примери', 'Through examples'), icon: 'list' },
  { id: 'visual', label: L('Визуално', 'Visually'), icon: 'palette' },
  { id: 'problems', label: L('Решаване на задачи', 'Solving problems'), icon: 'sigma' },
  { id: 'mixed', label: L('По малко от всичко', 'A bit of everything'), icon: 'layers' },
];

const ACCENTS: { id: Accent; label: Msg; swatch: string }[] = [
  { id: 'brand', label: L('Plauvia', 'Plauvia'), swatch: '#1857d6' },
  { id: 'cyan', label: L('Циан', 'Cyan'), swatch: '#00697f' },
  { id: 'green', label: L('Зелено', 'Green'), swatch: '#04703f' },
  { id: 'amber', label: L('Кехлибар', 'Amber'), swatch: '#9a5b00' },
  { id: 'rose', label: L('Розово', 'Rose'), swatch: '#c22a63' },
  { id: 'violet', label: L('Виолетово', 'Violet'), swatch: '#6539d6' },
];

const STEPS = 7;

interface Draft {
  step: number;
  name: string;
  lastName: string;
  username: string;
  avatar: string;
  color: string;
  picked: string[];
  level: LearningLevel;
  goals: LearningGoal[];
  styles: LearningStyle[];
  daily: number;
  session: number;
  wantGoal: boolean;
}

function readDraft(): Partial<Draft> {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_KEY) ?? '{}') as Partial<Draft>;
  } catch {
    return {};
  }
}

export function Onboarding({ onDone }: { onDone: () => void }) {
  const t = useT();
  const lang = useLangStore((s) => s.lang);
  const setLang = useLangStore((s) => s.setLang);
  const user = useAuth((s) => s.user);
  const profile = useWorkspace((s) => s.profile);
  const theme = useSettings((s) => s.theme);
  const accent = useSettings((s) => s.accent);

  const saved = useMemo(readDraft, []);
  const [step, setStep] = useState(saved.step ?? 0);
  const [name, setName] = useState(saved.name ?? profile.name ?? guessName(user?.email));
  const [lastName, setLastName] = useState(saved.lastName ?? profile.lastName ?? '');
  const [username, setUsername] = useState(saved.username ?? profile.username ?? '');
  const [avatar, setAvatar] = useState(saved.avatar ?? profile.avatar ?? '🦉');
  const [color, setColor] = useState(saved.color ?? profile.color ?? SUBJECT_COLORS[0]);
  const [picked, setPicked] = useState<string[]>(saved.picked ?? []);
  const [level, setLevel] = useState<LearningLevel>(saved.level ?? 'unsure');
  const [goals, setGoals] = useState<LearningGoal[]>(saved.goals ?? []);
  const [styles, setStyles] = useState<LearningStyle[]>(saved.styles ?? []);
  const [custom, setCustom] = useState('');
  const [daily, setDaily] = useState(saved.daily ?? 90);
  const [session, setSession] = useState(saved.session ?? 25);
  const [wantGoal, setWantGoal] = useState(saved.wantGoal ?? true);
  const [saving, setSaving] = useState(false);

  const names = useMemo(() => SUGGESTED_SUBJECTS.map((s) => s[lang]), [lang]);
  const usernameProblem = username.trim() ? validateUsername(username) : null;
  /** Settled during registration, and not worth asking about twice. */
  const hasHandle = !!profile.username.trim();

  /** Written on every change, so a refresh resumes rather than restarts. */
  useEffect(() => {
    const draft: Draft = { step, name, lastName, username, avatar, color, picked, level, goals, styles, daily, session, wantGoal };
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      /* private mode — setup still works, it just will not resume */
    }
  }, [step, name, lastName, username, avatar, color, picked, level, goals, styles, daily, session, wantGoal]);

  const finish = async (skipped = false) => {
    setSaving(true);
    const workspace = useWorkspace.getState();

    await workspace.saveProfile({
      name: name.trim(),
      lastName: lastName.trim(),
      // An empty box on a screen that never showed the field is not an
      // instruction to clear the handle somebody already reserved.
      username: hasHandle ? profile.username : normaliseUsername(username),
      avatar,
      color,
      createdAt: Date.now(),
    });

    // Claimed after the local save, and never allowed to hold setup up: an
    // account with no `usernames` table, or no network, must not be a reason
    // somebody cannot finish signing up.
    if (!hasHandle && username.trim() && !usernameProblem) {
      void import('@/services/usernameService').then((m) => m.claimUsername(username));
    }

    await workspace.saveLearning({
      interests: picked,
      level,
      goals,
      styles,
      sessionMinutes: session,
    });

    // Only what was ticked, named exactly as it was read. Nothing is created
    // for somebody who picked nothing — an empty subject list is a legitimate
    // answer to "what are you studying", and inventing nine subjects for a
    // person who did not choose them is the app deciding on their behalf.
    for (const label of picked) {
      const suggestion = SUGGESTED_SUBJECTS.find((s) => s[lang] === label);
      await workspace.createSubject({ name: label, icon: suggestion?.icon ?? 'book' });
    }

    useSettings.getState().setTimer({ goal: daily, work: session });

    if (wantGoal && !skipped) {
      const first = useWorkspace.getState().subjects[0] ?? null;
      const deadline = new Date();
      deadline.setDate(deadline.getDate() + 30);
      deadline.setHours(0, 0, 0, 0);
      await useGoals.getState().add(
        {
          title:
            lang === 'bg'
              ? `${Math.round((daily * 20) / 60)} часа учене този месец`
              : `${Math.round((daily * 20) / 60)} hours of study this month`,
          metric: 'minutes',
          target: daily * 20,
          subjectId: first?.id ?? null,
          deadline: deadline.getTime(),
        },
        gameContext(),
      );
    }

    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* nothing to clean up */
    }
    onDone();
  };

  const next = () => (step === STEPS - 1 ? void finish() : setStep(step + 1));
  const toggle = <T,>(list: T[], value: T): T[] =>
    list.includes(value) ? list.filter((x) => x !== value) : [...list, value];

  /** Steps 0 and 1 want an answer; everything after them is genuinely optional. */
  const skippable = step >= 2 && step < STEPS - 1;

  return (
    <div className="flex h-full overflow-hidden" style={{ background: 'var(--c-bg)' }}>
      {/* ------------------------------------------------------- brand side */}
      <aside
        className="relative hidden w-[38%] max-w-[460px] shrink-0 flex-col justify-between overflow-hidden p-10 lg:flex"
        style={{ background: 'var(--grad-brand)', color: '#fff' }}
      >
        <span
          aria-hidden
          className="animate-breathe pointer-events-none absolute -left-24 top-1/3 h-80 w-80 rounded-full opacity-30 blur-3xl"
          style={{ background: '#fff' }}
        />
        <PlauviaWordmark size={20} />

        <div className="relative">
          <PlauviaMark size={54} className="opacity-90" />
          <h2 className="mt-6 text-[30px] font-semibold leading-[1.15] tracking-[-0.03em]">
            {BRAND.tagline[lang]}
          </h2>
          <p className="mt-3 max-w-[34ch] text-[14px] leading-relaxed opacity-85">
            {BRAND.description[lang]}
          </p>

          <ul className="mt-8 space-y-3 text-[13.5px]">
            {[
              L('Денят и дългият план стоят на един екран', 'The day and the long plan sit on one screen'),
              L('Напомняния, които наистина идват навреме', 'Reminders that actually arrive on time'),
              L('Часовете стават напредък, серии и нива', 'Hours turn into progress, streaks and levels'),
            ].map((line, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="mt-[3px] grid h-4 w-4 shrink-0 place-items-center rounded-full bg-white/25">
                  <Icon name="check" size={10} strokeWidth={3} />
                </span>
                {t(line)}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-[12px] opacity-70">{BRAND.domain}</p>
      </aside>

      {/* ---------------------------------------------------------- content */}
      <main className="scroll-thin flex min-w-0 flex-1 flex-col overflow-y-auto">
        <header className="flex items-center justify-between px-5 py-4 sm:px-10">
          <span className="flex items-center gap-2.5 lg:hidden">
            <PlauviaTile size={28} />
            <PlauviaWordmark size={16} />
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Button onClick={() => void finish(true)}>{t(L('Пропусни настройката', 'Skip setup'))}</Button>
          </div>
        </header>

        <div className="mx-auto flex w-full max-w-[560px] flex-1 flex-col justify-center px-5 py-8 sm:px-8">
          <div className="mb-7">
            <ProgressCells value={(step + 1) / STEPS} cells={STEPS} />
            <p className="t-label mt-2.5">
              {t(L(`Стъпка ${step + 1} от ${STEPS}`, `Step ${step + 1} of ${STEPS}`))}
            </p>
          </div>

          {/* ------------------------------------------------ 0 · welcome */}
          {step === 0 && (
            <section className="animate-rise">
              <h1 className="t-h1">{t(L('Добре дошъл в Plauvia.', 'Welcome to Plauvia.'))}</h1>
              <p className="mt-2 text-[14px] leading-relaxed text-muted">
                {t(
                  L(
                    'Шест кратки въпроса, за да не отвориш празно приложение. Всеки от тях може да се пропусне и да се смени по-късно.',
                    'Six short questions, so you do not open an empty app. Every one of them can be skipped, and changed later.',
                  ),
                )}
              </p>

              <p className="t-label mt-8 mb-2">{t(L('На кой език да ти говорим?', 'Which language should we speak?'))}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {([
                  ['bg', 'Български', 'Bulgarian'],
                  ['en', 'English', 'English'],
                ] as [Lang, string, string][]).map(([code, native]) => (
                  <button
                    key={code}
                    onClick={() => setLang(code)}
                    aria-pressed={lang === code}
                    className="flex cursor-pointer items-center justify-between rounded-[12px] border p-4 text-left transition-all"
                    style={{
                      borderColor: lang === code ? 'var(--c-accent)' : 'var(--c-line)',
                      background: lang === code ? 'var(--c-accent-soft)' : 'var(--c-surface)',
                    }}
                  >
                    <span className="text-[14px] font-medium">{native}</span>
                    {lang === code && <Icon name="check" size={16} strokeWidth={2.6} className="text-accent" />}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-[12px] text-muted">
                {t(
                  L(
                    'Това е езикът на интерфейса. Какво учиш е отделен въпрос и идва след малко.',
                    'This is the language of the interface. What you are studying is a separate question, coming up.',
                  ),
                )}
              </p>
            </section>
          )}

          {/* --------------------------------------------------- 1 · you */}
          {step === 1 && (
            <section className="animate-rise">
              <h1 className="t-h1">{t(L('Как да те наричаме?', 'What should we call you?'))}</h1>
              <p className="mt-2 text-[14px] text-muted">
                {t(L('Само за поздрава. Фамилия не е нужна.', 'Only for the greeting. A surname is not needed.'))}
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="t-label mb-1.5 block">{t(L('Име', 'First name'))}</span>
                  <input
                    autoFocus
                    className="field field-lg"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t(L('Твоето име', 'Your name'))}
                    autoComplete="given-name"
                    onKeyDown={(e) => e.key === 'Enter' && next()}
                  />
                </label>
                <label className="block">
                  <span className="t-label mb-1.5 block">
                    {t(L('Фамилия', 'Last name'))}{' '}
                    <span className="font-normal normal-case tracking-normal text-faint">
                      {t(L('· по избор', '· optional'))}
                    </span>
                  </span>
                  <input
                    className="field field-lg"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    autoComplete="family-name"
                  />
                </label>
              </div>

              {/* Registration asks for the handle and reserves it, so by the
                  time most people reach this screen it is settled and asking
                  again is just a field they have to read to ignore. It is
                  still here for an account made before that flow existed, and
                  for a workspace that has never had one. */}
              {!hasHandle && (
              <div className="mt-4">
                <span className="t-label mb-1.5 block">
                  {t(L('Потребителско име', 'Username'))}{' '}
                  <span className="font-normal normal-case tracking-normal text-faint">
                    {t(L('· по избор', '· optional'))}
                  </span>
                </span>
                <div className="flex gap-2">
                  <span className="relative flex-1">
                    <span
                      aria-hidden
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[14px] text-faint"
                    >
                      @
                    </span>
                    <input
                      className="field field-lg pl-7"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder={suggestUsername(name) || 'tihomir'}
                      autoComplete="username"
                      spellCheck={false}
                    />
                  </span>
                  {!username.trim() && name.trim() && (
                    <Button onClick={() => setUsername(suggestUsername(name))}>
                      {t(L('Предложи', 'Suggest'))}
                    </Button>
                  )}
                </div>
                <p className="mt-1.5 text-[12px] leading-relaxed" style={{ color: usernameProblem ? 'var(--c-danger)' : 'var(--c-faint)' }}>
                  {usernameProblem ? (
                    <>
                      <Icon name="alert" size={12} className="mr-1 inline align-[-2px]" />
                      {usernameProblem}
                    </>
                  ) : (
                    t(
                      L(
                        'Запазва името за теб. Никъде още не се показва публично.',
                        'Reserves the name for you. Nothing shows it publicly yet.',
                      ),
                    )
                  )}
                </p>
              </div>
              )}

              {/* A photograph outranks an emoji, so the picker only appears
                  for somebody who has not uploaded one. */}
              {!profile.photo && (
              <>
              <p className="t-label mt-6 mb-2">{t(L('Аватар', 'Avatar'))}</p>
              <div className="flex flex-wrap gap-2">
                {AVATARS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => setAvatar(emoji)}
                    aria-pressed={avatar === emoji}
                    aria-label={emoji}
                    className="grid h-11 w-11 cursor-pointer place-items-center rounded-[10px] text-[20px] transition-all"
                    style={{
                      background: avatar === emoji ? 'var(--c-accent-soft)' : 'var(--c-surface)',
                      border: `1px solid ${avatar === emoji ? 'var(--c-accent)' : 'var(--c-line)'}`,
                      transform: avatar === emoji ? 'scale(1.06)' : undefined,
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              </>
              )}

              <p className="t-label mt-6 mb-2">{t(L('Твоят цвят', 'Your colour'))}</p>
              <div className="flex flex-wrap gap-2">
                {SUBJECT_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    aria-pressed={color === c}
                    aria-label={c}
                    className="h-8 w-8 cursor-pointer rounded-full transition-transform"
                    style={{
                      background: c,
                      transform: color === c ? 'scale(1.15)' : undefined,
                      boxShadow: color === c ? `0 0 0 3px color-mix(in srgb, ${c} 28%, transparent)` : undefined,
                    }}
                  />
                ))}
              </div>
            </section>
          )}

          {/* ---------------------------------------------- 2 · subjects */}
          {step === 2 && (
            <section className="animate-rise">
              <h1 className="t-h1">{t(L('С какво се занимаваш?', 'What do you spend time on?'))}</h1>
              <p className="mt-2 text-[14px] text-muted">
                {t(
                  L(
                    'Работа, дом, тренировки, предмет — по тях се подрежда всичко останало: материали, задачи, часове и статистика.',
                    'Work, home, training, a school subject — everything else organises itself around these: materials, tasks, hours and statistics.',
                  ),
                )}
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                {names.map((label, i) => {
                  const active = picked.includes(label);
                  const tint = SUBJECT_COLORS[i % SUBJECT_COLORS.length];
                  return (
                    <button
                      key={label}
                      onClick={() => setPicked(toggle(picked, label))}
                      aria-pressed={active}
                      className="flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-[13px] font-medium transition-all"
                      style={{
                        borderColor: active ? tint : 'var(--c-line)',
                        background: active ? `color-mix(in srgb, ${tint} 12%, transparent)` : 'var(--c-surface)',
                        color: active ? tint : 'var(--c-muted)',
                      }}
                    >
                      <Icon name={SUGGESTED_SUBJECTS[i].icon} size={14} />
                      {label}
                      {active && <Icon name="check" size={13} strokeWidth={2.6} />}
                    </button>
                  );
                })}
              </div>

              <form
                className="mt-4 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const value = custom.trim();
                  if (!value || picked.includes(value)) return;
                  setPicked([...picked, value]);
                  setCustom('');
                }}
              >
                <input
                  className="field"
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                  placeholder={t(L('Нещо друго…', 'Something else…'))}
                />
                <Button type="submit" icon="plus" disabled={!custom.trim()}>
                  {t(S.add)}
                </Button>
              </form>

              {picked.length > 0 && (
                <p className="mt-4 text-[12.5px] text-muted">
                  {t(L(`Избрани: ${picked.length}`, `Selected: ${picked.length}`))}
                </p>
              )}
            </section>
          )}

          {/* ------------------------------------------- 3 · level, goals */}
          {step === 3 && (
            <section className="animate-rise">
              <h1 className="t-h1">{t(L('Откъде тръгваш?', 'Where are you starting from?'))}</h1>
              <p className="mt-2 text-[14px] text-muted">
                {t(
                  L(
                    'Няма грешен отговор и нищо не се заключва. „Не съм сигурен“ е напълно нормален избор.',
                    'There is no wrong answer and nothing is locked. "Not sure" is a perfectly normal choice.',
                  ),
                )}
              </p>

              <div className="mt-6 grid gap-2">
                {LEVELS.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => setLevel(option.id)}
                    aria-pressed={level === option.id}
                    className="flex cursor-pointer items-center gap-3 rounded-[12px] border p-3.5 text-left transition-all"
                    style={{
                      borderColor: level === option.id ? 'var(--c-accent)' : 'var(--c-line)',
                      background: level === option.id ? 'var(--c-accent-soft)' : 'var(--c-surface)',
                    }}
                  >
                    <span
                      aria-hidden
                      className="grid h-5 w-5 shrink-0 place-items-center rounded-full border"
                      style={{
                        borderColor: level === option.id ? 'var(--c-accent)' : 'var(--c-line-strong)',
                        background: level === option.id ? 'var(--c-accent)' : 'transparent',
                        color: 'var(--c-accent-text)',
                      }}
                    >
                      {level === option.id && <Icon name="check" size={12} strokeWidth={3} />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[14px] font-medium">{t(option.label)}</span>
                      <span className="mt-0.5 block text-[12px] text-muted">{t(option.note)}</span>
                    </span>
                  </button>
                ))}
              </div>

              <p className="t-label mt-7 mb-2">{t(L('Какво искаш да постигнеш?', 'What are you after?'))}</p>
              <div className="flex flex-wrap gap-2">
                {GOALS.map((goal) => {
                  const active = goals.includes(goal.id);
                  return (
                    <button
                      key={goal.id}
                      onClick={() => setGoals(toggle(goals, goal.id))}
                      aria-pressed={active}
                      className="flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-[13px] font-medium transition-all"
                      style={{
                        borderColor: active ? 'var(--c-accent)' : 'var(--c-line)',
                        background: active ? 'var(--c-accent-soft)' : 'var(--c-surface)',
                        color: active ? 'var(--c-accent)' : 'var(--c-muted)',
                      }}
                    >
                      <Icon name={goal.icon} size={14} />
                      {t(goal.label)}
                      {active && <Icon name="check" size={13} strokeWidth={2.6} />}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* ------------------------------------------- 4 · how you learn */}
          {step === 4 && (
            <section className="animate-rise">
              <h1 className="t-h1">{t(L('Как ти върви най-добре?', 'What works best for you?'))}</h1>
              <p className="mt-2 text-[14px] text-muted">
                {t(
                  L(
                    'Избери колкото искаш. Използва се за предложенията, не за да те ограничава.',
                    'Pick as many as you like. It shapes the suggestions rather than limiting you.',
                  ),
                )}
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                {STYLES.map((style) => {
                  const active = styles.includes(style.id);
                  return (
                    <button
                      key={style.id}
                      onClick={() => setStyles(toggle(styles, style.id))}
                      aria-pressed={active}
                      className="flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-[13px] font-medium transition-all"
                      style={{
                        borderColor: active ? 'var(--c-accent)' : 'var(--c-line)',
                        background: active ? 'var(--c-accent-soft)' : 'var(--c-surface)',
                        color: active ? 'var(--c-accent)' : 'var(--c-muted)',
                      }}
                    >
                      <Icon name={style.icon} size={14} />
                      {t(style.label)}
                      {active && <Icon name="check" size={13} strokeWidth={2.6} />}
                    </button>
                  );
                })}
              </div>

              <p className="t-label mt-7 mb-2">{t(L('Една сесия', 'One sitting'))}</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { m: 25, label: L('Помодоро', 'Pomodoro') },
                  { m: 45, label: L('Учебен час', 'School hour') },
                  { m: 50, label: L('Дълъг блок', 'Deep block') },
                ].map((option) => (
                  <button
                    key={option.m}
                    onClick={() => setSession(option.m)}
                    aria-pressed={session === option.m}
                    className="cursor-pointer rounded-[12px] border p-3 text-left transition-all"
                    style={{
                      borderColor: session === option.m ? 'var(--c-accent)' : 'var(--c-line)',
                      background: session === option.m ? 'var(--c-accent-soft)' : 'var(--c-surface)',
                    }}
                  >
                    <span className="t-num block text-[17px] font-semibold leading-none">{option.m}′</span>
                    <span className="mt-1.5 block text-[11.5px] text-muted">{t(option.label)}</span>
                  </button>
                ))}
              </div>

              <p className="t-label mt-6 mb-2">{t(L('Цел за деня', 'Daily goal'))}</p>
              <div className="grid grid-cols-4 gap-2">
                {[30, 60, 90, 120].map((m) => (
                  <button
                    key={m}
                    onClick={() => setDaily(m)}
                    aria-pressed={daily === m}
                    className="cursor-pointer rounded-[12px] border p-3 text-center transition-all"
                    style={{
                      borderColor: daily === m ? 'var(--c-accent)' : 'var(--c-line)',
                      background: daily === m ? 'var(--c-accent-soft)' : 'var(--c-surface)',
                      color: daily === m ? 'var(--c-accent)' : undefined,
                    }}
                  >
                    <span className="t-num block text-[19px] font-semibold leading-none">{m}</span>
                    <span className="mt-1 block text-[11px] text-muted">{t(L('мин', 'min'))}</span>
                  </button>
                ))}
              </div>

              <label
                className="mt-6 flex cursor-pointer items-start gap-3 rounded-[12px] border border-line p-3.5"
                style={{ background: 'var(--c-surface)' }}
              >
                <input
                  type="checkbox"
                  checked={wantGoal}
                  onChange={(e) => setWantGoal(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[var(--c-accent)]"
                />
                <span>
                  <span className="block text-[13.5px] font-medium">
                    {t(L('Създай ми първата цел', 'Create my first goal'))}
                  </span>
                  <span className="mt-0.5 block text-[12px] text-muted">
                    {t(
                      L(
                        `${Math.round((daily * 20) / 60)} часа за следващия месец — движи се сама с всяка сесия.`,
                        `${Math.round((daily * 20) / 60)} hours over the next month — it moves on its own with every session.`,
                      ),
                    )}
                  </span>
                </span>
              </label>
            </section>
          )}

          {/* ------------------------------------------ 5 · how it looks */}
          {step === 5 && (
            <section className="animate-rise">
              <h1 className="t-h1">{t(L('Как да изглежда?', 'How should it look?'))}</h1>
              <p className="mt-2 text-[14px] text-muted">
                {t(
                  L(
                    'Сменя се веднага и по всяко време от Настройки.',
                    'It changes immediately, and again whenever you like, from Settings.',
                  ),
                )}
              </p>

              <p className="t-label mt-7 mb-2">{t(L('Тема', 'Theme'))}</p>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    ['light', L('Светла', 'Light'), '#ffffff', '#0e1116'],
                    ['dark', L('Тъмна', 'Dark'), '#0f1219', '#e9edf6'],
                    ['system', L('Като системата', 'System'), 'linear-gradient(105deg,#ffffff 50%,#0f1219 50%)', '#7d8699'],
                  ] as const
                ).map(([id, label, bg, fg]) => (
                  <button
                    key={id}
                    onClick={() => useSettings.getState().set('theme', id)}
                    aria-pressed={theme === id}
                    className="cursor-pointer rounded-[12px] border p-2.5 text-left transition-all"
                    style={{
                      borderColor: theme === id ? 'var(--c-accent)' : 'var(--c-line)',
                      background: theme === id ? 'var(--c-accent-soft)' : 'var(--c-surface)',
                    }}
                  >
                    <span
                      aria-hidden
                      className="mb-2 grid h-12 w-full place-items-center rounded-[8px] border"
                      style={{ background: bg, borderColor: 'var(--c-line)', color: fg }}
                    >
                      <span className="text-[15px] font-semibold">Aa</span>
                    </span>
                    <span className="block text-[12.5px] font-medium">{t(label)}</span>
                  </button>
                ))}
              </div>

              <p className="t-label mt-6 mb-2">{t(L('Акцент', 'Accent'))}</p>
              <div className="flex flex-wrap gap-2">
                {ACCENTS.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => useSettings.getState().set('accent', option.id)}
                    aria-pressed={accent === option.id}
                    className="flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-[13px] font-medium transition-all"
                    style={{
                      borderColor: accent === option.id ? 'var(--c-accent)' : 'var(--c-line)',
                      background: accent === option.id ? 'var(--c-accent-soft)' : 'var(--c-surface)',
                    }}
                  >
                    <span aria-hidden className="h-4 w-4 rounded-full" style={{ background: option.swatch }} />
                    {t(option.label)}
                    {accent === option.id && <Icon name="check" size={13} strokeWidth={2.6} className="text-accent" />}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-[12px] leading-relaxed text-muted">
                {t(
                  L(
                    'Всеки от тези е проверен за контраст и в двете теми. Настройките за движение и размер на текста са в Настройки → Достъпност.',
                    'Each of these is checked for contrast in both themes. Motion and text size live in Settings → Accessibility.',
                  ),
                )}
              </p>
            </section>
          )}

          {/* ------------------------------------------------- 6 · ready */}
          {step === 6 && (
            <section className="animate-rise text-center">
              <span
                className="animate-pop mx-auto grid h-20 w-20 place-items-center rounded-[16px]"
                style={{ background: 'var(--c-accent-soft)', color: 'var(--c-accent)' }}
              >
                <Icon name="rocket" size={34} strokeWidth={1.7} />
              </span>
              <h1 className="t-h1 mt-6">{t(L('Готово, всичко е на място.', 'Your workspace is ready.'))}</h1>
              <p className="mx-auto mt-3 max-w-[42ch] text-[14px] leading-relaxed text-muted">
                {t(
                  L(
                    'Оттук нататък всичко се пълни само — от часовете, които наистина учиш.',
                    'From here it fills itself in — from the hours you actually put in.',
                  ),
                )}
              </p>

              <div className="mt-7 grid gap-2 text-left sm:grid-cols-3">
                {[
                  { icon: 'user', label: name || t(L('Профил', 'Profile')) },
                  {
                    icon: 'layers',
                    label: t(
                      plural(
                        picked.length,
                        L(`${picked.length} предмет`, `${picked.length} subject`),
                        L(`${picked.length} предмета`, `${picked.length} subjects`),
                      ),
                    ),
                  },
                  { icon: 'timer', label: t(L(`${daily} мин на ден`, `${daily} min a day`)) },
                ].map((row) => (
                  <div key={row.label} className="card-quiet flex items-center gap-2.5 p-3">
                    <Icon name={row.icon} size={16} className="shrink-0 text-accent" />
                    <span className="truncate text-[12.5px] font-medium">{row.label}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="mt-9 flex items-center justify-between gap-3">
            <Button icon="chevronLeft" disabled={step === 0} onClick={() => setStep(Math.max(0, step - 1))}>
              {t(S.back)}
            </Button>
            <div className="flex items-center gap-2">
              {skippable && (
                <Button onClick={() => setStep(step + 1)}>{t(L('Пропусни засега', 'Skip for now'))}</Button>
              )}
              <Button
                variant="primary"
                size="lg"
                iconEnd={step === STEPS - 1 ? 'check' : 'arrowRight'}
                busy={saving}
                disabled={!!usernameProblem}
                onClick={next}
              >
                {step === STEPS - 1 ? t(L('Влез в Plauvia', 'Enter Plauvia')) : t(S.next)}
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function guessName(email?: string | null): string {
  if (!email) return '';
  const base = email.split('@')[0].replace(/[._-]+/g, ' ').trim();
  return base
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
