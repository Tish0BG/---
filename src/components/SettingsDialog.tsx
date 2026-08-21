import { useEffect, useRef, useState } from 'react';
import { useApp } from '@/state/appStore';
import { useAuth } from '@/state/authStore';
import { useSettings } from '@/state/settingsStore';
import { useWorkspace, SUBJECT_COLORS } from '@/state/workspaceStore';
import { requestPersistence, storageEstimate } from '@/services/db';
import { createBackup, inspectBackup, restoreBackup, type BackupSummary } from '@/services/backupService';
import { downloadBlob } from '@/services/exportService';
import { useInstall } from '@/hooks/useInstall';
import { formatBytes, formatDate } from '@/lib/util';
import { Modal, Slider, Toggle } from './ui';
import { Icon } from './Icon';

/** Grouped, because a flat list of twenty rows is a list nobody reads. */
const SHORTCUTS: { group: string; keys: [string, string][] }[] = [
  {
    group: 'Навсякъде',
    keys: [
      ['⌘/Ctrl + K', 'Търсене навсякъде'],
      ['⌥ + Space', 'Старт / пауза на таймера'],
      ['⌥ + T', 'Покажи / скрий таймера'],
      ['⌥ + F', 'Таймер на цял екран'],
    ],
  },
  {
    group: 'В документ',
    keys: [
      ['⌘/Ctrl + Z', 'Отмени'],
      ['⌘/Ctrl + ⇧ + Z', 'Върни'],
      ['⌘/Ctrl + S', 'Запиши сега'],
      ['⌘/Ctrl + F', 'Търсене в документа'],
      ['⌘/Ctrl + E', 'Експорт'],
      ['⌘/Ctrl + D', 'Отметка на страницата'],
      ['⌘/Ctrl + +  /  −  /  0', 'Мащаб / по ширина'],
      ['← → PgUp PgDn Home End', 'Навигация по страници'],
      ['Delete', 'Изтрий избраното'],
      ['Esc', 'Откажи избора'],
    ],
  },
  {
    group: 'Инструменти за писане',
    keys: [
      ['V / H', 'Избор / Местене'],
      ['P / M / E', 'Писалка / Маркер / Гума'],
      ['L / R / O / A', 'Линия / Правоъгълник / Кръг / Стрелка'],
      ['T / G / C', 'Текст / Маркиране на задача / Изрезка'],
    ],
  },
];

