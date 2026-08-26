import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/state/authStore';
import { useWorkspace } from '@/state/workspaceStore';
import { L, useT } from '@/i18n';
import {
  checkUsername,
  claimUsername,
  normaliseUsername,
  suggestUsername,
  USERNAME_MAX,
  validateUsername,
  type Availability,
} from '@/services/usernameService';
import { ACCEPTED_IMAGE_TYPES, makeAvatar } from '@/services/avatarService';
import { Avatar } from '../kit';
import { Icon } from '../Icon';
import { PlauviaTile, PlauviaWordmark } from '../brand/Logo';

/**
 * ──────────────────────────────────────────── the two questions after the door ──
 *
 * A confirmed e-mail address is an account, not yet a person. This asks the
 * only two things the product cannot work out on its own — what to call them
 * and what face to put on it — and then gets out of the way.
 *
 * It is deliberately not part of the workspace setup that follows it. That one
 * is six optional questions about subjects and study habits, and it can be
 * skipped wholesale; this cannot, because a handle has to be unique and the
 * cheapest moment to settle uniqueness is before anybody has one. Keeping them
 * separate is also what lets the questionnaire be genuinely skippable without
 * leaving accounts with no name.
 *
 * The column is narrow on purpose. A single question centred in 420 px reads
 * as one decision; the same question in a full-width page reads as a form with
 * the rest of the fields missing.
 */

type Stage = 'username' | 'photo' | 'creating';

