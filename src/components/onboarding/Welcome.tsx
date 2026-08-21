import { useState } from 'react';
import {
  SUBJECT_COLORS,
  SUGGESTED_SUBJECTS,
  useWorkspace,
} from '@/state/workspaceStore';
import { useSettings } from '@/state/settingsStore';
import { useAuth } from '@/state/authStore';
import { AuthDialog } from '../auth/AuthDialog';
import { Icon } from '../Icon';

const AVATARS = ['🦉', '🐨', '🦊', '🐼', '🐢', '🦁', '🐙', '🦄', '🐝', '🌿', '⚡', '🚀'];

/**
 * Two screens, then out of the way. The only things worth asking up front are
 * a name (so the app can talk to you) and the subjects (because everything
 * else in the app hangs off them).
 */
export function Welcome() {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [color, setColor] = useState(SUBJECT_COLORS[0]);
  const [grade, setGrade] = useState('');
  const [picked, setPicked] = useState<string[]>(SUGGESTED_SUBJECTS.slice(0, 5).map((s) => s.name));
  const [goal, setGoal] = useState(120);
  const [busy, setBusy] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const user = useAuth((s) => s.user);

  const finish = async () => {
    setBusy(true);
    const ws = useWorkspace.getState();
    // Signing in first pulls the real subjects down; adding the suggestions on
    // top would leave the student with two of everything.
    const restored = ws.subjects.length > 0;
    for (const [i, name] of (restored ? [] : picked).entries()) {
      const suggestion = SUGGESTED_SUBJECTS.find((s) => s.name === name);
      await ws.createSubject({
        name,
        icon: suggestion?.icon ?? 'book',
        color: SUBJECT_COLORS[i % SUBJECT_COLORS.length],
      });
    }
    useSettings.getState().setTimer({ goal });
    await ws.saveProfile({ name: name.trim(), avatar, color, grade: grade.trim(), onboarded: true });
  };

  return (
    <div className="grid h-full place-items-center overflow-y-auto px-5 py-8">
      <div className="w-full max-w-lg">
        <div className="mb-6 flex items-center gap-3">
          <span
            className="grid h-11 w-11 place-items-center rounded-xl"
            style={{ background: 'var(--c-accent)', color: 'var(--c-accent-text)' }}
          >
            <Icon name="book" size={22} />
          </span>
          <div>
            <h1 className="text-[20px] font-semibold tracking-tight">StudyDesk</h1>
            <p className="text-[12px] text-muted">Учебници, дъски, карти и планер на едно място</p>
          </div>
        </div>

        {step === 0 ? (
          <div className="panel p-5">
            <h2 className="text-[16px] font-medium">Здравей! Как да ти казвам?</h2>
            <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
              Всичко се пази в този браузър и работи офлайн. Ако искаш същата библиотека и на
              телефона, можеш да добавиш профил — сега или по-късно.
            </p>

            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && setStep(1)}
              placeholder="Име"
              className="field mt-4 h-10"
            />

            <div className="mt-4">
              <span className="mb-1.5 block label">
                Аватар
              </span>
              <div className="flex flex-wrap gap-1.5">
                {AVATARS.map((a) => (
                  <button
                    key={a}
                    onClick={() => setAvatar(a)}
                    className="grid h-10 w-10 cursor-pointer place-items-center rounded-xl text-[19px] transition-transform hover:scale-105"
                    style={{
                      background:
                        avatar === a ? `color-mix(in srgb, ${color} 20%, transparent)` : 'var(--c-surface-2)',
                      outline: avatar === a ? `1.5px solid ${color}` : '1px solid var(--c-line)',
                    }}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-end gap-3">
              <div className="min-w-0 flex-1">
                <span className="mb-1.5 block label">
                  Клас или курс (по избор)
                </span>
                <input
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  placeholder="напр. 11 клас"
                  className="field"
                />
              </div>
              <div>
                <span className="mb-1.5 block label">
                  Цвят
                </span>
                <div className="flex gap-1.5">
                  {SUBJECT_COLORS.slice(0, 6).map((c) => (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      className="h-7 w-7 cursor-pointer rounded-full transition-transform hover:scale-110"
                      style={{
                        background: c,
                        outline: color === c ? '2px solid var(--c-accent)' : '1px solid var(--c-line)',
                        outlineOffset: 2,
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <button className="btn btn-primary mt-5 h-10 w-full" onClick={() => setStep(1)}>
              Напред
              <Icon name="chevronRight" size={15} />
            </button>

            <button
              className="btn mt-2 h-9 w-full text-muted"
              onClick={() => setAuthOpen(true)}
            >
              <Icon name="cloud" size={15} />
              {user ? 'Влязъл си — данните ще се изтеглят' : 'Вече имам профил'}
            </button>
          </div>
        ) : (
          <div className="panel p-5">
            <h2 className="text-[16px] font-medium">Кои предмети учиш?</h2>
            <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
              По тях се подрежда всичко останало — материалите, картите, задачите и статистиката.
              Можеш да ги смениш по всяко време.
            </p>

            <div className="mt-4 flex flex-wrap gap-1.5">
              {SUGGESTED_SUBJECTS.map((s, i) => {
                const on = picked.includes(s.name);
                const c = SUBJECT_COLORS[i % SUBJECT_COLORS.length];
                return (
                  <button
                    key={s.name}
                    onClick={() =>
                      setPicked((p) => (on ? p.filter((x) => x !== s.name) : [...p, s.name]))
                    }
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

            <div className="mt-5">
              <span className="mb-1.5 block label">
                Дневна цел за учене
              </span>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={30}
                  max={360}
                  step={15}
                  value={goal}
                  onChange={(e) => setGoal(Number(e.target.value))}
                  className="flex-1 cursor-pointer accent-[var(--c-accent)]"
                />
                <span className="w-20 shrink-0 text-right text-[13px] tabular-nums">
                  {Math.floor(goal / 60)} ч {goal % 60 ? `${goal % 60} мин` : ''}
                </span>
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <button className="btn h-10" onClick={() => setStep(0)}>
                <Icon name="chevronLeft" size={15} />
                Назад
              </button>
              <button className="btn btn-primary h-10 flex-1" disabled={busy} onClick={() => void finish()}>
                <Icon name="sparkles" size={15} />
                Готово, да започваме
              </button>
            </div>
          </div>
        )}

        <p className="mt-4 text-center text-[11px] leading-relaxed text-faint">
          Съвет: направи резервно копие от Настройки → Резервно копие, ако смениш браузър или
          устройство.
        </p>
      </div>

      <AuthDialog open={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  );
}
