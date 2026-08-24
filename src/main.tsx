import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { Analytics } from './components/system/Analytics';
import { ErrorBoundary } from './components/system/ErrorBoundary';
import './styles/index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
      {/* Reads the address itself and draws nothing anywhere else, so it sits
          beside the app rather than inside one of its branches. */}
      <Analytics />
    </ErrorBoundary>
  </StrictMode>,
);

/** The app drew something: the recovery guard in `recover.js` can stand down. */
window.dispatchEvent(new Event('plauvia:ready'));

/**
 * The offline shell.
 *
 * Production only, and never on localhost. `npm run preview` serves a
 * production build from a port that is reused by the next thing you preview,
 * and a worker installed by one build then answers navigations for the next
 * one out of its cache — an `index.html` naming bundles that no longer exist,
 * which is a white screen with nothing in the console. Offline support is
 * worth a great deal on plauvia.com and nothing at all on localhost, so it is
 * only registered where it is worth something.
 */
const localhost = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname);

if (import.meta.env.PROD && !localhost && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => {
      /* unsupported or blocked — the app works online regardless */
    });
  });
} else if ('serviceWorker' in navigator) {
  // Clear out any worker a previous preview left behind on this port.
  void navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => void r.unregister()));
}
