import { daysUntil } from '@/state/plannerStore';
import { useT, useLang, L, shortDate, type Msg } from '@/i18n';

/**
 * A deadline read the way a person reads it: "днес", "утре", "след 3 дни",
 * "закъсня с 2 дни" — and coloured by how much trouble you are in.
 */
export function DueChip({
  due,
  bare = false,
  compact = false,
}: {
  due: number;
  bare?: boolean;
  /** the short forms, for rows that have no width to spare */
  compact?: boolean;
}) {
  const t = useT();
  const lang = useLang();
  const days = daysUntil(due);
  const label = compact ? shortDue(days, due, lang, t) : describeDue(days, due, lang, t);
  const color =
    days < 0 ? 'var(--c-danger)' : days === 0 ? 'var(--c-warn)' : days <= 2 ? 'var(--c-accent)' : 'var(--c-muted)';

  if (bare) {
    return (
      <span style={{ color }} className="t-num">
        {label}
      </span>
    );
  }
  return (
    <span
      className="chip t-num shrink-0"
      style={{ background: `color-mix(in srgb, ${color} 14%, transparent)`, color }}
    >
      {label}
    </span>
  );
}

export function describeDue(
  days: number,
  due: number,
  lang: 'bg' | 'en',
  t: (m: Msg) => string,
): string {
  if (days === 0) return t(L('днес', 'today'));
  if (days === 1) return t(L('утре', 'tomorrow'));
  if (days === -1) return t(L('вчера', 'yesterday'));
  if (days < 0) return t(L(`закъсня с ${-days} дни`, `${-days} days late`));
  if (days <= 7) return t(L(`след ${days} дни`, `in ${days} days`));
  return shortDate(due, lang);
}

/**
 * The same deadline in as few characters as possible.
 *
 * "закъсня с 2 дни" is the right sentence on a laptop and half a task title
 * on a phone. The count survives the shortening — it is the part that decides
 * anything.
 */
export function shortDue(days: number, due: number, lang: 'bg' | 'en', t: (m: Msg) => string): string {
  if (days === 0) return t(L('днес', 'today'));
  if (days === 1) return t(L('утре', 'tom.'));
  if (days === -1) return t(L('вчера', 'yest.'));
  if (days < 0) return t(L(`−${-days} дни`, `${-days}d late`));
  if (days <= 7) return t(L(`+${days} дни`, `in ${days}d`));
  return shortDate(due, lang);
}
