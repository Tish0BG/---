import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Icon } from '../Icon';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  stack: string;
  copied: boolean;
}

/**
 * The last line of defence.
 *
 * A React crash unmounts the whole tree and leaves a white page — which, in
 * an app that holds someone's entire notebook, reads as "my work is gone".
 * It is not: everything lives in IndexedDB and was written long before the
 * render failed. Saying so is most of what this screen is for; the other part
 * is a copyable report, because "it broke" is not a bug report.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, stack: '', copied: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Неочаквана грешка', error, info);
    this.setState({ stack: `${error.stack ?? error.message}\n\n${info.componentStack ?? ''}`.trim() });
  }

  private report(): string {
    return [
      `StudyDesk · ${new Date().toISOString()}`,
      navigator.userAgent,
      `екран: ${window.innerWidth}×${window.innerHeight}`,
      '',
      this.state.stack || String(this.state.error),
    ].join('\n');
  }

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="grid h-full place-items-center overflow-y-auto px-5 py-10" style={{ background: 'var(--c-bg)' }}>
        <div className="w-full max-w-[460px]">
          <span
            className="grid h-12 w-12 place-items-center rounded-2xl"
            style={{ background: 'color-mix(in srgb, var(--c-danger) 12%, transparent)', color: 'var(--c-danger)' }}
          >
            <Icon name="alert" size={22} />
          </span>

          <h1 className="mt-4 text-[22px] font-semibold tracking-[-0.02em]">Нещо се обърка</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">
            Приложението спря неочаквано. <b className="text-ink">Записките ти са непокътнати</b> — те се
            пазят в браузъра много преди екранът да се начертае, а не в него.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <button className="btn btn-primary h-10" onClick={() => window.location.reload()}>
              <Icon name="refresh" size={15} />
              Презареди
            </button>
            <button
              className="btn btn-outline h-10"
              onClick={() =>
                void navigator.clipboard.writeText(this.report()).then(() => this.setState({ copied: true }))
              }
            >
              <Icon name={this.state.copied ? 'check' : 'copy'} size={15} />
              {this.state.copied ? 'Копирано' : 'Копирай подробностите'}
            </button>
          </div>

          <details className="mt-4">
            <summary className="cursor-pointer text-[12px] text-muted">Технически подробности</summary>
            <pre
              className="scroll-thin mt-2 max-h-52 overflow-auto rounded-xl p-3 font-mono text-[11px] leading-relaxed"
              style={{ background: 'var(--c-surface-2)', color: 'var(--c-muted)' }}
            >
              {this.state.stack || String(error)}
            </pre>
          </details>

          <p className="mt-4 text-[11.5px] leading-relaxed text-faint">
            Ако се повтаря: направи резервно копие от Настройки → Резервно копие, преди да чистиш
            данните на браузъра.
          </p>
        </div>
      </div>
    );
  }
}
