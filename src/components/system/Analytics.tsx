import { Analytics as VercelAnalytics } from '@vercel/analytics/react';
import { routeByPath } from '@/seo/routes';
import { useRoute } from '@/state/routeStore';

/**
 * How many people read the public site — and nothing else.
 *
 * Plauvia tells its readers, in the privacy policy and on the About page, that
 * nothing they do inside the application is measured. That has to keep being
 * true, so the counting stops at the door: it runs on `/homepage`, `/about`,
 * `/faq` and the rest of the public pages, and never inside `/dashboard`,
 * `/tasks`, a document or the settings.
 *
 * Two independent guards, because one of them is a promise about a script's
 * behaviour and the other is a fact about whether it is on the page at all:
 *
 *   · The component is only rendered while the address is a public page, so
 *     somebody who opens the app directly never loads it.
 *   · `beforeSend` drops any event whose address is not a public page, so a
 *     script already loaded on the marketing page cannot report an app screen
 *     after the visitor signs in.
 *
 * The second guard is the one that matters. Vercel's script patches
 * `history.pushState` to follow single-page navigation, which is exactly what
 * Plauvia does when it moves from the site into the app — without it, walking
 * from `/homepage` to `/dashboard` would be reported as a page view.
 *
 * Nothing here runs in development: outside production the package loads its
 * debug script from `va.vercel-scripts.com`, which the Content-Security-Policy
 * does not allow and should not be changed to allow. In production the script
 * and its beacon are both same-origin under `/_vercel/insights/`.
 */
export function Analytics() {
  const path = useRoute((s) => s.path);

  if (!import.meta.env.PROD || !routeByPath(path)) return null;

  return (
    <VercelAnalytics
      beforeSend={(event) => {
        try {
          return routeByPath(new URL(event.url).pathname) ? event : null;
        } catch {
          // An address this cannot parse is not one worth counting.
          return null;
        }
      }}
    />
  );
}
