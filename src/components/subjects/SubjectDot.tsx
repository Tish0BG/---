import type { Subject } from '@/types';

/** Small colour tag; the one visual that ties a subject together everywhere. */
export function SubjectDot({ subject, showName = true }: { subject: Subject; showName?: boolean }) {
  return (
    <span className="flex min-w-0 items-center gap-1" title={subject.name}>
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: subject.color }} />
      {showName && <span className="truncate">{subject.name}</span>}
    </span>
  );
}
