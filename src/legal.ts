/**
 * The facts a legal page cannot invent.
 *
 * Who operates Plauvia, where to write, and from when the current terms apply.
 * They live here rather than inside the prose so there is exactly one place to
 * correct — and so it is obvious, at a glance, which of them are still
 * placeholders. Anything still reading `TODO` must be filled in before the
 * pages are shown to the public; the Contact page says so out loud rather than
 * quietly presenting a fake address as real.
 */
export const LEGAL = {
  /** The natural or legal person who decides what happens to the data. */
  operator: 'TODO: registered name of the operator',
  /** Postal address, as required of a data controller. */
  address: 'TODO: postal address',
  /** General enquiries and support. */
  contactEmail: 'TODO: hello@plauvia.com',
  /** Privacy requests: access, export, deletion, objection. */
  privacyEmail: 'TODO: privacy@plauvia.com',
  /** Responsible disclosure of security issues. */
  securityEmail: 'TODO: security@plauvia.com',
  /** The date the current version of the terms and the policy took effect. */
  effective: '2026-08-22',
  /** Where the sync database and file storage physically live. */
  hostingRegion: 'TODO: Supabase project region, e.g. EU (Frankfurt)',
} as const;

/** True while any of the above is still a placeholder. */
export const legalIncomplete = (): boolean =>
  Object.values(LEGAL).some((v) => typeof v === 'string' && v.startsWith('TODO'));

/** Shows the value, or a visible marker — never a plausible-looking invention. */
export const legalValue = (v: string): string => (v.startsWith('TODO') ? `— ${v} —` : v);
