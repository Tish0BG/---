import { useMemo } from 'react';
import { create } from 'zustand';
import { guessLang, rememberLang, type Lang } from '@/brand';
import { entryPath, parsePath, routeByPath } from '@/seo/routes';

export type { Lang };

/**
 * Bilingual interface, without a key-management problem.
 *
 * Every visible string is written as `{ bg, en }` right where it is used, so a
 * translation can never go missing: adding a sentence and adding its
 * translation are the same edit. A key-based dictionary buys reuse we do not
 * need and pays for it with a file nobody keeps in sync.
 *
 * Words that genuinely repeat — the navigation, the verbs on buttons — live in
 * `strings.ts` and are imported by name.
 */
export interface Msg {
  bg: string;
  en: string;
}

/** Terse constructor: `L('Табло', 'Dashboard')`. */
export const L = (bg: string, en: string): Msg => ({ bg, en });

export type Translatable = Msg | string;

interface LangStore {
  lang: Lang;
  setLang(lang: Lang): void;
}

/**
 * The language the very first render is in.
 *
 * The address wins wherever the address says anything: `/en/faq` is the
 * English page and `/faq` is the Bulgarian one, for everybody. Reading it
 * here rather than correcting it in an effect is what stops the page being
 * painted once in the remembered language and then again in the right one —
 * a flash on the largest element of the page, in the wrong language, on every
 * visit by anyone whose preference disagrees with the link they followed.
 *
 * Only where there is no address to read — inside the app — does the
 * remembered preference decide.
 */
function initialLang(): Lang {
  const here = entryPath(window.location.pathname);
  if (!routeByPath(here)) return guessLang();
  const lang = parsePath(here).lang;
  rememberLang(lang);
  return lang;
}

export const useLangStore = create<LangStore>((set) => ({
  lang: initialLang(),
  setLang(lang) {
    rememberLang(lang);
    document.documentElement.lang = lang;
    set({ lang });
  },
}));

/** Non-reactive read, for stores and services outside React. */
export const currentLang = (): Lang => useLangStore.getState().lang;

export type TFn = (m: Translatable, vars?: Record<string, string | number>) => string;

export function translate(m: Translatable, lang: Lang, vars?: Record<string, string | number>): string {
  let out = typeof m === 'string' ? m : (m[lang] ?? m.bg);
  if (vars) {
    for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, String(v));
  }
  return out;
}

/** The hook every component uses: re-renders when the language changes. */
export function useT(): TFn {
  const lang = useLangStore((s) => s.lang);
  // Stable across renders: screens put `t` in `useMemo` dependency lists.
  return useMemo<TFn>(() => (m, vars) => translate(m, lang, vars), [lang]);
}

export function useLang(): Lang {
  return useLangStore((s) => s.lang);
}

/** Outside React (toasts fired from stores, notification bodies, …). */
export const tr: TFn = (m, vars) => translate(m, currentLang(), vars);

/* ------------------------------------------------------------- formatting */

export const localeOf = (lang: Lang): string => (lang === 'bg' ? 'bg-BG' : 'en-GB');

/**
 * One collator for every list of names in the product.
 *
 * `numeric` so that "Тест 2" comes before "Тест 10" rather than after it, and
 * `sensitivity: 'base'` so that case and accents do not split a shelf in two.
 * Six places used to call `localeCompare(x, 'bg')` with the locale hard-coded,
 * which sorted an English interface by Bulgarian rules.
 */
export const collatorOf = (lang: Lang): Intl.Collator =>
  new Intl.Collator(localeOf(lang), { numeric: true, sensitivity: 'base' });

export function useLocale(): string {
  return localeOf(useLang());
}

/**
 * Bulgarian and English both take "one / many", so a single split is enough;
 * the point of routing it through here is that no screen writes `n === 1 ?`
 * inline and then forgets the other language.
 */
export const plural = (n: number, one: Msg, many: Msg): Msg => (Math.abs(n) === 1 ? one : many);

export function formatDate(ts: number, lang: Lang, opts: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(localeOf(lang), opts).format(new Date(ts));
}

/** "Петък, 21 август" / "Friday, 21 August" — the dashboard's date line. */
export const longDate = (ts: number, lang: Lang): string =>
  formatDate(ts, lang, { weekday: 'long', day: 'numeric', month: 'long' });

export const shortDate = (ts: number, lang: Lang): string =>
  formatDate(ts, lang, { day: 'numeric', month: 'short' });

export const monthTitle = (ts: number, lang: Lang): string =>
  formatDate(ts, lang, { month: 'long', year: 'numeric' });

export const clockTime = (ts: number, lang: Lang): string =>
  formatDate(ts, lang, { hour: '2-digit', minute: '2-digit' });

/** Locale-aware weekday names, Monday first — every calendar grid uses these. */
export function weekdayNames(lang: Lang, width: 'short' | 'long' = 'short'): string[] {
  const fmt = new Intl.DateTimeFormat(localeOf(lang), { weekday: width });
  // 2024-01-01 was a Monday.
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(2024, 0, 1 + i);
    const s = fmt.format(d);
    return s.charAt(0).toUpperCase() + s.slice(1).replace(/\.$/, '');
  });
}

/** "2 ч 15 мин" / "2h 15m" — one shape for every duration in the product. */
export function formatDuration(minutes: number, lang: Lang): string {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (lang === 'bg') {
    if (!h) return `${rest} мин`;
    return rest ? `${h} ч ${rest} мин` : `${h} ч`;
  }
  if (!h) return `${rest}m`;
  return rest ? `${h}h ${rest}m` : `${h}h`;
}

export function formatNumber(n: number, lang: Lang): string {
  return new Intl.NumberFormat(localeOf(lang)).format(n);
}

/** "днес / утре / след 3 дни / преди 2 дни" with the same shape in English. */
export function relativeDays(days: number, lang: Lang): string {
  if (days === 0) return lang === 'bg' ? 'днес' : 'today';
  if (days === 1) return lang === 'bg' ? 'утре' : 'tomorrow';
  if (days === -1) return lang === 'bg' ? 'вчера' : 'yesterday';
  if (days > 1) return lang === 'bg' ? `след ${days} дни` : `in ${days} days`;
  const ago = Math.abs(days);
  return lang === 'bg' ? `преди ${ago} дни` : `${ago} days ago`;
}
