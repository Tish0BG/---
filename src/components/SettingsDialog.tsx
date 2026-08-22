import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '@/state/appStore';
import { useAuth } from '@/state/authStore';
import { useSettings } from '@/state/settingsStore';
import { useTimer } from '@/state/timerStore';
import { useWorkspace, SUBJECT_COLORS } from '@/state/workspaceStore';
import { requestPersistence, storageEstimate } from '@/services/db';
import { createBackup, inspectBackup, restoreBackup, type BackupSummary } from '@/services/backupService';
import { useInstall } from '@/hooks/useInstall';
import { downloadBlob, formatBytes, formatDate } from '@/lib/util';
import { useT, useLang, useLangStore, L, type Lang } from '@/i18n';
import { S } from '@/i18n/strings';
import { Slider, Toggle } from './ui';
import { Button, IconButton, Sheet, useIsPhone } from './kit';
import { BRAND } from '@/brand';
import { Icon } from './Icon';

type SectionId =
  | 'account'
  | 'appearance'
  | 'study'
  | 'notifications'
  | 'writing'
  | 'data'
  | 'shortcuts'
  | 'about';

const SECTIONS: { id: SectionId; icon: string; label: { bg: string; en: string } }[] = [
  { id: 'account', icon: 'user', label: L('Профил и акаунт', 'Profile & account') },
  { id: 'appearance', icon: 'palette', label: L('Изглед и език', 'Appearance & language') },
  { id: 'study', icon: 'timer', label: L('Учене', 'Study') },
  { id: 'notifications', icon: 'bell', label: L('Известия', 'Notifications') },
  { id: 'writing', icon: 'pencil', label: L('Писане', 'Writing') },
  { id: 'data', icon: 'archive', label: L('Данни и офлайн', 'Data & offline') },
  { id: 'shortcuts', icon: 'command', label: L('Клавиши', 'Shortcuts') },
  { id: 'about', icon: 'info', label: L('За приложението', 'About') },
];

/**
 * Settings as a place, not a scroll.
 *
 * The old version was one 600-line column: theme, stylus pressure, grade
 * scales, backups and keyboard shortcuts stacked on top of each other, which
 * meant nobody ever found the third thing. Same options, eight named rooms.
 */
export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const phone = useIsPhone();
  const [section, setSection] = useState<SectionId>('account');

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open, onClose]);

  if (!open) return null;

  const body = <SectionBody id={section} />;

  if (phone) {
    return (
      <Sheet open onClose={onClose} title={t(S.settings)} maxHeight={0.92}>
        <div className="scroll-none -mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              className="flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-medium"
              style={{
                borderColor: section === s.id ? 'transparent' : 'var(--c-line)',
                background: section === s.id ? 'var(--c-accent-soft)' : 'var(--c-surface)',
                color: section === s.id ? 'var(--c-accent)' : 'var(--c-muted)',
              }}
            >
              <Icon name={s.icon} size={13} />
              {t(s.label)}
            </button>
          ))}
        </div>
        {body}
      </Sheet>
    );
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: 'rgb(6 7 10 / 52%)', backdropFilter: 'blur(3px)' }}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t(S.settings)}
        className="animate-scale flex w-full max-w-[860px] overflow-hidden rounded-[18px]"
        style={{
          height: 'min(660px, 88vh)',
          background: 'var(--c-surface)',
          border: '1px solid var(--c-line)',
          boxShadow: 'var(--shadow-float)',
        }}
      >
        <nav
          className="scroll-thin hidden w-[212px] shrink-0 flex-col overflow-y-auto border-r border-line p-2.5 sm:flex"
          style={{ background: 'var(--c-surface-2)' }}
        >
          <span className="t-label px-2.5 pb-2 pt-1">{t(S.settings)}</span>
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              aria-current={section === s.id ? 'page' : undefined}
              className={`mb-0.5 flex h-9 cursor-pointer items-center gap-2.5 rounded-[10px] px-2.5 text-[13px] transition-colors ${
                section === s.id ? 'font-semibold' : 'text-muted hover:bg-surface-3 hover:text-ink'
              }`}
              style={section === s.id ? { background: 'var(--c-accent-soft)', color: 'var(--c-accent)' } : undefined}
            >
              <Icon name={s.icon} size={15.5} />
              <span className="truncate">{t(s.label)}</span>
            </button>
          ))}
        </nav>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 shrink-0 items-center justify-between border-b border-line px-4">
            <h2 className="t-h3">{t(SECTIONS.find((s) => s.id === section)!.label)}</h2>
            <IconButton icon="x" label={t(S.close)} onClick={onClose} />
          </header>
          <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-5">{body}</div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function SectionBody({ id }: { id: SectionId }) {
  switch (id) {
    case 'account':
      return (
        <div className="space-y-7">
          <ProfileSection />
          <CloudSection />
        </div>
      );
    case 'appearance':
      return <AppearanceSection />;
    case 'study':
      return <StudySection />;
    case 'notifications':
      return <NotificationsSection />;
    case 'writing':
      return <WritingSection />;
    case 'data':
      return (
        <div className="space-y-7">
          <StorageSection />
          <BackupSection />
          <InstallSection />
        </div>
      );
    case 'shortcuts':
      return <ShortcutsSection />;
    case 'about':
    default:
      return <AboutSection />;
  }
}

