import { useMemo, useRef, useState } from 'react';
import { useApp } from '@/state/appStore';
import { useAuth } from '@/state/authStore';
import { useWorkspace, SUBJECT_COLORS } from '@/state/workspaceStore';
import { useGame, useGameContext } from '@/state/gameStore';
import { useTimer } from '@/state/timerStore';
import {
  achievementStates,
  currentStreak,
  levelState,
  levelTitle,
  longestStreak,
  totalXp,
  TIER_COLOR,
} from '@/services/gameService';
import { useT, L, useLang, formatDuration, weekdayNames, formatDate } from '@/i18n';
import { S } from '@/i18n/strings';
import { Screen } from '../shell/Screen';
import { ProfileAvatar } from './ProfileAvatar';
import { ACCEPTED_IMAGE_TYPES, makeAvatar } from '@/services/avatarService';
import { Icon } from '../Icon';
import {
  Badge,
  Button,
  Card,
  HeatCalendar,
  ProgressBar,
  StatCard,
  Tooltip,
} from '../kit';

const AVATARS = ['🦉', '🦊', '🐨', '🐼', '🦅', '🐙', '🌿', '🔭', '🎯', '⚡️', '🚀', '📐'];

/**
 * The person, not the settings.
 *
 * Everything here is a consequence of work that was done — hours, streaks,
 * badges — so the page reads as a record of a term rather than as a
 * form. The two editable things (a name and a face) are edited in place.
 */
