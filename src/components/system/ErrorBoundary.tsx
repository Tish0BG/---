import { Component, type ErrorInfo, type ReactNode } from 'react';
import { currentLang } from '@/i18n';
import { Icon } from '../Icon';

/**
 * The boundary cannot use the `useT` hook — it is a class, and it has to work
 * even when the tree that provides everything else has just fallen over. So it
 * reads the language directly and picks from a pair.
 */
const say = (bg: string, en: string): string => (currentLang() === 'bg' ? bg : en);

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * The last line of defence.
 *
 * A React crash unmounts the whole tree and leaves a white page — which, in
 * an app that holds someone's entire notebook, reads as "my work is gone".
 * It is not: everything lives in IndexedDB and was written long before the
 * render failed. Saying so is the whole job of this screen.
 *
 * It used to do more, and the more was a mistake. There was a "copy the
 * details" button that put the stack trace, the component tree and the user
 * agent on the clipboard, and a panel that printed the same thing on the
 * page. That is a debugging tool wearing the clothes of a support feature: it
 * hands a stranger the internal shape of the application — file paths, module
 * names, the route that failed — which is exactly the reconnaissance an
 * attacker would otherwise have to work for. A person who has just lost their
 * screen needs one sentence and one button, not an incident report they
 * cannot read and should not be holding.
 *
 * The error still goes to `console.error`, where a developer with the
 * device in front of them can read it and nobody else is shown anything.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Plauvia · unexpected error', error, info);
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children;

    return (
      <div className="grid h-full place-items-center overflow-y-auto px-5 py-10" style={{ background: 'var(--c-bg)' }}>
        <div className="w-full max-w-[420px] text-center">
          <span
            className="mx-auto grid h-11 w-11 place-items-center rounded-[12px]"
            style={{ background: 'var(--c-surface-3)', color: 'var(--c-muted)' }}
          >
            <Icon name="refresh" size={20} />
          </span>

          <h1 className="t-h2 mt-4">{say('Екранът не се зареди', 'This screen did not load')}</h1>
          <p className="mt-2.5 text-[13.5px] leading-relaxed text-muted">
            <b className="font-medium text-ink">
              {say('Записките ти са непокътнати.', 'Your notes are untouched.')}
            </b>{' '}
            {say(
              'Всичко се пази в браузъра много преди екранът да се начертае, а не в него. Презареждането обикновено е достатъчно.',
              'Everything is kept in the browser long before the screen is drawn, not in it. Reloading is usually enough.',
            )}
          </p>

          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <button className="btn btn-primary btn-lg" onClick={() => window.location.reload()}>
              {say('Презареди', 'Reload')}
            </button>
            <a className="btn btn-outline btn-lg" href="/">
              {say('Към началото', 'Go to the home page')}
            </a>
          </div>

          <p className="mt-6 text-[12px] leading-relaxed text-faint">
            {say(
              'Ако се повтаря, направи резервно копие от Настройки → Данни и офлайн, преди да чистиш данните на браузъра.',
              'If it keeps happening, take a backup from Settings → Data & offline before clearing your browser data.',
            )}
          </p>
        </div>
      </div>
    );
  }
}