/** Section heading used inside every pane. */
function Group({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="t-label mb-2">{title}</h3>
      {hint && <p className="mb-3 text-[12px] leading-relaxed text-muted">{hint}</p>}
      {children}
    </section>
  );
}

/* ------------------------------------------------------------- appearance */

function AppearanceSection() {
  const t = useT();
  const lang = useLang();
  const setLang = useLangStore((s) => s.setLang);
  const s = useSettings();

  return (
    <div className="space-y-7">
      <Group title={t(L('Език на интерфейса', 'Interface language'))}>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              { id: 'bg', label: 'Български', hint: 'BG' },
              { id: 'en', label: 'English', hint: 'EN' },
            ] as { id: Lang; label: string; hint: string }[]
          ).map((option) => (
            <button
              key={option.id}
              onClick={() => setLang(option.id)}
              className="flex cursor-pointer items-center gap-3 rounded-[12px] border p-3 text-left transition-colors"
              style={{
                borderColor: lang === option.id ? 'var(--c-accent)' : 'var(--c-line)',
                background: lang === option.id ? 'var(--c-accent-soft)' : 'var(--c-surface)',
              }}
            >
              <span
                className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] text-[11px] font-semibold"
                style={{
                  background: lang === option.id ? 'var(--c-accent)' : 'var(--c-surface-3)',
                  color: lang === option.id ? '#fff' : 'var(--c-muted)',
                }}
              >
                {option.hint}
              </span>
              <span className="text-[13.5px] font-medium">{option.label}</span>
              {lang === option.id && <Icon name="check" size={15} className="ml-auto text-accent" />}
            </button>
          ))}
        </div>
      </Group>

      <Group title={t(L('Тема', 'Theme'))}>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              { id: 'light', icon: 'sun', label: L('Светла', 'Light') },
              { id: 'dark', icon: 'moon', label: L('Тъмна', 'Dark') },
              { id: 'system', icon: 'sliders', label: L('Системна', 'System') },
            ] as const
          ).map((option) => (
            <button
              key={option.id}
              onClick={() => s.set('theme', option.id)}
              className="flex cursor-pointer flex-col items-center gap-2 rounded-[12px] border p-3 transition-colors"
              style={{
                borderColor: s.theme === option.id ? 'var(--c-accent)' : 'var(--c-line)',
                background: s.theme === option.id ? 'var(--c-accent-soft)' : 'var(--c-surface)',
                color: s.theme === option.id ? 'var(--c-accent)' : undefined,
              }}
            >
              <Icon name={option.icon} size={18} />
              <span className="text-[12.5px] font-medium">{t(option.label)}</span>
            </button>
          ))}
        </div>
      </Group>

      <Group
        title={t(L('PDF страницата в тъмен режим', 'PDF page in dark mode'))}
        hint={t(L('Само страницата се променя — бележките ти остават както са.', 'Only the page changes; your ink stays exactly as it is.'))}
      >
        <div className="flex gap-1.5">
          {(
            [
              ['off', L('Нормална', 'Normal')],
              ['dim', L('Приглушена', 'Dimmed')],
              ['invert', L('Инвертирана', 'Inverted')],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              className={`btn flex-1 ${s.pdfDarkMode === id ? 'btn-ghost-active' : 'btn-outline'}`}
              onClick={() => s.set('pdfDarkMode', id)}
            >
              {t(label)}
            </button>
          ))}
        </div>
      </Group>

      <Group title={t(L('Библиотека', 'Library'))}>
        <Toggle
          checked={s.showThumbnails}
          onChange={(v) => s.set('showThumbnails', v)}
          label={t(L('Миниатюри на страниците', 'Page thumbnails'))}
          hint={t(L('Показва малките изображения в страничния панел на документа.', 'Shows the small page previews in the document sidebar.'))}
        />
      </Group>
    </div>
  );
}

