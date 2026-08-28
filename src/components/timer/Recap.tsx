import { useT, useLang, L, formatDuration } from '@/i18n';
import { useSettings } from '@/state/settingsStore';
import { dayKey, statsForDay, useTimer } from '@/state/timerStore';
import { currentStreak } from '@/services/gameService';
import { usePlanner } from '@/state/plannerStore';
import { useItemTypes, typeOf } from '@/state/itemTypeStore';
import { Icon } from '../Icon';

/**
 * ──────────────────────────────────────────── what a finished block gives ──
 *
 * The end of a block was told twice and told differently: full screen showed
 * the experience — XP, the day, the streak, and a break waiting to be taken —
 * while the focus screen showed a green line saying the minutes were saved.
 * Same event, two answers, and the smaller one arrived exactly where a person
 * is most likely to be sitting.
 *
 * This is the shared half. Both places use it, so a block is worth the same
 * thing wherever you happened to be watching.
 */
export function RecapStats({ minutes, compact }: { minutes: number; compact?: boolean }) {
  const t = useT();
  const lang = useLang();
  const sessions = useTimer((s) => s.sessions);
  const goal = useSettings((s) => s.timer.goal);
  const today = statsForDay(sessions, dayKey());
  const run = currentStreak(sessions);

  const cells = [
    { icon: 'bolt', value: `+${minutes}`, label: 'XP', tone: 'var(--c-brand)' },
    {
      icon: 'timer',
      value: formatDuration(today.minutes, lang),
      label: t(L(`от ${goal} мин`, `of ${goal} min`)),
      tone: 'var(--c-aurora)',
    },
    {
      icon: 'flame',
      value: String(run),
      label: t(run === 1 ? L('ден поред', 'day streak') : L('дни поред', 'day streak')),
      tone: 'var(--c-ember)',
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-2">
      {cells.map((cell) => (
        <div key={cell.label} className={`card-quiet ${compact ? 'p-2' : 'p-3'}`}>
          <Icon name={cell.icon} size={compact ? 13 : 15} style={{ color: cell.tone }} className="mx-auto" />
          <div className={`t-num mt-1.5 font-semibold leading-none ${compact ? 'text-[15px]' : 'text-[17px]'}`}>
            {cell.value}
          </div>
          <div className="mt-1 text-[11px] text-muted">{cell.label}</div>
        </div>
      ))}
    </div>
  );
}

/**
 * The entries the block was spent on, each with a box to tick.
 *
 * The end of a session is the one moment a person knows whether the thing
 * they were working on is actually finished, so the question is asked here
 * rather than left for another screen to remember.
 */
export function RecapTasks({ taskIds }: { taskIds: string[] }) {
  const items = usePlanner((s) => s.items);
  const custom = useItemTypes((s) => s.custom);
  const worked = taskIds.map((id) => items.find((i) => i.id === id)).filter((x) => !!x);

  if (!worked.length) return null;

  return (
    <div className="flex flex-wrap justify-center gap-1.5">
      {worked.map((item) => {
        const type = typeOf(item.kind, custom);
        return (
          <button
            key={item.id}
            onClick={() => void usePlanner.getState().toggleItem(item.id)}
            className="flex max-w-full cursor-pointer items-center gap-2 rounded-full border px-2.5 py-1 text-[12.5px] transition-colors"
            style={{
              borderColor: item.done ? 'transparent' : 'var(--c-line)',
              background: item.done ? 'color-mix(in srgb, var(--c-success) 15%, transparent)' : 'var(--c-surface)',
              color: item.done ? 'var(--c-success)' : 'var(--c-muted)',
            }}
            aria-pressed={item.done}
          >
            <span
              className="grid h-[15px] w-[15px] shrink-0 place-items-center rounded-[4px] border"
              style={{
                borderColor: item.done ? 'var(--c-success)' : 'var(--c-line-strong)',
                background: item.done ? 'var(--c-success)' : 'transparent',
              }}
            >
              {item.done && <Icon name="check" size={10} className="text-white" strokeWidth={3.4} />}
            </span>
            <Icon name={type.icon} size={12} className="shrink-0 opacity-70" />
            <span className={`truncate ${item.done ? 'line-through' : ''}`}>{item.title}</span>
          </button>
        );
      })}
    </div>
  );
}