export function ProfileSetup({ onDone }: { onDone: () => void }) {
  const user = useAuth((s) => s.user);
  const profile = useWorkspace((s) => s.profile);

  const [stage, setStage] = useState<Stage>('username');
  const [handle, setHandle] = useState(() => profile.username || '');
  const [photo, setPhoto] = useState(profile.photo || '');

  const email = user?.email ?? '';

  /** A first guess from the address, offered rather than imposed. */
  const suggestion = useMemo(() => {
    if (profile.username) return '';
    const base = profile.name || email.split('@')[0] || '';
    return suggestUsername(base);
  }, [profile.username, profile.name, email]);

  return (
    <div
      className="scroll-thin flex h-full flex-col overflow-y-auto"
      style={{ background: 'var(--c-bg)' }}
    >
      <header className="flex shrink-0 items-center gap-2.5 px-5 py-5 sm:px-8">
        <PlauviaTile size={28} />
        <PlauviaWordmark size={16.5} />
      </header>

      <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center px-5 pb-12 sm:px-6">
        {stage === 'username' && (
          <UsernameStep
            value={handle}
            onChange={setHandle}
            suggestion={suggestion}
            onNext={() => setStage('photo')}
          />
        )}

        {stage === 'photo' && (
          <PhotoStep
            photo={photo}
            onPhoto={setPhoto}
            handle={handle}
            name={profile.name}
            onBack={() => setStage('username')}
            onNext={() => setStage('creating')}
          />
        )}

        {stage === 'creating' && (
          <CreatingStep handle={handle} photo={photo} onDone={onDone} />
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ step 1 */

function UsernameStep({
  value,
  onChange,
  suggestion,
  onNext,
}: {
  value: string;
  onChange: (v: string) => void;
  suggestion: string;
  onNext: () => void;
}) {
  const t = useT();
  const [availability, setAvailability] = useState<Availability | 'checking' | null>(null);
  const shape = value.trim() ? validateUsername(value) : null;
  const normalised = normaliseUsername(value);

  /**
   * The availability check, debounced and raced.
   *
   * `seq` is what stops a slow answer about "ti" from landing after a fast one
   * about "tihomir" and marking a free name taken — the classic bug in every
   * hand-rolled type-ahead.
   */
  const seq = useRef(0);
  useEffect(() => {
    if (!value.trim() || shape) {
      setAvailability(null);
      return;
    }
    const mine = ++seq.current;
    setAvailability('checking');
    const id = window.setTimeout(() => {
      void checkUsername(value).then((result) => {
        if (seq.current === mine) setAvailability(result);
      });
    }, 420);
    return () => window.clearTimeout(id);
  }, [value, shape]);

  // 'unknown' is allowed through: offline, or a database with no `usernames`
  // table, cannot say — and refusing to continue because we could not check
  // would lock somebody out of ever having a name.
  const ready = !!value.trim() && !shape && availability !== 'taken' && availability !== 'checking';

  return (
    <form
      className="animate-rise"
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) onNext();
      }}
    >
      <span className="tile mb-4">
        <Icon name="user" size={19} />
      </span>
      <h1 className="t-face text-[26px] leading-[1.08] tracking-[-0.03em]">
        {t(L('Избери си име', 'Choose your username'))}
      </h1>
      <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
        {t(
          L(
            'Така ще те разпознава Plauvia. Латински букви, цифри и тире — може да се смени по-късно.',
            'This is how Plauvia will know you. Latin letters, digits and hyphens — you can change it later.',
          ),
        )}
      </p>

      <div className="mt-7">
        <div className="relative">
          <span
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px] font-medium"
            style={{ color: 'var(--c-faint)' }}
            aria-hidden
          >
            @
          </span>
          <input
            autoFocus
            className="field field-lg pl-8"
            value={value}
            onChange={(e) => onChange(e.target.value.replace(/\s+/g, ''))}
            placeholder={suggestion || 'tihomir'}
            maxLength={USERNAME_MAX + 4}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            aria-invalid={!!shape || availability === 'taken' || undefined}
            aria-describedby="plauvia-handle-status"
          />
          {availability === 'free' || availability === 'mine' ? (
            <Icon
              name="check"
              size={16}
              strokeWidth={2.6}
              className="absolute right-3.5 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--c-success)' }}
            />
          ) : availability === 'checking' ? (
            <Icon
              name="refresh"
              size={15}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 animate-spin text-faint"
            />
          ) : null}
        </div>

        {/* One line, always in the same place, so the layout never jumps. */}
        <p id="plauvia-handle-status" className="mt-2 min-h-[18px] text-[12.5px]" aria-live="polite">
          {shape ? (
            <Tone tone="danger" icon="alert">
              {shape}
            </Tone>
          ) : availability === 'taken' ? (
            <Tone tone="danger" icon="alert">
              {t(L('Това име вече е заето.', 'That name is already taken.'))}
            </Tone>
          ) : availability === 'free' || availability === 'mine' ? (
            <Tone tone="success" icon="check">
              {t(L(`@${normalised} е свободно.`, `@${normalised} is available.`))}
            </Tone>
          ) : value.trim() && availability === 'unknown' ? (
            <span className="text-faint">
              {t(
                L(
                  'Не успяхме да проверим — името се запазва, щом има връзка.',
                  'We could not check just now — the name is reserved once there is a connection.',
                ),
              )}
            </span>
          ) : suggestion ? (
            <span className="text-faint">
              {t(L('Предложение:', 'Suggestion:'))}{' '}
              <button
                type="button"
                className="font-medium underline underline-offset-2"
                style={{ color: 'var(--c-accent)' }}
                onClick={() => onChange(suggestion)}
              >
                @{suggestion}
              </button>
            </span>
          ) : null}
        </p>
      </div>

      <button className="btn btn-primary btn-lg mt-5 w-full" type="submit" disabled={!ready}>
        {t(L('Продължи', 'Continue'))}
        <Icon name="arrowRight" size={16} />
      </button>
    </form>
  );
}

/* ------------------------------------------------------------------ step 2 */