/* ------------------------------------------------------------------ study */

function StudySection() {
  const t = useT();
  const s = useSettings();
  const timer = s.timer;

  return (
    <div className="space-y-7">
      <Group
        title={t(L('Фокус сесия', 'Focus session'))}
        hint={t(L('Дължините важат за всяка следваща сесия — текущата не се променя.', 'These lengths apply to the next session; a running one is left alone.'))}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              { key: 'work', label: L('Учене', 'Focus'), min: 5, max: 90 },
              { key: 'break', label: L('Почивка', 'Break'), min: 1, max: 30 },
              { key: 'long', label: L('Дълга почивка', 'Long break'), min: 5, max: 45 },
              { key: 'cycles', label: L('Сесии до дълга почивка', 'Sessions per long break'), min: 2, max: 8 },
            ] as const
          ).map((row) => (
            <Slider
              key={row.key}
              label={t(row.label)}
              min={row.min}
              max={row.max}
              value={timer[row.key]}
              suffix={row.key === 'cycles' ? '' : ' min'}
              onChange={(v) => {
                s.setTimer({ [row.key]: v } as never);
                useTimer.getState().syncDuration();
              }}
            />
          ))}
        </div>
      </Group>

      <Group title={t(L('Дневна цел', 'Daily goal'))}>
        <Slider
          label={t(L('Минути на ден', 'Minutes a day'))}
          min={15}
          max={480}
          step={15}
          value={timer.goal}
          onChange={(v) => s.setTimer({ goal: v })}
        />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {[30, 60, 90, 120, 180].map((v) => (
            <button
              key={v}
              className={`btn btn-sm ${timer.goal === v ? 'btn-ghost-active' : 'btn-outline'}`}
              onClick={() => s.setTimer({ goal: v })}
            >
              {v} {t(L('мин', 'min'))}
            </button>
          ))}
        </div>
      </Group>

      <Group title={t(L('Поведение', 'Behaviour'))}>
        <Toggle
          checked={timer.autoStart}
          onChange={(v) => s.setTimer({ autoStart: v })}
          label={t(L('Автоматично пускане на следващия блок', 'Start the next block automatically'))}
          hint={t(L('След сесия започва почивката, след почивката — следващата сесия.', 'A break follows a session, and a session follows the break.'))}
        />
        <Toggle
          checked={timer.sound}
          onChange={(v) => s.setTimer({ sound: v })}
          label={t(L('Звук в края на блок', 'Sound at the end of a block'))}
        />
        <Toggle
          checked={timer.fullscreenOnStart}
          onChange={(v) => s.setTimer({ fullscreenOnStart: v })}
          label={t(L('Влизай във фокус режим при старт', 'Enter focus mode on start'))}
          hint={t(L('Целият екран става сесията, а не малък часовник в ъгъла.', 'The whole screen becomes the session instead of a small clock in the corner.'))}
        />
      </Group>

      <Group
        title={t(L('Скала на оценките', 'Grading scale'))}
        hint={t(L('Използва се в оценките по предмет и в сметката „какво ми трябва на следващото контролно“.', 'Used for subject averages and for "what do I need on the next test".'))}
      >
        <GradeScaleRow />
      </Group>
    </div>
  );
}

/* ---------------------------------------------------------- notifications */

