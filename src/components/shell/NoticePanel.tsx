import { useMemo } from 'react';
import { navigateTo } from '@/state/appStore';
import { usePlanner } from '@/state/plannerStore';
import { useGoals } from '@/state/goalStore';
import { useCards } from '@/state/cardStore';
import { useWorkspace } from '@/state/workspaceStore';
import { useGame, useGameContext } from '@/state/gameStore';
import { useNotices } from '@/state/notificationStore';
import { buildNotices, type Notice } from '@/services/notificationService';
import { useT, L, useLang, clockTime, relativeDays } from '@/i18n';
import { S } from '@/i18n/strings';
import { Icon } from '../Icon';
import { Popover } from '../ui';
import { EmptyState } from '../kit';

/** Everything the feed needs, gathered once. */
export function useNoticeFeed(): Notice[] {
  const items = usePlanner((s) => s.items);
  const goals = useGoals((s) => s.goals);
  const cards = useCards((s) => s.cards);
  const subjects = useWorkspace((s) => s.subjects);
  const unlocked = useGame((s) => s.unlocked);
  const ctx = useGameContext();

  return useMemo(
    () => buildNotices({ items, goals, cards, subjects, ctx, unlocked }),
    [items, goals, cards, subjects, ctx, unlocked],
  );
}

const TONE_COLOR: Record<Notice['tone'], string> = {
  brand: 'var(--c-brand)',
  warn: 'var(--c-warn)',
  danger: 'var(--c-danger)',
  success: 'var(--c-success)',
  ember: 'var(--c-ember)',
};

/**
 * The bell.
 *
 * Nothing here is pushed or scheduled — the feed is a live query over the same
 * records the screens show, so it can never announce a deadline for a task
 * that was deleted, and it goes quiet on its own when the work is done.
 */
export function NoticeBell() {
  const t = useT();
  const lang = useLang();
  const feed = useNoticeFeed();
  const read = useNotices((s) => s.read);
  const markRead = useNotices((s) => s.markRead);

  const unread = feed.filter((n) => !read[n.id]);

  return (
    <Popover
      width={352}
      align="end"
      trigger={({ toggle, ref }) => (
        <button
          ref={ref}
          onClick={() => {
            toggle();
            // Opening is reading: the point of the badge is "something new",
            // not "you have not clicked each of these".
            setTimeout(() => markRead(feed.map((n) => n.id)), 900);
          }}
          className="icon-btn relative"
          aria-label={`${t(S.notifications)}${unread.length ? ` (${unread.length})` : ''}`}
        >
          <Icon name={unread.length ? 'bellRing' : 'bell'} size={17} />
          {unread.length > 0 && (
            <span
              className="t-num absolute -right-0.5 -top-0.5 grid h-[15px] min-w-[15px] place-items-center rounded-full px-[3px] text-[9.5px] font-bold text-white"
              style={{ background: 'var(--c-danger)', border: '1.5px solid var(--c-surface)' }}
            >
              {unread.length > 9 ? '9+' : unread.length}
            </span>
          )}
        </button>
      )}
    >
      {(close) => (
        <div className="max-h-[70vh] overflow-y-auto scroll-thin">
          <div className="flex items-center justify-between px-2 pb-1.5 pt-1">
            <span className="t-label">{t(S.notifications)}</span>
            {feed.length > 0 && (
              <span className="text-[11px] text-faint">
                {t(L(`${feed.length} общо`, `${feed.length} total`))}
              </span>
            )}
          </div>

          {feed.length === 0 ? (
            <EmptyState
              compact
              icon="checkCircle"
              tone="var(--c-success)"
              title={t(L('Чисто е', 'All clear'))}
              body={t(L('Няма просрочени задачи и нищо спешно не наближава.', 'Nothing overdue and nothing urgent coming up.'))}
            />
          ) : (
            <ul className="space-y-0.5">
              {feed.map((n) => (
                <li key={n.id}>
                  <button
                    className="flex w-full cursor-pointer items-start gap-2.5 rounded-[10px] p-2 text-left transition-colors hover:bg-surface-2"
                    onClick={() => {
                      if (n.target) navigateTo(n.target.view, n.target.id);
                      close();
                    }}
                  >
                    <span
                      className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-[8px]"
                      style={{
                        background: `color-mix(in srgb, ${TONE_COLOR[n.tone]} 14%, transparent)`,
                        color: TONE_COLOR[n.tone],
                      }}
                    >
                      <Icon name={n.icon} size={14.5} strokeWidth={2} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-2">
                        <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{t(n.title)}</span>
                        {!read[n.id] && (
                          <span className="badge-dot mt-1.5" style={{ background: 'var(--c-accent)' }} />
                        )}
                      </span>
                      <span className="mt-0.5 block truncate text-[12px] text-muted">{t(n.body)}</span>
                      <span className="mt-1 block text-[10.5px] text-faint">
                        {whenLabel(n.at, lang)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Popover>
  );
}

function whenLabel(at: number, lang: 'bg' | 'en'): string {
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const days = Math.round((new Date(at).setHours(0, 0, 0, 0) - midnight.getTime()) / 86_400_000);
  if (days === 0) return clockTime(at, lang);
  return relativeDays(days, lang);
}
