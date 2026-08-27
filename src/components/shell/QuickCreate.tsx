import { useApp } from '@/state/appStore';
import { useT, L } from '@/i18n';
import { Modal } from '../ui';
import { Sheet, useIsPhone } from '../kit';
import { TaskComposer } from './TaskComposer';

/**
 * ───────────────────────────────────────────────────── the create dialog ──
 *
 * One thing gets made here now, and the file is a tenth of what it was.
 *
 * It used to be a switch over three kinds — an entry, a goal and a timetable
 * slot — carrying a four-hundred-line form that served the last two while the
 * first had long since been taken over by `TaskComposer`. Goals are gone from
 * the product, the timetable is edited where it lives (a subject's page), and
 * what is left is the one thing anybody opens this for: write a line, press
 * Enter.
 */
export function QuickCreate() {
  const t = useT();
  const phone = useIsPhone();
  const kind = useApp((s) => s.quick);
  const startKind = useApp((s) => s.quickKind);
  const seed = useApp((s) => s.quickSeed);
  const close = () => useApp.getState().setQuick(null);

  if (!kind) return null;

  const title = t(L('Нов запис', 'New entry'));
  const body = <TaskComposer startKind={startKind || 'task'} seed={seed} onDone={close} />;

  return phone ? (
    <Sheet open onClose={close} title={title}>
      {body}
    </Sheet>
  ) : (
    /* `bare` on purpose: the composer is one line and its own controls. A
       title bar repeating "New entry" above a field that already says so is
       chrome for the sake of chrome. */
    <Modal open onClose={close} title={title} width={660} bare>
      {body}
    </Modal>
  );
}
