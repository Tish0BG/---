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
    en: 'Plan your studies, work through them on the page, and watch the hours turn into progress — textbooks, boards, flashcards and focus in one place.',
    bg: 'Планираш ученето, решаваш направо върху страницата и гледаш как часовете стават резултат — учебници, дъски, флашкарти и фокус на едно място.',
  },

  /** Shorter, for metadata where length is punished. */
  meta: {
    en: 'Plan, study, focus and track — Plauvia keeps textbooks, whiteboards, flashcards and your study time in one place, and works offline.',
    bg: 'Планирай, учи, фокусирай се и следи напредъка — Plauvia държи учебниците, дъските, картите и учебното време на едно място и работи офлайн.',
  },
} as const;

export type Lang = 'en' | 'bg';

/** The visitor's language, guessed once from the browser. */
export function guessLang(): Lang {
  const stored = localStorage.getItem('plauvia.lang');
  if (stored === 'en' || stored === 'bg') return stored;
  return navigator.languages?.some((l) => l.toLowerCase().startsWith('bg')) ? 'bg' : 'en';
}

export function rememberLang(lang: Lang): void {
  try {
    localStorage.setItem('plauvia.lang', lang);
  } catch {
    /* private mode */
  }
}
