import { useMemo, useState } from 'react';
import { useGame, useGameContext } from '@/state/gameStore';
import {
  achievementStates,
  levelState,
  levelTitle,
  xpBreakdown,
  xpForLevel,
  TIER_COLOR,
  TIER_LABEL,
  type AchievementState,
} from '@/services/gameService';
import { useT, L, useLang, formatDate, formatDuration } from '@/i18n';
import { S } from '@/i18n/strings';
import { Screen } from '../shell/Screen';
import { Icon } from '../Icon';
import { Badge, Card, ProgressBar, ProgressRing, Tabs } from '../kit';

/**
 * Levels and badges, backed by the record.
 *
 * Every number on this screen is recomputed from minutes studied, tasks
 * ticked, cards reviewed and goals finished — there is no separate XP ledger
 * to drift out of sync, and no badge that can be earned by opening the app.
 */
export function AchievementsScreen() {
  const t = useT();
  const lang = useLang();
  const ctx = useGameContext();
  const unlocked = useGame((s) => s.unlocked);
  const [tab, setTab] = useState<'all' | 'earned' | 'locked'>('all');

  const xp = useMemo(() => xpBreakdown(ctx), [ctx]);
  const level = useMemo(() => levelState(xp.total), [xp.total]);
  const list = useMemo(() => achievementStates(ctx, unlocked), [ctx, unlocked]);

  const earned = list.filter((a) => a.earned);
  const locked = list.filter((a) => !a.earned);
  const shown = tab === 'earned' ? earned : tab === 'locked' ? locked : [...earned, ...locked];

  const sources: { label: string; value: number; icon: string; color: string }[] = [
    { label: t(L('Фокус', 'Focus')), value: xp.focus, icon: 'timer', color: 'var(--c-brand)' },
    { label: t(S.tasks), value: xp.tasks, icon: 'checkCircle', color: 'var(--c-aurora)' },
    { label: t(S.cards), value: xp.cards, icon: 'cards', color: 'var(--c-deep)' },
    { label: t(S.goals), value: xp.goals, icon: 'target', color: 'var(--c-success)' },
    { label: t(S.streak), value: xp.streak, icon: 'flame', color: 'var(--c-ember)' },
  ].filter((s) => s.value > 0);

  return (
    <Screen
      title={t(S.achievements)}
      subtitle={t(
        L(
          `${earned.length} от ${list.length} отключени · ${xp.total} XP общо`,
          `${earned.length} of ${list.length} unlocked · ${xp.total} XP total`,
        ),
      )}
    >
      {/* ------------------------------------------------------------ level */}
      <Card className="mb-5 overflow-hidden" flush>
        <div className="relative flex flex-wrap items-center gap-6 p-5 sm:p-6">
          <ProgressRing value={level.progress} size={116} stroke={9} color="var(--c-brand)" colorTo="var(--c-aurora)">
            <div>
              <div className="t-num text-[30px] font-semibold leading-none tracking-[-0.03em]">{level.level}</div>
              <div className="mt-1 text-[11.5px] text-muted">
                {t(S.level)}
              </div>
            </div>
          </ProgressRing>

          <div className="min-w-[240px] flex-1">
            <h2 className="t-h2">{t(levelTitle(level.level))}</h2>
            <p className="mt-1 text-[13px] text-muted">
              {t(
                L(
                  `Още ${level.toNext} XP до ниво ${level.level + 1}`,
                  `${level.toNext} XP to level ${level.level + 1}`,
                ),
              )}
            </p>
            <ProgressBar value={level.progress} height={8} className="mt-3" color="var(--c-brand)" />
            <div className="t-num mt-1.5 flex justify-between text-[11px] text-faint">
              <span>{xpForLevel(level.level)} XP</span>
              <span>{xpForLevel(level.level + 1)} XP</span>
            </div>
          </div>

          {sources.length > 0 && (
            <div className="min-w-[220px] flex-1">
              <p className="t-label mb-2">{t(L('Откъде идва опитът', 'Where the XP came from'))}</p>
              <ul className="space-y-1.5">
                {sources.map((source) => (
                  <li key={source.label} className="flex items-center gap-2 text-[12.5px]">
                    <Icon name={source.icon} size={13} style={{ color: source.color }} />
                    <span className="flex-1 text-muted">{source.label}</span>
                    <span className="t-num font-medium">{Math.round(source.value)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 border-t border-line sm:grid-cols-4">
          {[
            {
              label: t(L('Учене общо', 'Total studied')),
              value: formatDuration(ctx.sessions.reduce((s, x) => s + x.minutes, 0), lang),
              icon: 'timer',
            },
            {
              label: t(L('Завършени задачи', 'Tasks completed')),
              value: String(ctx.items.filter((i) => i.done).length),
              icon: 'checkCircle',
            },
            {
              label: t(L('Повторения', 'Card reviews')),
              value: String(ctx.cards.reduce((s, c) => s + c.reps, 0)),
              icon: 'cards',
            },
            {
              label: t(L('Постигнати цели', 'Goals reached')),
              value: String(ctx.goals.filter((g) => g.completedAt).length),
              icon: 'target',
            },
          ].map((stat, i) => (
            <div key={stat.label} className={`p-4 ${i < 3 ? 'sm:border-r' : ''} border-line`}>
              <Icon name={stat.icon} size={15} className="text-faint" />
              <p className="t-num mt-2 text-[19px] font-semibold leading-none">{stat.value}</p>
              <p className="mt-1.5 text-[11.5px] text-muted">{stat.label}</p>
            </div>
          ))}
        </div>
      </Card>

      <Tabs
        value={tab}
        onChange={setTab}
        className="mb-4"
        items={[
          { id: 'all', label: t(S.all), count: list.length },
          { id: 'earned', label: t(L('Отключени', 'Unlocked')), icon: 'trophy', count: earned.length },
          { id: 'locked', label: t(L('Заключени', 'Locked')), icon: 'lock', count: locked.length },
        ]}
      />

      <div className="stagger grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {shown.map((a) => (
          <AchievementCard key={a.id} achievement={a} />
        ))}
      </div>
    </Screen>
  );
}

function AchievementCard({ achievement }: { achievement: AchievementState }) {
  const t = useT();
  const lang = useLang();
  const color = TIER_COLOR[achievement.tier];
  const earned = achievement.earned;

  return (
    <div
      className="card relative overflow-hidden p-4"
      style={earned ? { borderColor: `color-mix(in srgb, ${color} 35%, var(--c-line))` } : { opacity: 0.86 }}
    >
      <div className="relative flex items-start gap-3">
        <span
          className="grid h-12 w-12 shrink-0 place-items-center rounded-[12px]"
          style={{
            background: earned ? color : 'var(--c-surface-3)',
            color: earned ? '#fff' : 'var(--c-faint)',
          }}
        >
          <Icon name={earned ? achievement.icon : 'lock'} size={21} strokeWidth={1.9} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate text-[14px] font-semibold">{t(achievement.title)}</h3>
            <Badge color={color}>{t(TIER_LABEL[achievement.tier])}</Badge>
          </div>
          <p className="mt-1 text-[12px] leading-snug text-muted">{t(achievement.body)}</p>
        </div>
      </div>

      <div className="mt-3.5">
        {earned ? (
          <p className="flex items-center gap-1.5 text-[11.5px]" style={{ color }}>
            <Icon name="check" size={12} strokeWidth={2.8} />
            {achievement.earnedAt
              ? t(L(`Отключено на ${formatDate(achievement.earnedAt, lang, { day: 'numeric', month: 'long' })}`, `Unlocked ${formatDate(achievement.earnedAt, lang, { day: 'numeric', month: 'long' })}`))
              : t(L('Отключено', 'Unlocked'))}
          </p>
        ) : (
          <>
            <ProgressBar value={achievement.progress} height={5} color={color} />
            <p className="t-num mt-1.5 text-[11px] text-muted">
              {Math.round(achievement.value_)} / {achievement.target}
              {achievement.unit ? ` ${t(achievement.unit)}` : ''}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