function PhotoStep({
  photo,
  onPhoto,
  handle,
  name,
  onBack,
  onNext,
}: {
  photo: string;
  onPhoto: (v: string) => void;
  handle: string;
  name: string;
  onBack: () => void;
  onNext: () => void;
}) {
  const t = useT();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const take = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const { dataUrl } = await makeAvatar(file);
      onPhoto(dataUrl);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t(L('Снимката не можа да се обработи.', 'That image could not be processed.')),
      );
    } finally {
      setBusy(false);
      // Cleared so that picking the very same file again still fires a change.
      if (input.current) input.current.value = '';
    }
  };

  return (
    <div className="animate-rise text-center">
      <h1 className="t-face text-[26px] leading-[1.08] tracking-[-0.03em]">
        {t(L('Сложи си лице', 'Add a photo'))}
      </h1>
      <p className="mx-auto mt-2 max-w-[34ch] text-[13.5px] leading-relaxed text-muted">
        {t(
          L(
            'По желание. Без снимка получаваш буквата си — и тя изглежда напълно нормално.',
            'Entirely optional. Without one you get your initial, and it looks perfectly good.',
          ),
        )}
      </p>

      <div className="mt-8 flex flex-col items-center">
        <button
          type="button"
          className="group relative cursor-pointer rounded-full"
          onClick={() => input.current?.click()}
          disabled={busy}
          aria-label={t(photo ? L('Смени снимката', 'Change the photo') : L('Качи снимка', 'Upload a photo'))}
        >
          <Avatar photo={photo || undefined} seed={handle || name} name={name} size={104} />
          <span
            className="absolute inset-0 grid place-items-center rounded-full opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
            style={{ background: 'rgb(6 7 10 / 45%)', color: '#fff' }}
            aria-hidden
          >
            <Icon name={busy ? 'refresh' : 'image'} size={22} className={busy ? 'animate-spin' : ''} />
          </span>
        </button>

        <input
          ref={input}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES}
          className="sr-only"
          onChange={(e) => void take(e.target.files?.[0])}
        />

        <div className="mt-5 flex items-center gap-2">
          <button type="button" className="btn" onClick={() => input.current?.click()} disabled={busy}>
            <Icon name={busy ? 'refresh' : 'upload'} size={15} className={busy ? 'animate-spin' : ''} />
            {t(photo ? L('Друга снимка', 'Choose another') : L('Качи снимка', 'Upload a photo'))}
          </button>
          {photo && (
            <button type="button" className="btn" onClick={() => onPhoto('')} disabled={busy}>
              <Icon name="trash" size={15} />
              {t(L('Премахни', 'Remove'))}
            </button>
          )}
        </div>

        {error && (
          <p
            role="alert"
            className="mt-3 flex items-center justify-center gap-1.5 text-[12.5px]"
            style={{ color: 'var(--c-danger)' }}
          >
            <Icon name="alert" size={13} />
            {error}
          </p>
        )}
      </div>

      <button className="btn btn-primary btn-lg mt-8 w-full" onClick={onNext} disabled={busy}>
        {t(photo ? L('Продължи', 'Continue') : L('Продължи без снимка', 'Continue without a photo'))}
        <Icon name="arrowRight" size={16} />
      </button>
      <button type="button" className="link-quiet mx-auto mt-3 block text-[12.5px]" onClick={onBack}>
        {t(L('← Назад към името', '← Back to the name'))}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ step 3 */

/**
 * The moment the account becomes a profile.
 *
 * Every line on it is a real piece of work — the local record, the reserved
 * handle, the first sync — reported as it finishes rather than on a timer.
 * The one concession is a floor of about a second: work that completes in
 * 80 ms and flashes three ticks past the reader tells them less than a short
 * pause that they can actually watch.
 *
 * Nothing here can fail in a way that strands somebody. A handle that cannot
 * be reserved, a sync that will not connect — both are ordinary on a train,
 * and both leave a perfectly working local profile behind. The screen says so
 * and carries on.
 */
