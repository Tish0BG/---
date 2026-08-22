/**
 * The facts a legal page cannot invent.
 *
 * Who operates Plauvia, where to write, and from when the current terms apply.
 * They live here rather than inside the prose so there is exactly one place to
 * correct, and so the pages can adapt to what is genuinely known: a value left
 * empty is a clause that disappears, never a placeholder shown to a reader as
 * though it were real.
 */
export const LEGAL = {
  /** The natural or legal person who decides what happens to the data. */
  operator: 'Tihomir Georgiev',
  /**
   * Postal address. Deliberately empty for now — the pages omit the clause
   * rather than printing a blank. Worth revisiting: EU e-commerce rules expect
   * a geographic address from anyone offering a service to the public, and it
   * stops being optional the moment money is involved.
   */
  address: '',
  /** General enquiries and support. */
  contactEmail: 'tihomir.georgiev.business@gmail.com',
  /** Privacy requests: access, export, deletion, objection. */
  privacyEmail: 'tihomir.georgiev.business@gmail.com',
  /** Responsible disclosure of security issues. */
  securityEmail: 'tihomir.georgiev.business@gmail.com',
  /** The date the current version of the terms and the policy took effect. */
  effective: '2026-08-22',
  /** Where the sync database and file storage physically live. */
  hostingRegion: 'EU · Frankfurt',
} as const;

/**
 * The values a legal page cannot do without. The postal address is not among
 * them: leaving it out is a decision the pages handle, not an omission they
 * have to warn about.
 */
const REQUIRED = ['operator', 'contactEmail', 'privacyEmail', 'securityEmail', 'hostingRegion'] as const;

export const legalIncomplete = (): boolean =>
  REQUIRED.some((key) => {
    const value = LEGAL[key];
    return !value || value.startsWith('TODO');
  });

/** Shows the value, or a visible marker — never a plausible-looking invention. */
export const legalValue = (v: string): string => (v.startsWith('TODO') ? `— ${v} —` : v);

/**
 * ", <address>" when there is one, and nothing at all when there is not, so a
 * sentence naming the controller reads correctly either way.
 */
export const addressClause = (): string => (LEGAL.address ? `, ${LEGAL.address}` : '');

/** True when one address answers everything, which is the usual case for one person. */
export const oneInbox = (): boolean =>
  LEGAL.contactEmail === LEGAL.privacyEmail && LEGAL.privacyEmail === LEGAL.securityEmail;
