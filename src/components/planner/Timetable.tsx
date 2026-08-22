import { useMemo, useState } from 'react';
import { useWorkspace } from '@/state/workspaceStore';
import { usePlanner, toMinutes } from '@/state/plannerStore';
import { MenuItem, Popover } from '../ui';
import { useT, useLang, L, weekdayNames } from '@/i18n';
import { S } from '@/i18n/strings';
import { Button, Card, EmptyState } from '../kit';

const DAYS = [1, 2, 3, 4, 5];
const PX_PER_MIN = 0.9;

/**
 * The week at a glance. Blocks are positioned by real time, so gaps between
 * lessons look like gaps — which is where revision actually fits.
 */
export function Timetable() {
  const t = useT();
  const lang = useLang();
  const dayNames = weekdayNames(lang, 'long');
  const dayShort = weekdayNames(lang);
  const schedule = usePlanner((s) => s.schedule);
  const subjects = useWorkspace((s) => s.subjects);
  const [adding, setAdding] = useState<number | null>(null);

  // Always show a full school day, then stretch if lessons fall outside it —
  // a single 45-minute class should not collapse the week into one strip.
  const bounds = useMemo(() => {
    let from = 8 * 60;
    let to = 16 * 60;
    for (const s of schedule) {
      from = Math.min(from, toMinutes(s.start));
      to = Math.max(to, toMinutes(s.end));
    }
    return { from: Math.floor(from / 60) * 60, to: Math.ceil(to / 60) * 60 };
  }, [schedule]);

  const height = (bounds.to - bounds.from) * PX_PER_MIN;
  const hours = Array.from(
    { length: Math.max(1, (bounds.to - bounds.from) / 60 + 1) },
    (_, i) => bounds.from / 60 + i,
  );

  const today = new Date().getDay();
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  const showNow = nowMinutes >= bounds.from && nowMinutes <= bounds.to;

  if (subjects.length === 0) {
    return (
      <Card>
        <EmptyState
          icon="layers"
          title={t(L('Първо предметите', 'Subjects first'))}
          body={t(L('Добави предметите си и после им сложи часове в седмицата.', 'Add your subjects, then give them slots in the week.'))}
        />
      </Card>
    );
  }

  return (
    <Card flush>
      <div className="flex border-b border-line">
        <div className="w-11 shrink-0" />
        {DAYS.map((d) => (
          <div
            key={d}
            className="flex-1 py-2 text-center text-[12px] font-medium"
            style={d === today ? { color: 'var(--c-accent)' } : { color: 'var(--c-muted)' }}
          >
            <span className="hidden sm:inline">{dayNames[(d + 6) % 7]}</span>
            <span className="sm:hidden">{dayShort[(d + 6) % 7]}</span>
          </div>
        ))}
      </div>

      <div className="flex">
        <div className="w-11 shrink-0" style={{ height }}>
          {hours.map((h) => (
            <div
              key={h}
              className="relative text-[10px] tabular-nums text-faint"
              style={{ height: 60 * PX_PER_MIN }}
            >
              <span className="absolute -top-1.5 right-1.5">{String(h).padStart(2, '0')}:00</span>
            </div>
          ))}
        </div>

        <div className="relative flex flex-1" style={{ height }}>
          {hours.map((h, i) => (
            <div
              key={h}
              className="pointer-events-none absolute inset-x-0 border-t border-line"
              style={{ top: i * 60 * PX_PER_MIN }}
            />
          ))}

          {showNow && (
            <div
              className="pointer-events-none absolute inset-x-0 z-10 h-px"
              style={{ top: (nowMinutes - bounds.from) * PX_PER_MIN, background: 'var(--c-danger)' }}
            >
              <span
                className="absolute -left-1 -top-[3px] h-[7px] w-[7px] rounded-full"
                style={{ background: 'var(--c-danger)' }}
              />
            </div>
          )}

          {DAYS.map((d) => (
            <div key={d} className="relative flex-1 border-l border-line">
              {schedule
                .filter((s) => s.day === d)
                .map((slot) => {
                  const subject = subjects.find((x) => x.id === slot.subjectId);
                  const top = (toMinutes(slot.start) - bounds.from) * PX_PER_MIN;
                  const h = Math.max(22, (toMinutes(slot.end) - toMinutes(slot.start)) * PX_PER_MIN);
                  return (
                    <button
                      key={slot.id}
                      onClick={() => void usePlanner.getState().removeSlot(slot.id)}
                      title={`${subject?.name ?? ''} ${slot.start}–${slot.end}\n${t(L('Клик за изтриване', 'Click to remove'))}`}
                      className="absolute inset-x-0.5 cursor-pointer overflow-hidden rounded-md px-1.5 py-1 text-left transition-opacity hover:opacity-80"
                      style={{
                        top,
                        height: h,
                        background: `color-mix(in srgb, ${subject?.color ?? '#64748b'} 16%, transparent)`,
                        borderLeft: `2.5px solid ${subject?.color ?? '#64748b'}`,
                      }}
                    >
                      <span
                        className="block truncate text-[11px] font-medium leading-tight"
                        style={{ color: subject?.color }}
                      >
                        {subject?.name ?? t(L('Час', 'Class'))}
                      </span>
                      {h > 34 && (
                        <span className="block truncate text-[10px] tabular-nums text-muted">
                          {slot.start}–{slot.end}
                          {slot.room ? ` · ${slot.room}` : ''}
                        </span>
                      )}
                    </button>
                  );
                })}

              <button
                onClick={() => setAdding(adding === d ? null : d)}
                className="absolute inset-x-0 bottom-0 h-7 cursor-pointer text-[11px] text-faint opacity-0 transition-opacity hover:bg-surface-2 hover:opacity-100"
              >
                + {t(L('час', 'class'))}
              </button>
            </div>
          ))}
        </div>
      </div>

      {adding !== null && <AddSlot day={adding} onDone={() => setAdding(null)} />}
    </Card>
  );
}