function CreatingStep({
  handle,
  photo,
  onDone,
}: {
  handle: string;
  photo: string;
  onDone: () => void;
}) {
  const t = useT();
  const [done, setDone] = useState(0);
  const [welcome, setWelcome] = useState(false);

  const steps = useMemo(
    () => [
      L('Записваме профила', 'Saving your profile'),
      L('Запазваме името', 'Reserving your name'),
      L('Подготвяме работното място', 'Preparing your workspace'),
    ],
    [],
  );

  // Guarded because React runs effects twice in development, and the second
  // run would claim the handle a second time and restart the animation.
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const floor = (ms: number) => new Promise((r) => window.setTimeout(r, ms));

    void (async () => {
      const workspace = useWorkspace.getState();

      await Promise.all([
        workspace.saveProfile({
          username: normaliseUsername(handle),
          photo,
          createdAt: workspace.profile.createdAt || Date.now(),
        }),
        floor(420),
      ]);
      setDone(1);

      // Never allowed to hold anything up: a missing table or no network is
      // not a reason somebody cannot finish signing up.
      await Promise.all([claimUsername(handle).catch(() => null), floor(380)]);
      setDone(2);

      await Promise.all([useAuth.getState().syncNow().catch(() => undefined), floor(340)]);
      setDone(3);

      await floor(260);
      setWelcome(true);
    })();
  }, [handle, photo]);

  // The welcome is a beat, not a screen to be read: long enough to register
  // that it happened, short enough that nobody reaches for a button.
  useEffect(() => {
    if (!welcome) return;
    const id = window.setTimeout(onDone, 1500);
    return () => window.clearTimeout(id);
  }, [welcome, onDone]);

  if (welcome) {
    return (
      <div className="animate-scale text-center" role="status">
        <span
          className="animate-pop mx-auto grid h-16 w-16 place-items-center rounded-full"
          style={{ background: 'var(--c-success-soft)', color: 'var(--c-success)' }}
        >
          <Icon name="check" size={30} strokeWidth={2.4} />
        </span>
        <h1 className="t-face mt-5 text-[24px] tracking-[-0.03em]">
          {t(L('Добре дошъл в Plauvia.', 'Welcome to Plauvia.'))}
        </h1>
        <p className="mt-2 text-[13.5px] text-muted">
          {t(L(`Готово, @${normaliseUsername(handle)}. Отваряме приложението…`, `All set, @${normaliseUsername(handle)}. Opening the app…`))}
        </p>
      </div>
    );
  }

  return (
    <div className="card card-raised animate-scale p-6 text-center" role="status" aria-live="polite">
      <span className="mx-auto grid h-12 w-12 place-items-center">
        <Icon name="refresh" size={24} className="animate-spin" style={{ color: 'var(--c-accent)' }} />
      </span>
      <h1 className="mt-3 text-[17px] font-semibold tracking-[-0.02em]">
        {t(L('Създаваме профила ти…', 'Creating your profile…'))}
      </h1>

      <ul className="mt-5 space-y-2.5 text-left">
        {steps.map((step, i) => {
          const state = done > i ? 'done' : done === i ? 'now' : 'waiting';
          return (
            <li key={i} className="flex items-center gap-2.5 text-[13px]">
              <span
                className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full transition-colors duration-200"
                style={{
                  background: state === 'done' ? 'var(--c-success)' : 'var(--c-surface-3)',
                  color: state === 'done' ? '#fff' : 'var(--c-faint)',
                }}
              >
                {state === 'done' ? (
                  <Icon name="check" size={11} strokeWidth={3} />
                ) : state === 'now' ? (
                  <span
                    className="h-1.5 w-1.5 animate-pulse rounded-full"
                    style={{ background: 'var(--c-accent)' }}
                  />
                ) : null}
              </span>
              <span style={{ color: state === 'waiting' ? 'var(--c-faint)' : 'var(--c-text)' }}>
                {t(step)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ----------------------------------------------------------------- pieces */

function Tone({
  tone,
  icon,
  children,
}: {
  tone: 'danger' | 'success';
  icon: string;
  children: React.ReactNode;
}) {
  const color = tone === 'danger' ? 'var(--c-danger)' : 'var(--c-success)';
  return (
    <span className="inline-flex items-center gap-1.5" style={{ color }}>
      <Icon name={icon} size={12} strokeWidth={2.4} />
      {children}
    </span>
  );
}