function NotificationsSection() {
  const t = useT();
  const s = useSettings();
  const [permission, setPermission] = useState(
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
  );

  const ask = async () => {
    if (typeof Notification === 'undefined') return;
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === 'granted') s.setTimer({ notify: true });
  };

  return (
    <div className="space-y-7">
      <Group
        title={t(L('В приложението', 'Inside the app'))}
        hint={t(L('Камбанката горе събира просрочени задачи, наближаващи изпити, цели с краен срок и серии в риск. Списъкът се строи от твоите записи всеки път, когато го отвориш — нищо не се праща никъде.', 'The bell at the top gathers overdue tasks, exams coming up, goals near their deadline and streaks at risk. The list is built from your own records each time you open it — nothing is sent anywhere.'))}
      >
        <div className="card-quiet flex items-center gap-3 p-3">
          <Icon name="bellRing" size={18} className="text-accent" />
          <span className="flex-1 text-[13px]">
            {t(L('Известията в приложението са винаги включени.', 'In-app notices are always on.'))}
          </span>
        </div>
      </Group>

      <Group
        title={t(L('Системни известия', 'System notifications'))}
        hint={t(L('Използват се само за края на фокус блок, докато разделът е отворен.', 'Used only when a focus block ends, while the tab is open.'))}
      >
        {permission === 'unsupported' ? (
          <p className="text-[12.5px] text-muted">
            {t(L('Този браузър не поддържа системни известия.', 'This browser does not support system notifications.'))}
          </p>
        ) : permission === 'granted' ? (
          <Toggle
            checked={s.timer.notify}
            onChange={(v) => s.setTimer({ notify: v })}
            label={t(L('Известие в края на блок', 'Notify when a block ends'))}
          />
        ) : (
          <div className="flex items-center gap-3">
            <span className="flex-1 text-[12.5px] text-muted">
              {permission === 'denied'
                ? t(L('Отказано е от браузъра. Разреши го от иконата до адреса.', 'Blocked by the browser — allow it from the icon next to the address bar.'))
                : t(L('Плаувия ще поиска разрешение от браузъра.', 'Plauvia will ask the browser for permission.'))}
            </span>
            <Button variant="outline" icon="bell" disabled={permission === 'denied'} onClick={() => void ask()}>
              {t(L('Разреши', 'Allow'))}
            </Button>
          </div>
        )}
      </Group>
    </div>
  );
}

/* ---------------------------------------------------------------- writing */

function WritingSection() {
  const t = useT();
  const s = useSettings();
  return (
    <div className="space-y-7">
      <Group title={t(L('Стилус и ръка', 'Stylus and hand'))}>
        <Toggle
          checked={s.pressureSensitivity}
          onChange={(v) => s.set('pressureSensitivity', v)}
          label={t(L('Чувствителност към натиск', 'Pressure sensitivity'))}
          hint={t(L('Дебелината на линията следва натиска на стилуса, ако устройството го поддържа.', 'Stroke width follows the stylus pressure, where the device reports it.'))}
        />
        <Toggle
          checked={s.stylusOnly}
          onChange={(v) => s.set('stylusOnly', v)}
          label={t(L('Рисуване само със стилус', 'Draw with the stylus only'))}
          hint={t(L('Пръстът превърта страницата вместо да пише — предпазва от случайни линии с длан.', 'A finger scrolls instead of drawing, so a resting palm cannot leave a line.'))}
        />
        <Toggle
          checked={s.shapeRecognition}
          onChange={(v) => s.set('shapeRecognition', v)}
          label={t(L('Разпознаване на фигури', 'Shape recognition'))}
          hint={t(L('Начертан на ръка кръг, правоъгълник или права линия се превръща в идеална фигура.', 'A hand-drawn circle, rectangle or line snaps to a perfect one.'))}
        />
      </Group>

      <Group title={t(L('Гума', 'Eraser'))}>
        <Slider
          label={t(L('Размер на гумата', 'Eraser size'))}
          min={6}
          max={64}
          value={s.eraserSize}
          onChange={(v) => s.set('eraserSize', v)}
        />
      </Group>
    </div>
  );
}

/* ------------------------------------------------------------------- data */

