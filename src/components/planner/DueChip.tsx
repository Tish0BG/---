import { daysUntil } from '@/state/plannerStore';

/**
 * A deadline read the way a person reads it: "днес", "утре", "след 3 дни",
 * "закъсня с 2 дни" — and coloured by how much trouble you are in.
 */
export function DueChip({ due, bare = false }: { due: number; bare?: boolean }) {
  const days = daysUntil(due);
  const label = describeDue(days, due);
  const color =
    days < 0 ? 'var(--c-danger)' : days === 0 ? 'var(--c-warn)' : days <= 2 ? 'var(--c-accent)' : 'var(--c-muted)';

  if (bare) {
    return (
      <span style={{ color }} className="tabular-nums">
        {label}
      </span>
    );
  }
  return (
    <span
      className="chip shrink-0 tabular-nums"
      style={{ background: `color-mix(in srgb, ${color} 14%, transparent)`, color }}
    >
      {label}
    </span>
  );
}

export function describeDue(days: number, due: number): string {
  if (days === 0) return 'днес';
  if (days === 1) return 'утре';
  if (days === -1) return 'вчера';
  if (days < 0) return `закъсня с ${-days} дни`;
  if (days <= 7) return `след ${days} дни`;
  return new Date(due).toLocaleDateString('bg-BG', { day: 'numeric', month: 'short' });
}
