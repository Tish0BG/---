import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '@/state/appStore';
import { useGame } from '@/state/gameStore';
import { TIER_COLOR, levelTitle } from '@/services/gameService';
import { useT, L } from '@/i18n';
import { Icon } from '../Icon';
import { Button } from '../kit';

/**
 * The one moment the app is allowed to interrupt.
 *
 * It fires only when something was actually earned — a badge whose condition
 * just became true, or a level that just went up — shows for a few seconds and
 * gets out of the way. Anything more often than that is a slot machine, not a
 * study app.
 */
export function Celebration() {
  const t = useT();
  const queue = useGame((s) => s.queue);
  const dismiss = useGame((s) => s.dismiss);
  const current = queue[0];

  useEffect(() => {
    if (!current) return;
    const id = setTimeout(dismiss, 6000);
    return () => clearTimeout(id);
  }, [current, dismiss]);

  if (!current) return null;

  const isLevel = current.kind === 'level';
  const color = isLevel ? 'var(--c-brand)' : TIER_COLOR[current.achievement.tier];

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[95] flex justify-center px-4">
      <div
        className="animate-pop pointer-events-auto flex w-full max-w-[380px] items-center gap-3 rounded-[12px] p-3.5"
        style={{
          background: 'var(--c-surface)',
          border: '1px solid var(--c-line)',
          boxShadow: 'var(--shadow-float)',
        }}
        role="status"
      >
        <span
          className="relative grid h-12 w-12 shrink-0 place-items-center rounded-[12px] text-white"
          style={{ background: `linear-gradient(140deg, ${color}, color-mix(in srgb, ${color} 62%, #000))` }}
        >
          <Icon name={isLevel ? 'rocket' : current.achievement.icon} size={22} strokeWidth={2} />
          <span
            className="animate-breathe absolute -inset-1 -z-10 rounded-[16px]"
            style={{ background: `color-mix(in srgb, ${color} 32%, transparent)` }}
            aria-hidden
          />
        </span>

        <div className="min-w-0 flex-1">
          <p className="t-label" style={{ color }}>
            {isLevel ? t(L('Ново ниво', 'Level up')) : t(L('Ново постижение', 'Achievement unlocked'))}
          </p>
          <p className="mt-0.5 truncate text-[14px] font-semibold">
            {isLevel
              ? `${t(L('Ниво', 'Level'))} ${current.level} · ${t(levelTitle(current.level))}`
              : t(current.achievement.title)}
          </p>
          <p className="mt-0.5 truncate text-[12px] text-muted">
            {isLevel
              ? t(L('Часовете ти се трупат.', 'Your hours are adding up.'))
              : t(current.achievement.body)}
          </p>
        </div>

        <div className="flex shrink-0 flex-col gap-1">
          <Button
            size="sm"
            variant="soft"
            onClick={() => {
              useApp.getState().go('achievements');
              dismiss();
            }}
          >
            {t(L('Виж', 'View'))}
          </Button>
          <button
            className="icon-btn h-6 w-full"
            onClick={dismiss}
            aria-label={t(L('Затвори', 'Dismiss'))}
          >
            <Icon name="x" size={13} />
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