function StorageSection() {
  const t = useT();
  const user = useAuth((s) => s.user);
  const [usage, setUsage] = useState({ usage: 0, quota: 0 });
  const [persisted, setPersisted] = useState<boolean | null>(null);

  useEffect(() => {
    void storageEstimate().then(setUsage);
    void navigator.storage
      ?.persisted?.()
      .then(setPersisted)
      .catch(() => setPersisted(null));
  }, []);

  return (
    <Group title={t(L('Съхранение', 'Storage'))}>
      <div className="card-quiet p-3 text-[12.5px]">
        <div className="flex justify-between">
          <span className="text-muted">{t(L('Използвано', 'Used'))}</span>
          <span className="t-num">
            {formatBytes(usage.usage)} {usage.quota ? `${t(L('от', 'of'))} ${formatBytes(usage.quota)}` : ''}
          </span>
        </div>
        {usage.quota > 0 && (
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-3">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(100, (usage.usage / usage.quota) * 100)}%`,
                background: 'var(--c-accent)',
              }}
            />
          </div>
        )}
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <span className="text-muted">
            {persisted
              ? t(L('Данните са защитени от изчистване.', 'Your data is protected from eviction.'))
              : t(L('Браузърът може да изчисти данните при недостиг на място.', 'The browser may clear this data if it runs short of space.'))}
          </span>
          {!persisted && (
            <Button variant="outline" onClick={() => void requestPersistence().then(setPersisted)}>
              {t(L('Защити', 'Protect'))}
            </Button>
          )}
        </div>
      </div>

      <p className="mt-2.5 text-[11.5px] leading-relaxed text-muted">
        {user
          ? t(
              L(
                'Всичко се записва първо тук, в браузъра, и приложението работи офлайн. Копие пътува и към твоята база, за да го намериш и на другите си устройства.',
                'Everything is written here first, in the browser, and the app works offline. A copy travels to your own database so the same library is on your other devices.',
              ),
            )
          : t(
              L(
                'Всички файлове и бележки се пазят локално в браузъра и нищо не тръгва към интернет. Затова направи резервно копие, преди да чистиш данните на браузъра.',
                'Files and notes are kept locally in this browser and nothing leaves it. Make a backup before you clear browser data.',
              ),
            )}
      </p>
    </Group>
  );
}

/* -------------------------------------------------------------- shortcuts */

