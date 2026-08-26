/**
 * One place for everything the brand asserts about itself.
 *
 * Names, taglines and the domain end up in a dozen files — metadata, the
 * manifest, the sidebar, the error report, the SQL comments. Spreading them
 * out is how a product ends up half-renamed, so they live here and nowhere
 * else.
 */

export const BRAND = {
  name: 'Plauvia',
  domain: 'plauvia.com',
  url: 'https://www.plauvia.com',

  /**
   * One tagline, in two languages — not two competing slogans.
   *
   * It names the arc the product is built around (plan → study → focus →
   * track → improve) in four words, without claiming to be "ultimate"
   * anything.
   */
  tagline: {
    en: 'From plan to progress.',
    bg: 'От план към резултат.',
  },

  /** The sentence under the tagline: what it actually does. */
  description: {
    en: 'Plan the day and the long haul on one screen, work through it, and watch the hours turn into progress — tasks, reminders, goals, documents and focus in one place.',
    bg: 'Планираш деня и дългия път на един екран, вършиш ги и гледаш как часовете стават резултат — задачи, напомняния, цели, документи и фокус на едно място.',
  },

  /** Shorter, for metadata where length is punished. */
  meta: {
    en: 'Plan, do, focus and track — Plauvia holds your day, your goals, your reminders, your documents and your flashcards in one place, and works offline.',
    bg: 'Планирай, върши, фокусирай се и следи напредъка — Plauvia държи деня, целите, напомнянията, документите и картите на едно място и работи офлайн.',
  },
} as const;

export type Lang = 'en' | 'bg';

/**
 * What the browser itself asks for, ignoring anything remembered.
 *
 * Used for one thing only: offering the other language as a link. It never
 * redirects and never changes what an address serves — `/` is Bulgarian for
 * everybody, `/en` is English for everybody, and a page that rearranges
 * itself according to a header is a page a search engine cannot index twice.
 */
export function browserLang(): Lang {
  return navigator.languages?.some((l) => l.toLowerCase().startsWith('bg')) ? 'bg' : 'en';
}

/**
 * The language the *app* opens in — the part of the product that has no
 * public addresses and so nothing to read a language off.
 *
 * Public pages do not use this: there the address decides, and following one
 * writes the choice back here, so the app opens in whatever the site was last
 * being read in.
 */
export function guessLang(): Lang {
  const stored = localStorage.getItem('plauvia.lang');
  if (stored === 'en' || stored === 'bg') return stored;
  return browserLang();
}

export function rememberLang(lang: Lang): void {
  try {
    localStorage.setItem('plauvia.lang', lang);
  } catch {
    /* private mode */
  }
}
