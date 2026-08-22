import { useMemo, useState } from 'react';
import { useWorkspace, SUBJECT_COLORS } from '@/state/workspaceStore';
import { useSettings } from '@/state/settingsStore';
import { useGoals } from '@/state/goalStore';
import { useAuth } from '@/state/authStore';
import { gameContext } from '@/state/gameStore';
import { useT, L, useLangStore, type Lang } from '@/i18n';
import { S } from '@/i18n/strings';
import { BRAND } from '@/brand';
import { PlauviaMark, PlauviaTile, PlauviaWordmark } from '../brand/Logo';
import { Icon } from '../Icon';
import { Button, ProgressCells } from '../kit';

const SUGGESTIONS: { icon: string; bg: string; en: string }[] = [
  { icon: 'sigma', bg: 'Математика', en: 'Mathematics' },
  { icon: 'book', bg: 'Български език и литература', en: 'Literature' },
  { icon: 'globe', bg: 'Английски език', en: 'English' },
  { icon: 'atom', bg: 'Физика', en: 'Physics' },
  { icon: 'flask', bg: 'Химия', en: 'Chemistry' },
  { icon: 'leaf', bg: 'Биология', en: 'Biology' },
  { icon: 'target', bg: 'История', en: 'History' },
  { icon: 'globe', bg: 'География', en: 'Geography' },
  { icon: 'code', bg: 'Информатика', en: 'Computer science' },
  { icon: 'palette', bg: 'Изкуство', en: 'Art' },
];

const AVATARS = ['🦉', '🦊', '🐨', '🐼', '🦅', '🐙', '🌿', '🔭', '🎯', '⚡️', '🚀', '📐'];

const STEPS = 4;

/**
 * The first four minutes.
 *
 * It asks for exactly what the product cannot work out on its own — a name,
 * the subjects, how long a session is — and every answer becomes a real
 * record, so the dashboard behind it opens with something on it instead of
 * five empty states. Every step can be skipped; nothing here is a gate.
 */