export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useSettings();
  const [usage, setUsage] = useState({ usage: 0, quota: 0 });
  const [persisted, setPersisted] = useState<boolean | null>(null);

  useEffect(() => {
    if (!open) return;
    void storageEstimate().then(setUsage);
    void navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null));
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} title="Настройки" width={520}>
      <div className="space-y-6">
        <ProfileSection />

        <CloudSection />

        <section>
          <h3 className="mb-2 label">Изглед</h3>
          <div className="mb-3 flex gap-1.5">
            {(['light', 'dark', 'system'] as const).map((t) => (
              <button
                key={t}
                className={`btn flex-1 ${s.theme === t ? 'btn-ghost-active' : ''}`}
                onClick={() => s.set('theme', t)}
              >
                <Icon name={t === 'light' ? 'sun' : t === 'dark' ? 'moon' : 'sliders'} size={14} />
                {t === 'light' ? 'Светла' : t === 'dark' ? 'Тъмна' : 'Системна'}
              </button>
            ))}
          </div>
          <div className="mb-1 text-[12px]">PDF страницата в тъмен режим</div>
          <div className="flex gap-1.5">
            {(
              [
                ['off', 'Нормална'],
                ['dim', 'Приглушена'],
                ['invert', 'Инвертирана'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                className={`btn flex-1 ${s.pdfDarkMode === id ? 'btn-ghost-active' : ''}`}
                onClick={() => s.set('pdfDarkMode', id)}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h3 className="mb-1 label">Писане</h3>
          <Toggle
            checked={s.pressureSensitivity}
            onChange={(v) => s.set('pressureSensitivity', v)}
            label="Чувствителност към натиск"
            hint="Дебелината на линията следва натиска на стилуса, ако устройството го поддържа."
          />
          <Toggle
            checked={s.stylusOnly}
            onChange={(v) => s.set('stylusOnly', v)}
            label="Рисуване само със стилус"
            hint="Пръстът превърта страницата вместо да пише — предпазва от случайни линии с длан."
          />
          <Toggle
            checked={s.shapeRecognition}
            onChange={(v) => s.set('shapeRecognition', v)}
            label="Разпознаване на фигури"
            hint="Начертан на ръка кръг, правоъгълник или права линия се превръща в идеална фигура."
          />
          <div className="mt-2">
            <Slider
              label="Размер на гумата"
              min={6}
              max={64}
              value={s.eraserSize}
              onChange={(v) => s.set('eraserSize', v)}
            />
          </div>
        </section>

        <section>
          <h3 className="mb-2 label">Съхранение</h3>
          <div className="panel p-3 text-[12px]">
            <div className="flex justify-between">
              <span className="text-muted">Използвано</span>
              <span className="tabular-nums">
                {formatBytes(usage.usage)} {usage.quota ? `от ${formatBytes(usage.quota)}` : ''}
              </span>
            </div>
            {usage.quota > 0 && (
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-3">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.min(100, (usage.usage / usage.quota) * 100)}%`, background: 'var(--c-accent)' }}
                />
              </div>
            )}
            <div className="mt-2.5 flex items-center justify-between gap-2">
              <span className="text-muted">
                {persisted ? 'Данните са защитени от изчистване.' : 'Браузърът може да изчисти данните при недостиг на място.'}
              </span>
              {!persisted && (
                <button
                  className="btn"
                  onClick={() => void requestPersistence().then(setPersisted)}
                >
                  Защити
                </button>
              )}
            </div>
          </div>
          <StorageNote />
        </section>

        <section>
          <h3 className="mb-2 label">Оценки</h3>
          <GradeScaleRow />
        </section>

        <InstallSection />

        <BackupSection />

        <section>
          <h3 className="mb-2 label">Клавишни комбинации</h3>
          <div className="space-y-3">
            {SHORTCUTS.map((section) => (
              <div key={section.group}>
                <div className="mb-1 text-[11px] font-medium text-muted">{section.group}</div>
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[12px]">
                  {section.keys.map(([k, v]) => (
                    <div key={k} className="contents">
                      <dt className="whitespace-nowrap font-mono text-[11px] text-faint">{k}</dt>
                      <dd className="text-ink">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        </section>

        <AboutSection />
      </div>
    </Modal>
  );
}

/** The truth about where the data lives depends on whether you signed in. */
function StorageNote() {
  const user = useAuth((s) => s.user);
  return (
    <p className="mt-2 text-[11px] leading-relaxed text-muted">
      {user ? (
        <>
          Всичко се записва първо тук, в браузъра, и приложението работи офлайн. Копие пътува и към
          твоята Supabase база, за да го намериш и на другите си устройства. Резервното копие остава
          полезно — то е единственото, което не зависи от нищо друго.
        </>
      ) : (
        <>
          Всички файлове и бележки се пазят локално в браузъра (IndexedDB) и нищо не тръгва към
          интернет. Затова направи резервно копие, преди да чистиш данните на браузъра — или влез в
          профил, за да ги имаш и другаде.
        </>
      )}
    </p>
  );
}

/**
 * Version, build and what the app is. Small, but its absence is one of those
 * things that quietly says "unfinished" — and the version is the first thing
 * anyone needs when reporting a problem.
 */
function AboutSection() {
  const [copied, setCopied] = useState(false);
  const line = `StudyDesk ${__APP_VERSION__} · ${__BUILD_DATE__} · ${navigator.userAgent}`;

  return (
    <section>
      <h3 className="mb-2 label">За приложението</h3>
      <div className="panel flex items-center gap-3 p-3">
        <span
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
          style={{
            background: 'linear-gradient(140deg, var(--c-accent), color-mix(in srgb, var(--c-accent) 62%, #0ea5e9))',
            color: '#fff',
          }}
        >
          <Icon name="book" size={19} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium">StudyDesk</div>
          <div className="text-[11px] tabular-nums text-muted">
            версия {__APP_VERSION__} · {__BUILD_DATE__}
          </div>
        </div>
        <button
          className="btn btn-outline shrink-0"
          onClick={() => void navigator.clipboard.writeText(line).then(() => setCopied(true))}
          title="Полезно при съобщаване на проблем"
        >
          <Icon name={copied ? 'check' : 'copy'} size={14} />
          {copied ? 'Копирано' : 'Данни за проблем'}
        </button>
      </div>
    </section>
  );
}

/**
 * The account is the only part of the app that leaves the device, so the
 * section states plainly what is synced and what is not.
 */
function CloudSection() {
  const user = useAuth((s) => s.user);
  const configured = useAuth((s) => s.configured);
  const sync = useAuth((s) => s.sync);
  const pending = useAuth((s) => s.pendingFiles);
  const busy = sync.phase !== 'idle' && sync.phase !== 'done' && sync.phase !== 'error';

  return (
    <section>
      <h3 className="mb-2 label">Профил и синхронизация</h3>
      <div className="panel p-3 text-[12px]">
        <div className="flex items-center gap-2.5">
          <Icon
            name={user ? 'cloud' : 'user'}
            size={16}
            style={{ color: user ? 'var(--c-success)' : 'var(--c-muted)' }}
          />
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium">
              {user ? user.email : configured ? 'Не си влязъл' : 'Само на това устройство'}
            </div>
            <div className="truncate text-[11px] text-muted">
              {user
                ? sync.lastSyncAt
                  ? `Последно ${formatDate(sync.lastSyncAt)}${pending ? ` · ${pending} файла чакат` : ''}`
                  : 'Още не е синхронизирано'
                : 'Влез, за да имаш същата библиотека и на телефона.'}
            </div>
          </div>
          {user ? (
            <button className="btn shrink-0" disabled={busy} onClick={() => void useAuth.getState().syncNow()}>
              <Icon name="refresh" size={14} className={busy ? 'animate-spin' : ''} />
              Сега
            </button>
          ) : (
            <button className="btn btn-primary shrink-0" onClick={() => useApp.getState().setAuth(true)}>
              {configured ? 'Влез' : 'Настрой'}
            </button>
          )}
        </div>
        {user && (
          <button
            className="btn mt-2 w-full"
            onClick={() => useApp.getState().setAuth(true)}
          >
            <Icon name="sliders" size={14} />
            Управление на профила
          </button>
        )}
        {(sync.error || sync.warning) && (
          <p
            className="mt-2 flex items-start gap-1.5 text-[11px]"
            style={{ color: sync.error ? 'var(--c-danger)' : 'var(--c-warn)' }}
          >
            <Icon name="alert" size={12} className="mt-px shrink-0" />
            {sync.error ?? sync.warning}
          </p>
        )}
      </div>
    </section>
  );
}

/**
 * Installing is the difference between a tab and an app: full screen, its own
 * icon, and a cache that survives losing the network. Both depend on how the
 * app was published, so the state is spelled out instead of assumed.
 */
function InstallSection() {
  const { installed, canInstall, offline, install } = useInstall();
  const [result, setResult] = useState<string | null>(null);

  const offlineText: Record<typeof offline, string> = {
    ready: 'Готово за офлайн — приложението се отваря и без интернет.',
    pending: 'Офлайн кешът още не е готов. Презареди веднъж страницата.',
    unsupported: 'Този браузър не поддържа офлайн режим.',
    insecure: 'Офлайн режимът иска HTTPS. По http:// работи само на localhost.',
  };
  const offlineColor =
    offline === 'ready' ? 'var(--c-success)' : offline === 'pending' ? 'var(--c-warn)' : 'var(--c-muted)';

  return (
    <section>
      <h3 className="mb-2 label">Приложение</h3>
      <div className="panel p-3 text-[12px]">
        <div className="flex items-center gap-2">
          <Icon
            name={installed ? 'checkCircle' : 'download'}
            size={15}
            style={{ color: installed ? 'var(--c-success)' : 'var(--c-muted)' }}
          />
          <span className="flex-1">
            {installed ? 'Работи като инсталирано приложение.' : 'Отворено е като страница в браузър.'}
          </span>
          {!installed && canInstall && (
            <button
              className="btn btn-primary"
              onClick={() => void install().then((r) => setResult(r === 'accepted' ? 'Инсталирано.' : null))}
            >
              Инсталирай
            </button>
          )}
        </div>

        <div className="mt-2 flex items-start gap-2">
          <Icon name="cloud" size={15} className="mt-0.5 shrink-0" style={{ color: offlineColor }} />
          <span className="flex-1 leading-relaxed" style={{ color: offlineColor }}>
            {offlineText[offline]}
          </span>
        </div>

        {!installed && !canInstall && (
          <p className="mt-2 leading-relaxed text-muted">
            На iPhone/iPad: Сподели → „Към началния екран“. На Android: менюто ⋮ → „Инсталиране на
            приложението“. На компютър: иконката за инсталиране в адресната лента.
          </p>
        )}
        {result && <p className="mt-1.5 text-[11px] text-muted">{result}</p>}
      </div>
    </section>
  );
}

const AVATARS = ['🦉', '🐨', '🦊', '🐼', '🐢', '🦁', '🐙', '🦄', '🐝', '🌿', '⚡', '🚀'];

/** Who the app thinks you are. Local to this browser, like everything else. */
function ProfileSection() {
  const profile = useWorkspace((s) => s.profile);
  const save = useWorkspace((s) => s.saveProfile);

  return (
    <section>
      <h3 className="mb-2 label">Профил</h3>
      <div className="flex items-center gap-3">
        <span
          className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-[22px]"
          style={{ background: `color-mix(in srgb, ${profile.color} 18%, transparent)` }}
        >
          {profile.avatar}
        </span>
        <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
          <input
            value={profile.name}
            onChange={(e) => void save({ name: e.target.value })}
            placeholder="Име"
            className="field"
          />
          <input
            value={profile.grade}
            onChange={(e) => void save({ grade: e.target.value })}
            placeholder="Клас / курс"
            className="field"
          />
          <input
            value={profile.school}
            onChange={(e) => void save({ school: e.target.value })}
            placeholder="Училище"
            className="field sm:col-span-2"
          />
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {AVATARS.map((a) => (
          <button
            key={a}
            onClick={() => void save({ avatar: a })}
            className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-[16px] transition-transform hover:scale-105"
            style={{
              background: profile.avatar === a ? `color-mix(in srgb, ${profile.color} 18%, transparent)` : 'transparent',
            }}
          >
            {a}
          </button>
        ))}
        <span className="mx-1 h-5 w-px bg-line" />
        {SUBJECT_COLORS.slice(0, 6).map((c) => (
          <button
            key={c}
            onClick={() => void save({ color: c })}
            className="h-5 w-5 cursor-pointer rounded-full transition-transform hover:scale-110"
            style={{
              background: c,
              outline: profile.color === c ? '2px solid var(--c-accent)' : '1px solid var(--c-line)',
              outlineOffset: 2,
            }}
          />
        ))}
      </div>
    </section>
  );
}

/** Bulgarian schools use 2–6; other systems need different bounds. */
function GradeScaleRow() {
  const scale = useSettings((s) => s.gradeScale);
  const set = useSettings((s) => s.set);
  const presets = [
    { label: 'България 2–6', min: 2, max: 6, pass: 3 },
    { label: '1–10', min: 1, max: 10, pass: 5 },
    { label: '1–100', min: 1, max: 100, pass: 50 },
  ];
  return (
    <>
      <div className="flex gap-1.5">
        {presets.map((p) => (
          <button
            key={p.label}
            className={`btn flex-1 ${scale.min === p.min && scale.max === p.max ? 'btn-ghost-active' : ''}`}
            onClick={() => set('gradeScale', { min: p.min, max: p.max, pass: p.pass })}
          >
            {p.label}
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-[11px] text-muted">
        Скалата се използва в оценките по предмети и в сметката „какво ми трябва на следващото
        контролно“.
      </p>
    </>
  );
}

/**
 * The library lives only in this browser, so a one-file archive is the whole
 * safety net: everything in, everything back out.
 */
function BackupSection() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<{ file: File; info: BackupSummary } | null>(null);

  const exportAll = async () => {
    setError(null);
    try {
      const blob = await createBackup(setStatus);
      const stamp = new Date().toISOString().slice(0, 10);
      downloadBlob(blob, `StudyPDF ${stamp}.studypdf`);
      setStatus(`Готово — ${formatBytes(blob.size)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Архивирането се провали.');
      setStatus(null);
    }
  };

  const inspect = async (file: File) => {
    setError(null);
    try {
      setPending({ file, info: await inspectBackup(file) });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Файлът не може да бъде прочетен.');
    }
  };

  const restore = async (mode: 'merge' | 'replace') => {
    if (!pending) return;
    setError(null);
    try {
      await restoreBackup(pending.file, mode, setStatus);
      setStatus('Възстановено. Презареждам…');
      setTimeout(() => window.location.reload(), 700);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Възстановяването се провали.');
      setStatus(null);
    }
  };

  return (
    <section>
      <h3 className="mb-2 label">Резервно копие</h3>
      <input
        ref={inputRef}
        type="file"
        accept=".studypdf"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void inspect(file);
          e.target.value = '';
        }}
      />

      {pending ? (
        <div className="panel p-3 text-[12px]">
          <p className="mb-1 font-medium">{pending.file.name}</p>
          <p className="text-muted">
            {pending.info.documents} PDF · {pending.info.boards} дъски · {pending.info.annotations} бележки ·{' '}
            {pending.info.cards} карти
            {pending.info.subjects ? ` · ${pending.info.subjects} предмета` : ''}
            {pending.info.planner ? ` · ${pending.info.planner} задачи` : ''}
          </p>
          <p className="mt-0.5 text-faint">
            Създаден {formatDate(pending.info.createdAt)} · {formatBytes(pending.info.bytes)}
          </p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            <button className="btn btn-primary" onClick={() => void restore('merge')}>
              Добави към текущите
            </button>
            <button className="btn" style={{ color: 'var(--c-danger)' }} onClick={() => void restore('replace')}>
              Замени всичко
            </button>
            <button className="btn" onClick={() => setPending(null)}>
              Отказ
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-1.5">
          <button className="btn flex-1" onClick={() => void exportAll()}>
            <Icon name="archive" size={15} />
            Запази архив
          </button>
          <button className="btn flex-1" onClick={() => inputRef.current?.click()}>
            <Icon name="upload" size={15} />
            Възстанови
          </button>
        </div>
      )}

      {status && <p className="mt-1.5 text-[11px] text-muted">{status}</p>}
      {error && (
        <p className="mt-1.5 flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--c-danger)' }}>
          <Icon name="alert" size={12} />
          {error}
        </p>
      )}
      <p className="mt-2 text-[11px] leading-relaxed text-muted">
        Един файл с всичко: PDF-ите, дъските, бележките, отметките, флашкартите и статистиката на таймера.
        Пази го на друго устройство — така пренасяш библиотеката и на друг компютър.
      </p>
    </section>
  );
}
