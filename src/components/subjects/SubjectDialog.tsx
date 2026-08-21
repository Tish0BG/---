import { useEffect, useState } from 'react';
import type { Subject } from '@/types';
import { SUBJECT_COLORS, SUBJECT_ICONS, useWorkspace } from '@/state/workspaceStore';
import { Modal } from '../ui';
import { Icon } from '../Icon';

export function SubjectDialog({
  open,
  subject,
  onClose,
}: {
  open: boolean;
  subject: Subject | null;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [teacher, setTeacher] = useState('');
  const [color, setColor] = useState(SUBJECT_COLORS[0]);
  const [icon, setIcon] = useState('book');

  useEffect(() => {
    if (!open) return;
    setName(subject?.name ?? '');
    setTeacher(subject?.teacher ?? '');
    setColor(subject?.color ?? SUBJECT_COLORS[useWorkspace.getState().subjects.length % SUBJECT_COLORS.length]);
    setIcon(subject?.icon ?? 'book');
  }, [open, subject]);

  const save = async () => {
    const patch = { name: name.trim() || 'Предмет', teacher: teacher.trim(), color, icon };
    if (subject) await useWorkspace.getState().updateSubject(subject.id, patch);
    else await useWorkspace.getState().createSubject(patch);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={subject ? 'Редакция на предмет' : 'Нов предмет'}
      width={430}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Отказ
          </button>
          <button className="btn btn-primary" onClick={() => void save()}>
            Запази
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <span
            className="grid h-12 w-12 shrink-0 place-items-center rounded-xl"
            style={{ background: `color-mix(in srgb, ${color} 16%, transparent)`, color }}
          >
            <Icon name={icon} size={22} />
          </span>
          <label className="min-w-0 flex-1">
            <span className="mb-1 block label">Име</span>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void save()}
              placeholder="напр. Математика"
              className="field"
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block label">
            Преподавател (по избор)
          </span>
          <input value={teacher} onChange={(e) => setTeacher(e.target.value)} className="field" />
        </label>

        <div>
          <span className="mb-1.5 block label">Цвят</span>
          <div className="flex flex-wrap gap-2">
            {SUBJECT_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className="h-7 w-7 cursor-pointer rounded-full transition-transform hover:scale-110"
                style={{
                  background: c,
                  outline: color === c ? '2px solid var(--c-accent)' : '1px solid var(--c-line)',
                  outlineOffset: 2,
                }}
                aria-label={c}
              />
            ))}
          </div>
        </div>

        <div>
          <span className="mb-1.5 block label">Знак</span>
          <div className="flex flex-wrap gap-1.5">
            {SUBJECT_ICONS.map((i) => (
              <button
                key={i}
                onClick={() => setIcon(i)}
                className="grid h-9 w-9 cursor-pointer place-items-center rounded-lg transition-colors"
                style={{
                  background: icon === i ? `color-mix(in srgb, ${color} 16%, transparent)` : 'var(--c-surface-2)',
                  color: icon === i ? color : 'var(--c-muted)',
                  outline: icon === i ? `1px solid ${color}` : '1px solid var(--c-line)',
                }}
              >
                <Icon name={i} size={17} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