function ShortcutsSection() {
  const t = useT();
  const groups = [
    {
      group: L('Навсякъде', 'Anywhere'),
      keys: [
        ['⌘/Ctrl + K', L('Търсене и команди', 'Search and commands')],
        ['T', L('Нова задача', 'New task')],
        ['E', L('Нов изпит', 'New exam')],
        ['G', L('Нова цел', 'New goal')],
        ['⌥ + Space', L('Старт / пауза на таймера', 'Start / pause the timer')],
        ['⌥ + T', L('Покажи / скрий таймера', 'Show / hide the timer')],
        ['⌥ + F', L('Фокус режим', 'Focus mode')],
      ],
    },
    {
      group: L('В документ', 'In a document'),
      keys: [
        ['⌘/Ctrl + Z', L('Отмени', 'Undo')],
        ['⌘/Ctrl + ⇧ + Z', L('Върни', 'Redo')],
        ['⌘/Ctrl + S', L('Запиши сега', 'Save now')],
        ['⌘/Ctrl + F', L('Търсене в документа', 'Find in document')],
        ['⌘/Ctrl + E', L('Експорт', 'Export')],
        ['⌘/Ctrl + D', L('Отметка на страницата', 'Bookmark the page')],
        ['⌘/Ctrl + + / − / 0', L('Мащаб / по ширина', 'Zoom / fit width')],
        ['← → PgUp PgDn', L('Навигация по страници', 'Move between pages')],
        ['Delete', L('Изтрий избраното', 'Delete the selection')],
        ['Esc', L('Откажи избора', 'Clear the selection')],
      ],
    },
    {
      group: L('Инструменти за писане', 'Writing tools'),
      keys: [
        ['V / H', L('Избор / Местене', 'Select / Pan')],
        ['P / M / E', L('Писалка / Маркер / Гума', 'Pen / Highlighter / Eraser')],
        ['L / R / O / A', L('Линия / Правоъгълник / Кръг / Стрелка', 'Line / Rectangle / Ellipse / Arrow')],
        ['T / G / C', L('Текст / Задача / Изрезка', 'Text / Problem / Snip')],
      ],
    },
  ];

  return (
    <div className="space-y-6">
      {groups.map((section) => (
        <div key={section.group.en}>
          <h3 className="t-label mb-2">{t(section.group)}</h3>
          <dl className="overflow-hidden rounded-[12px] border border-line">
            {section.keys.map(([key, label], i) => (
              <div
                key={key as string}
                className="flex items-center justify-between gap-4 px-3 py-2 text-[12.5px]"
                style={{ background: i % 2 ? 'var(--c-surface-2)' : 'transparent' }}
              >
                <dd className="text-ink">{t(label as { bg: string; en: string })}</dd>
                <dt className="t-num shrink-0 whitespace-nowrap text-[11px] text-faint">{key as string}</dt>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ about */

function AboutSection() {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const line = `${BRAND.name} ${__APP_VERSION__} · ${__BUILD_DATE__} · ${navigator.userAgent}`;

  return (
    <div className="space-y-6">
      <div className="card-quiet flex items-center gap-3 p-4">
        <span
          className="grid h-12 w-12 shrink-0 place-items-center rounded-[14px] text-white"
          style={{ background: 'var(--grad-brand)' }}
        >
          <Icon name="book" size={21} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-semibold">{BRAND.name}</div>
          <div className="t-num text-[11.5px] text-muted">
            {t(L('версия', 'version'))} {__APP_VERSION__} · {__BUILD_DATE__}
          </div>
        </div>
        <Button
          variant="outline"
          icon={copied ? 'check' : 'copy'}
          onClick={() => void navigator.clipboard.writeText(line).then(() => setCopied(true))}
        >
          {copied ? t(L('Копирано', 'Copied')) : t(L('Данни за проблем', 'Diagnostics'))}
        </Button>
      </div>

      <p className="text-[13px] leading-relaxed text-muted">{BRAND.description[useLang()]}</p>

      <a
        href={BRAND.url}
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 text-[13px] text-accent hover:underline"
      >
        <Icon name="link" size={14} />
        {BRAND.domain}
      </a>
    </div>
  );
}

/* ---------------------------------------------------------------- account */

function CloudSection() {
  const t = useT();
  const user = useAuth((s) => s.user);
  const configured = useAuth((s) => s.configured);
  const sync = useAuth((s) => s.sync);
  const pending = useAuth((s) => s.pendingFiles);
  const busy = sync.phase !== 'idle' && sync.phase !== 'done' && sync.phase !== 'error';

  return (
    <Group title={t(L('Синхронизация', 'Sync'))}>
      <div className="card-quiet p-3 text-[12.5px]">
        <div className="flex items-center gap-2.5">
          <Icon
            name={user ? 'cloud' : 'user'}
            size={17}
            style={{ color: user ? 'var(--c-success)' : 'var(--c-muted)' }}
          />
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium">
              {user
                ? user.email
                : configured
                  ? t(L('Не си влязъл', 'Not signed in'))
                  : t(L('Само на това устройство', 'This device only'))}
            </div>
            <div className="truncate text-[11.5px] text-muted">
              {user
                ? sync.lastSyncAt
                  ? `${t(L('Последно', 'Last'))} ${formatDate(sync.lastSyncAt)}${pending ? ` · ${pending} ${t(L('файла чакат', 'files waiting'))}` : ''}`
                  : t(L('Още не е синхронизирано', 'Not synced yet'))
                : t(L('Влез, за да имаш същата библиотека и на телефона.', 'Sign in to have the same library on your phone.'))}
            </div>
          </div>
          {user ? (
            <Button variant="outline" busy={busy} icon="refresh" onClick={() => void useAuth.getState().syncNow()}>
              {t(L('Сега', 'Now'))}
            </Button>
          ) : (
            <Button variant="primary" onClick={() => useApp.getState().setAuth(true)}>
              {configured ? t(L('Влез', 'Sign in')) : t(L('Настрой', 'Set up'))}
            </Button>
          )}
        </div>

        {user && (
          <Button block icon="sliders" className="mt-2" onClick={() => useApp.getState().setAuth(true)}>
            {t(L('Управление на профила', 'Manage account'))}
          </Button>
        )}

        {(sync.error || sync.warning) && (
          <p
            className="mt-2 flex items-start gap-1.5 text-[11.5px]"
            style={{ color: sync.error ? 'var(--c-danger)' : 'var(--c-warn)' }}
          >
            <Icon name="alert" size={12} className="mt-0.5 shrink-0" />
            {sync.error ?? sync.warning}
          </p>
        )}
      </div>
    </Group>
  );
}

const AVATARS = ['🦉', '🐨', '🦊', '🐼', '🐢', '🦁', '🐙', '🦄', '🐝', '🌿', '⚡️', '🚀'];

/** Who the app thinks you are. */
function ProfileSection() {
  const t = useT();
  const profile = useWorkspace((s) => s.profile);
  const save = useWorkspace((s) => s.saveProfile);

  return (
    <Group title={t(S.profile)}>
      <div className="flex items-center gap-3">
        <span
          className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-[26px]"
          style={{ background: `color-mix(in srgb, ${profile.color} 18%, transparent)` }}
        >
          {profile.avatar}
        </span>
        <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
          <input
            value={profile.name}
            onChange={(e) => void save({ name: e.target.value })}
            placeholder={t(L('Име', 'Name'))}
            className="field"
          />
          <input
            value={profile.grade}
            onChange={(e) => void save({ grade: e.target.value })}
            placeholder={t(L('Клас / курс', 'Year / course'))}
            className="field"
          />
          <input
            value={profile.school}
            onChange={(e) => void save({ school: e.target.value })}
            placeholder={t(L('Училище', 'School'))}
            className="field sm:col-span-2"
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {AVATARS.map((a) => (
          <button
            key={a}
            onClick={() => void save({ avatar: a })}
            className="grid h-8 w-8 cursor-pointer place-items-center rounded-[10px] text-[16px] transition-transform hover:scale-110"
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
            aria-label={c}
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
    </Group>
  );
}

/** Bulgarian schools use 2–6; other systems need different bounds. */
function GradeScaleRow() {
  const t = useT();
  const scale = useSettings((s) => s.gradeScale);
  const set = useSettings((s) => s.set);
  const presets = [
    { label: t(L('България 2–6', 'Bulgaria 2–6')), min: 2, max: 6, pass: 3 },
    { label: '1–10', min: 1, max: 10, pass: 5 },
    { label: '1–100', min: 1, max: 100, pass: 50 },
  ];
  return (
    <div className="flex gap-1.5">
      {presets.map((p) => (
        <button
          key={p.label}
          className={`btn flex-1 ${scale.min === p.min && scale.max === p.max ? 'btn-ghost-active' : 'btn-outline'}`}
          onClick={() => set('gradeScale', { min: p.min, max: p.max, pass: p.pass })}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------- install */

function InstallSection() {
  const t = useT();
  const { installed, canInstall, offline, install } = useInstall();
  const [result, setResult] = useState<string | null>(null);

  const offlineText: Record<typeof offline, string> = {
    ready: t(L('Готово за офлайн — приложението се отваря и без интернет.', 'Ready offline — the app opens with no network at all.')),
    pending: t(L('Офлайн кешът още не е готов. Презареди веднъж страницата.', 'The offline cache is not ready yet. Reload the page once.')),
    unsupported: t(L('Този браузър не поддържа офлайн режим.', 'This browser does not support offline mode.')),
    insecure: t(L('Офлайн режимът иска HTTPS.', 'Offline mode needs HTTPS.')),
  };
  const offlineColor =
    offline === 'ready' ? 'var(--c-success)' : offline === 'pending' ? 'var(--c-warn)' : 'var(--c-muted)';

  return (
    <Group title={t(L('Приложение', 'App'))}>
      <div className="card-quiet p-3 text-[12.5px]">
        <div className="flex items-center gap-2">
          <Icon
            name={installed ? 'checkCircle' : 'download'}
            size={16}
            style={{ color: installed ? 'var(--c-success)' : 'var(--c-muted)' }}
          />
          <span className="flex-1">
            {installed
              ? t(L('Работи като инсталирано приложение.', 'Running as an installed app.'))
              : t(L('Отворено е като страница в браузър.', 'Open as a page in the browser.'))}
          </span>
          {!installed && canInstall && (
            <Button
              variant="primary"
              onClick={() =>
                void install().then((r) => setResult(r === 'accepted' ? t(L('Инсталирано.', 'Installed.')) : null))
              }
            >
              {t(L('Инсталирай', 'Install'))}
            </Button>
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
            {t(
              L(
                'На iPhone/iPad: Сподели → „Към началния екран“. На Android: менюто ⋮ → „Инсталиране на приложението“.',
                'On iPhone/iPad: Share → "Add to Home Screen". On Android: ⋮ menu → "Install app".',
              ),
            )}
          </p>
        )}
        {result && <p className="mt-1.5 text-[11.5px] text-muted">{result}</p>}
      </div>
    </Group>
  );
}

/* ------------------------------------------------------------------ backup */

function BackupSection() {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<{ file: File; info: BackupSummary } | null>(null);

  const exportAll = async () => {
    setError(null);
    try {
      const blob = await createBackup(setStatus);
      const stamp = new Date().toISOString().slice(0, 10);
      downloadBlob(blob, `Plauvia ${stamp}.studypdf`);
      setStatus(`${t(L('Готово', 'Done'))} — ${formatBytes(blob.size)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t(L('Архивирането се провали.', 'The backup failed.')));
      setStatus(null);
    }
  };

  const inspect = async (file: File) => {
    setError(null);
    try {
      setPending({ file, info: await inspectBackup(file) });
    } catch (err) {
      setError(err instanceof Error ? err.message : t(L('Файлът не може да бъде прочетен.', 'The file could not be read.')));
    }
  };

  const restore = async (mode: 'merge' | 'replace') => {
    if (!pending) return;
    setError(null);
    try {
      await restoreBackup(pending.file, mode, setStatus);
      setStatus(t(L('Възстановено. Презареждам…', 'Restored. Reloading…')));
      setTimeout(() => window.location.reload(), 700);
    } catch (err) {
      setError(err instanceof Error ? err.message : t(L('Възстановяването се провали.', 'The restore failed.')));
      setStatus(null);
    }
  };

  return (
    <Group
      title={t(L('Резервно копие', 'Backup'))}
      hint={t(
        L(
          'Един файл с всичко: PDF-ите, дъските, бележките, картите, задачите и историята на таймера.',
          'One file with everything: the PDFs, boards, ink, cards, tasks and the whole focus history.',
        ),
      )}
    >
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
        <div className="card-quiet p-3 text-[12.5px]">
          <p className="mb-1 font-medium">{pending.file.name}</p>
          <p className="text-muted">
            {pending.info.documents} PDF · {pending.info.boards} {t(L('дъски', 'boards'))} ·{' '}
            {pending.info.annotations} {t(L('бележки', 'notes'))} · {pending.info.cards} {t(L('карти', 'cards'))}
          </p>
          <p className="mt-0.5 text-faint">
            {formatDate(pending.info.createdAt)} · {formatBytes(pending.info.bytes)}
          </p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            <Button variant="primary" onClick={() => void restore('merge')}>
              {t(L('Добави към текущите', 'Add to what is here'))}
            </Button>
            <Button variant="danger" onClick={() => void restore('replace')}>
              {t(L('Замени всичко', 'Replace everything'))}
            </Button>
            <Button onClick={() => setPending(null)}>{t(S.cancel)}</Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-1.5">
          <Button variant="outline" icon="archive" className="flex-1" onClick={() => void exportAll()}>
            {t(L('Запази архив', 'Save a backup'))}
          </Button>
          <Button variant="outline" icon="upload" className="flex-1" onClick={() => inputRef.current?.click()}>
            {t(L('Възстанови', 'Restore'))}
          </Button>
        </div>
      )}

      {status && <p className="mt-1.5 text-[11.5px] text-muted">{status}</p>}
      {error && (
        <p className="mt-1.5 flex items-center gap-1.5 text-[11.5px]" style={{ color: 'var(--c-danger)' }}>
          <Icon name="alert" size={12} />
          {error}
        </p>
      )}
    </Group>
  );
}
