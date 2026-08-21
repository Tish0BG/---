import { lazy, Suspense } from 'react';
import type { UtilityId } from '@/types';
import { Icon } from '../Icon';

const Calculator = lazy(() => import('./Calculator').then((m) => ({ default: m.Calculator })));
const PeriodicTable = lazy(() => import('./PeriodicTable').then((m) => ({ default: m.PeriodicTable })));
const Converter = lazy(() => import('./Converter').then((m) => ({ default: m.Converter })));
const Grapher = lazy(() => import('./Grapher').then((m) => ({ default: m.Grapher })));
const Formulas = lazy(() => import('./Formulas').then((m) => ({ default: m.Formulas })));
const TriangleSolver = lazy(() => import('./TriangleSolver').then((m) => ({ default: m.TriangleSolver })));
const Notes = lazy(() => import('./Notes').then((m) => ({ default: m.Notes })));

/**
 * Each tool is its own chunk: the periodic table alone is a few tens of
 * kilobytes of element data, and a student who only ever opens the calculator
 * should never pay for it.
 */
export function UtilityBody({ id, wid }: { id: UtilityId; wid: string }) {
  return (
    <Suspense fallback={<Loading />}>
      {id === 'calculator' && <Calculator wid={wid} />}
      {id === 'periodic' && <PeriodicTable wid={wid} />}
      {id === 'converter' && <Converter wid={wid} />}
      {id === 'graph' && <Grapher wid={wid} />}
      {id === 'formulas' && <Formulas wid={wid} />}
      {id === 'triangle' && <TriangleSolver wid={wid} />}
      {id === 'notes' && <Notes />}
      {id === 'ptable' && <PtableFrame />}
    </Suspense>
  );
}

function Loading() {
  return (
    <div className="grid h-full place-items-center" style={{ background: 'var(--c-surface)' }}>
      <Icon name="refresh" size={18} className="animate-spin text-faint" />
    </div>
  );
}

/**
 * ptable.com embedded as-is. It is the reference every chemistry teacher
 * points at, and it allows framing — but it needs the network, so the built-in
 * table stays the offline answer.
 */
function PtableFrame() {
  const src = 'https://ptable.com/?lang=bg#%D0%A1%D0%B2%D0%BE%D0%B9%D1%81%D1%82%D0%B2%D0%B0';
  return (
    <div className="flex h-full flex-col" style={{ background: 'var(--c-surface)' }}>
      <div className="flex shrink-0 items-center gap-1.5 border-b border-line px-2 py-1 text-[10.5px] text-faint">
        <Icon name="cloud" size={12} />
        <span className="flex-1 truncate">ptable.com — иска интернет</span>
        <a
          href={src}
          target="_blank"
          rel="noreferrer"
          className="cursor-pointer underline underline-offset-2 hover:text-ink"
        >
          отвори в раздел
        </a>
      </div>
      <iframe
        src={src}
        title="Периодична таблица — ptable.com"
        className="min-h-0 flex-1 border-0 bg-white"
        loading="lazy"
        referrerPolicy="no-referrer"
        sandbox="allow-scripts allow-same-origin allow-popups"
      />
    </div>
  );
}