export function ProfileScreen() {
  const t = useT();
  const lang = useLang();
  const profile = useWorkspace((s) => s.profile);
  const user = useAuth((s) => s.user);
  const sessions = useTimer((s) => s.sessions);
  const ctx = useGameContext();
  const unlocked = useGame((s) => s.unlocked);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile.name);

  const level = useMemo(() => levelState(totalXp(ctx)), [ctx]);
  const streak = useMemo(() => currentStreak(sessions), [sessions]);
  const best = useMemo(() => longestStreak(sessions), [sessions]);
  const minutes = useMemo(() => sessions.reduce((s, x) => s + x.minutes, 0), [sessions]);
  const achievements = useMemo(() => achievementStates(ctx, unlocked).filter((a) => a.earned), [ctx, unlocked]);
  const tasksDone = ctx.items.filter((i) => i.done).length;

  const heat = useMemo(() => {
    const days = new Map<string, number>();
    for (const s of sessions) days.set(s.day, (days.get(s.day) ?? 0) + s.minutes);
    return [...days.entries()].map(([day, value]) => ({
      day,
      value,
      label: `${formatDuration(value, lang)} · ${formatDate(new Date(day).getTime(), lang, { day: 'numeric', month: 'short' })}`,
    }));
  }, [sessions, lang]);

  const memberSince = profile.createdAt || sessions[0]?.startedAt || Date.now();

  const save = async () => {
    await useWorkspace.getState().saveProfile({ name: name.trim() });
    setEditing(false);
  };

  return (
    <Screen
      title={t(S.profile)}
      actions={
        <>
          <Button icon="sliders" onClick={() => useApp.getState().setSettings(true)}>
            {t(S.settings)}
          </Button>
          <Button icon="trophy" variant="outline" onClick={() => useApp.getState().go('achievements')}>
            {t(S.achievements)}
          </Button>
        </>
      }
    >
      {/* ------------------------------------------------------------ header */}
      <Card className="mb-5 overflow-hidden" flush>
        <div
          className="h-20 border-b"
          style={{ background: 'var(--c-surface-2)', borderColor: 'var(--c-line)' }}
        />

        <div className="relative px-5 pb-5 sm:px-6">
          <div className="flex flex-wrap items-end gap-4">
            <span className="relative -mt-11">
              <ProfileAvatar size={76} ring={level.progress} />
            </span>

            <div className="min-w-0 flex-1 pb-1">
              {editing ? (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    autoFocus
                    className="field field-lg max-w-[240px]"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && void save()}
                  />
                  <Button variant="primary" icon="check" onClick={() => void save()}>
                    {t(S.save)}
                  </Button>
                  <Button onClick={() => setEditing(false)}>{t(S.cancel)}</Button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="t-h2">{profile.name || t(L('Без име', 'Unnamed'))}</h2>
                  <button
                    className="icon-btn h-7 w-7"
                    onClick={() => {
                      setName(profile.name);
                      setEditing(true);
                    }}
                    aria-label={t(S.edit)}
                  >
                    <Icon name="pencil" size={14} />
                  </button>
                  <Badge tone="brand" icon="bolt">
                    {t(S.level)} {level.level} · {t(levelTitle(level.level))}
                  </Badge>
                  {streak > 0 && (
                    <Badge tone="ember" icon="flame">
                      {t(L(`${streak} дни поред`, `${streak}-day streak`))}
                    </Badge>
                  )}
                </div>
              )}

              <p className="mt-1.5 text-[12.5px] text-muted">
                {profile.username && (
                  <>
                    <span className="font-medium text-ink">@{profile.username}</span>
                    {' · '}
                  </>
                )}
                {user?.email ?? t(L('Само на това устройство', 'This device only'))}
                {' · '}
                {t(
                  L(
                    `от ${formatDate(memberSince, lang, { month: 'long', year: 'numeric' })}`,
                    `since ${formatDate(memberSince, lang, { month: 'long', year: 'numeric' })}`,
                  ),
                )}
              </p>
            </div>
          </div>

          {editing && (
            <div className="mt-4">
              <p className="t-label mb-2">{t(L('Снимка', 'Photo'))}</p>
              <PhotoControl />

              <p className="t-label mb-2 mt-4">{t(L('Аватар', 'Avatar'))}</p>
              <div className="flex flex-wrap gap-1.5">
                {AVATARS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => void useWorkspace.getState().saveProfile({ avatar: emoji })}
                    className="grid h-9 w-9 cursor-pointer place-items-center rounded-[10px] text-[17px] transition-transform hover:scale-110"
                    style={{
                      background: profile.avatar === emoji ? 'var(--c-accent-soft)' : 'var(--c-surface-2)',
                      border: `1px solid ${profile.avatar === emoji ? 'var(--c-accent)' : 'var(--c-line)'}`,
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <p className="t-label mb-2 mt-4">{t(L('Цвят', 'Colour'))}</p>
              <div className="flex flex-wrap gap-1.5">
                {SUBJECT_COLORS.map((c) => (
                  <button
                    key={c}
                    aria-label={c}
                    onClick={() => void useWorkspace.getState().saveProfile({ color: c })}
                    className="h-7 w-7 cursor-pointer rounded-full transition-transform hover:scale-110"
                    style={{
                      background: c,
                      boxShadow: profile.color === c ? `0 0 0 3px color-mix(in srgb, ${c} 30%, transparent)` : undefined,
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="mt-5">
            <div className="mb-1.5 flex items-baseline justify-between text-[12px]">
              <span className="font-medium">
                {t(L('Ниво', 'Level'))} {level.level}
              </span>
              <span className="t-num text-muted">
                {level.xp} / {level.ceiling} XP
              </span>
            </div>
            <ProgressBar value={level.progress} height={7} />
          </div>
        </div>
      </Card>

      {/* ------------------------------------------------------------- stats */}
      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t(L('Учене общо', 'Total studied'))}
          value={formatDuration(minutes, lang)}
          icon="timer"
          hint={t(L(`${sessions.length} сесии`, `${sessions.length} sessions`))}
        />
        <StatCard
          label={t(L('Завършени задачи', 'Tasks completed'))}
          value={tasksDone}
          icon="checkCircle"
          tone="var(--c-aurora)"
        />
        <StatCard
          label={t(L('Най-дълга серия', 'Longest streak'))}
          value={best}
          unit={t(L('дни', 'days'))}
          icon="flame"
          tone="var(--c-ember)"
          hint={streak > 0 ? t(L(`Сега: ${streak}`, `Now: ${streak}`)) : undefined}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card
          title={t(L('Активност', 'Activity'))}
          subtitle={t(L('последните 20 седмици', 'the last 20 weeks'))}
          icon="flame"
        >
          <HeatCalendar days={heat} weekdayLabels={weekdayNames(lang)} />
          <div className="mt-4 flex items-center gap-2 text-[11px] text-faint">
            <span>{t(L('по-малко', 'less'))}</span>
            {[0, 1, 2, 3, 4].map((level) => (
              <span
                key={level}
                className="h-3 w-3 rounded-[3px]"
                style={{
                  background:
                    level === 0
                      ? 'var(--c-surface-3)'
                      : `color-mix(in srgb, var(--c-brand) ${level * 22 + 12}%, var(--c-surface-3))`,
                }}
              />
            ))}
            <span>{t(L('повече', 'more'))}</span>
          </div>
        </Card>

        <Card
          title={t(S.achievements)}
          subtitle={t(L(`${achievements.length} отключени`, `${achievements.length} unlocked`))}
          icon="trophy"
          action={
            <button
              className="text-[12px] font-medium text-muted transition-colors hover:text-accent"
              onClick={() => useApp.getState().go('achievements')}
            >
              {t(S.all)}
            </button>
          }
        >
          {achievements.length === 0 ? (
            <p className="text-[12.5px] text-muted">
              {t(L('Първата сесия отключва първото постижение.', 'Your first session unlocks the first one.'))}
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {achievements.slice(0, 12).map((a) => (
                <Tooltip key={a.id} label={t(a.title)}>
                  <span
                    className="grid h-11 w-11 place-items-center rounded-[10px] text-white"
                    style={{
                      background: `linear-gradient(140deg, ${TIER_COLOR[a.tier]}, color-mix(in srgb, ${TIER_COLOR[a.tier]} 60%, #000))`,
                    }}
                  >
                    <Icon name={a.icon} size={19} strokeWidth={1.9} />
                  </span>
                </Tooltip>
              ))}
            </div>
          )}
        </Card>
      </div>
    </Screen>
  );
}

/**
 * Changing the face after the fact.
 *
 * The same three affordances the sign-up step offers, which is the point —
 * somebody who skipped the photo then should meet the identical control here
 * rather than a different-shaped one that happens to do the same job.
 *
 * Removing a photo falls back to the emoji picker directly below it, which is
 * why the two sit together: "remove" here has a visible consequence a few
 * pixels down, instead of being a button that appears to empty something.
 */
function PhotoControl() {
  const t = useT();
  const profile = useWorkspace((s) => s.profile);
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const take = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const { dataUrl } = await makeAvatar(file);
      await useWorkspace.getState().saveProfile({ photo: dataUrl });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t(L('Снимката не можа да се обработи.', 'That image could not be processed.')),
      );
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3">
        <ProfileAvatar size={52} />
        <input
          ref={input}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES}
          className="sr-only"
          onChange={(e) => void take(e.target.files?.[0])}
        />
        <Button icon={busy ? 'refresh' : 'upload'} onClick={() => input.current?.click()} disabled={busy}>
          {t(profile.photo ? L('Друга снимка', 'Change photo') : L('Качи снимка', 'Upload a photo'))}
        </Button>
        {profile.photo && (
          <Button icon="trash" onClick={() => void useWorkspace.getState().saveProfile({ photo: '' })}>
            {t(L('Премахни', 'Remove'))}
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-2 flex items-center gap-1.5 text-[12px]" style={{ color: 'var(--c-danger)' }}>
          <Icon name="alert" size={12} />
          {error}
        </p>
      )}
    </div>
  );
}