export function Onboarding({ onDone }: { onDone: () => void }) {
  const t = useT();
  const lang = useLangStore((s) => s.lang);
  const setLang = useLangStore((s) => s.setLang);
  const user = useAuth((s) => s.user);
  const profile = useWorkspace((s) => s.profile);

  const [step, setStep] = useState(0);
  const [name, setName] = useState(profile.name || guessName(user?.email));
  const [avatar, setAvatar] = useState(profile.avatar || '🦉');
  const [color, setColor] = useState(profile.color || SUBJECT_COLORS[0]);
  const [picked, setPicked] = useState<string[]>([]);
  const [custom, setCustom] = useState('');
  const [daily, setDaily] = useState(90);
  const [session, setSession] = useState(25);
  const [wantGoal, setWantGoal] = useState(true);
  const [saving, setSaving] = useState(false);

  const names = useMemo(() => SUGGESTIONS.map((s) => (lang === 'bg' ? s.bg : s.en)), [lang]);

  const finish = async () => {
    setSaving(true);
    const workspace = useWorkspace.getState();
    await workspace.saveProfile({ name: name.trim(), avatar, color, createdAt: Date.now() });

    for (const label of picked) {
      const suggestion = SUGGESTIONS.find((s) => (lang === 'bg' ? s.bg : s.en) === label);
      await workspace.createSubject({ name: label, icon: suggestion?.icon ?? 'book' });
    }

    useSettings.getState().setTimer({ goal: daily, work: session });

    if (wantGoal) {
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

    onDone();
  };

  const next = () => (step === STEPS - 1 ? void finish() : setStep(step + 1));

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
            {lang === 'bg' ? BRAND.tagline.bg : BRAND.tagline.en}
          </h2>
          <p className="mt-3 max-w-[34ch] text-[14px] leading-relaxed opacity-85">
            {lang === 'bg' ? BRAND.description.bg : BRAND.description.en}
          </p>

          <ul className="mt-8 space-y-3 text-[13.5px]">
            {[
              L('Планираш седмицата и виждаш какво гори днес', 'Plan the week and see what is burning today'),
              L('Решаваш направо върху страницата на учебника', 'Solve straight on the textbook page'),
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
            <div className="segmented">
              {(['bg', 'en'] as Lang[]).map((code) => (
                <button key={code} aria-pressed={lang === code} onClick={() => setLang(code)}>
                  {code.toUpperCase()}
                </button>
              ))}
            </div>
            <Button onClick={onDone}>{t(S.skip)}</Button>
          </div>
        </header>

        <div className="mx-auto flex w-full max-w-[560px] flex-1 flex-col justify-center px-5 py-8 sm:px-8">
          <div className="mb-7">
            <ProgressCells value={(step + 1) / STEPS} cells={STEPS} />
            <p className="t-label mt-2.5">
              {t(L(`Стъпка ${step + 1} от ${STEPS}`, `Step ${step + 1} of ${STEPS}`))}
            </p>
          </div>

          {step === 0 && (
            <section className="animate-rise">
              <h1 className="t-h1">{t(L('Как да те наричаме?', 'What should we call you?'))}</h1>
              <p className="mt-2 text-[14px] text-muted">
                {t(L('Използва се само за поздрава — нищо не се изпраща никъде.', 'Only used for the greeting — nothing leaves your device.'))}
              </p>

              <input
                autoFocus
                className="field field-lg mt-6"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t(L('Твоето име', 'Your name'))}
                onKeyDown={(e) => e.key === 'Enter' && next()}
              />

              <p className="t-label mt-6 mb-2">{t(L('Аватар', 'Avatar'))}</p>
              <div className="flex flex-wrap gap-2">
                {AVATARS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => setAvatar(emoji)}
                    className="grid h-11 w-11 cursor-pointer place-items-center rounded-[13px] text-[20px] transition-all"
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

              <p className="t-label mt-6 mb-2">{t(L('Твоят цвят', 'Your colour'))}</p>
              <div className="flex flex-wrap gap-2">
                {SUBJECT_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
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

          {step === 1 && (
            <section className="animate-rise">
              <h1 className="t-h1">{t(L('Какво учиш?', 'What are you studying?'))}</h1>
              <p className="mt-2 text-[14px] text-muted">
                {t(L('Предметите подреждат всичко останало — материали, задачи, часове и статистика.', 'Subjects organise everything else — materials, tasks, hours and statistics.'))}
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                {names.map((label, i) => {
                  const active = picked.includes(label);
                  const tint = SUBJECT_COLORS[i % SUBJECT_COLORS.length];
                  return (
                    <button
                      key={label}
                      onClick={() => setPicked(active ? picked.filter((x) => x !== label) : [...picked, label])}
                      className="flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-[13px] font-medium transition-all"
                      style={{
                        borderColor: active ? tint : 'var(--c-line)',
                        background: active ? `color-mix(in srgb, ${tint} 12%, transparent)` : 'var(--c-surface)',
                        color: active ? tint : 'var(--c-muted)',
                      }}
                    >
                      <Icon name={SUGGESTIONS[i].icon} size={14} />
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
                  placeholder={t(L('Друг предмет…', 'Another subject…'))}
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

          {step === 2 && (
            <section className="animate-rise">
              <h1 className="t-h1">{t(L('Кога учиш?', 'How do you study?'))}</h1>
              <p className="mt-2 text-[14px] text-muted">
                {t(L('Настройва дневната цел и дължината на фокус сесията. И двете се променят по всяко време.', 'Sets your daily goal and the length of a focus session. Both change any time.'))}
              </p>

              <p className="t-label mt-7 mb-2">{t(L('Цел за деня', 'Daily goal'))}</p>
              <div className="grid grid-cols-4 gap-2">
                {[30, 60, 90, 120].map((m) => (
                  <button
                    key={m}
                    onClick={() => setDaily(m)}
                    className="cursor-pointer rounded-[14px] border p-3 text-center transition-all"
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

              <p className="t-label mt-6 mb-2">{t(L('Една сесия', 'One session'))}</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { m: 25, label: L('Помодоро', 'Pomodoro') },
                  { m: 45, label: L('Учебен час', 'School hour') },
                  { m: 50, label: L('Дълъг блок', 'Deep block') },
                ].map((option) => (
                  <button
                    key={option.m}
                    onClick={() => setSession(option.m)}
                    className="cursor-pointer rounded-[14px] border p-3 text-left transition-all"
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

              <label
                className="mt-6 flex cursor-pointer items-start gap-3 rounded-[14px] border border-line p-3.5"
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

          {step === 3 && (
            <section className="animate-rise text-center">
              <span
                className="animate-pop mx-auto grid h-20 w-20 place-items-center rounded-[26px] text-white"
                style={{ background: 'var(--grad-brand)', boxShadow: 'var(--glow-brand)' }}
              >
                <Icon name="rocket" size={34} strokeWidth={1.7} />
              </span>
              <h1 className="t-h1 mt-6">
                {t(L('Готово, всичко е на място.', 'Your workspace is ready.'))}
              </h1>
              <p className="mx-auto mt-3 max-w-[42ch] text-[14px] leading-relaxed text-muted">
                {t(
                  L(
                    'Таблото вече знае предметите ти, дневната цел и първата ти цел. Оттук нататък всичко се пълни само — от часовете, които наистина учиш.',
                    'The dashboard already knows your subjects, your daily goal and your first goal. From here it fills itself in — from the hours you actually put in.',
                  ),
                )}
              </p>

              <div className="mt-7 grid gap-2 text-left sm:grid-cols-3">
                {[
                  { icon: 'user', label: name || t(L('Профил', 'Profile')) },
                  { icon: 'layers', label: t(L(`${picked.length} предмета`, `${picked.length} subjects`)) },
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
            <Button
              icon="chevronLeft"
              disabled={step === 0}
              onClick={() => setStep(Math.max(0, step - 1))}
            >
              {t(S.back)}
            </Button>
            <Button variant="primary" size="lg" iconEnd={step === STEPS - 1 ? 'check' : 'arrowRight'} busy={saving} onClick={next}>
              {step === STEPS - 1 ? t(L('Влез в Plauvia', 'Enter Plauvia')) : t(S.next)}
            </Button>
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
