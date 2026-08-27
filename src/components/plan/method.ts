import type { TaskMethod } from '@/types';
import { L, type Msg } from '@/i18n';

/**
 * The four ways an entry can be worked, named and drawn.
 *
 * They lived in `components/tasks/TaskRow.tsx`, which meant the plan's own
 * editor imported two constant maps from a row component in another folder —
 * the dependency pointing the wrong way round. They belong to the method, not
 * to any one thing that renders it.
 */
export const METHOD_LABEL: Record<TaskMethod, Msg> = {
  check: L('Отметка', 'Tick'),
  checklist: L('Списък', 'Checklist'),
  count: L('Брояч', 'Counter'),
  timer: L('Таймер', 'Timer'),
};

export const METHOD_ICON: Record<TaskMethod, string> = {
  check: 'checkCircle',
  checklist: 'listTodo',
  count: 'sigma',
  timer: 'timer',
};

/** What a counted or timed entry starts out aiming at when it has no target yet. */
export const defaultTarget = (method: TaskMethod, current = 0): number =>
  current || (method === 'count' ? 3 : method === 'timer' ? 1 : 0);