function AddSlot({ day, onDone }: { day: number; onDone: () => void }) {
  const t = useT();
  const lang = useLang();
  const subjects = useWorkspace((s) => s.subjects);
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? '');
  const [start, setStart] = useState('08:00');
  const [end, setEnd] = useState('08:45');
  const [room, setRoom] = useState('');
  const subject = subjects.find((s) => s.id === subjectId);

  return (
    <div className="flex flex-wrap items-end gap-2 border-t border-line p-3">
      <span className="text-[12px] font-medium">{weekdayNames(lang, 'long')[(day + 6) % 7]}</span>
      <Popover
        width={200}
        trigger={({ toggle, ref }) => (
          <button ref={ref} className="btn h-8" onClick={toggle}>
            {subject ? (
              <>
                <span className="h-2 w-2 rounded-full" style={{ background: subject.color }} />
                {subject.name}
              </>
            ) : (
              t(L('Избери предмет', 'Pick a subject'))
            )}
          </button>
        )}
      >
        {(close) =>
          subjects.map((s) => (
            <MenuItem
              key={s.id}
              icon={s.icon}
              label={s.name}
              onClick={() => {
                setSubjectId(s.id);
                close();
              }}
            />
          ))
        }
      </Popover>
      <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="field h-8 w-28" />
      <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="field h-8 w-28" />
      <input
        value={room}
        onChange={(e) => setRoom(e.target.value)}
        placeholder={t(L('каб.', 'room'))}
        className="field h-8 w-20"
      />
      <Button
        variant="primary"
        disabled={!subjectId}
        onClick={() => {
          void usePlanner.getState().addSlot({ subjectId, day, start, end, room: room.trim() });
          onDone();
        }}
      >
        {t(S.add)}
      </Button>
      <Button onClick={onDone}>{t(S.cancel)}</Button>
    </div>
  );
}
