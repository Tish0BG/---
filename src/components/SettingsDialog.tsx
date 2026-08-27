import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '@/state/appStore';
import { useAuth } from '@/state/authStore';
import { useSettings } from '@/state/settingsStore';
import { useWorkspace, SUBJECT_COLORS } from '@/state/workspaceStore';
import { requestPersistence, storageEstimate } from '@/services/db';
import { createBackup, inspectBackup, restoreBackup, type BackupSummary } from '@/services/backupService';
import { useInstall } from '@/hooks/useInstall';
import { downloadBlob, formatBytes, formatDate } from '@/lib/util';
import { useT, useLang, useLangStore, L, type Lang } from '@/i18n';
import type { Accent, LearningProfile, PrivacySettings, Profile } from '@/types';
import { claimUsername, normaliseUsername, validateUsername } from '@/services/usernameService';
import { S } from '@/i18n/strings';
import { Select, Slider, Toggle } from './ui';
import { Button, IconButton, Sheet, useIsPhone } from './kit';
import { BRAND } from '@/brand';
import { Icon } from './Icon';
import {
  askPermission,
  notifyPermission,
  testNotification,
  type NotifyPermission,
} from '@/services/reminderService';
import { SecuritySection } from './settings/SecuritySection';
import { SyncSection } from './settings/SyncSection';
import { DangerSection } from './settings/DangerSection';
import { ProfileAvatar } from './profile/ProfileAvatar';

type SectionId =
  | 'account'
  | 'appearance'
  | 'security'
  | 'sync'
  | 'access'
  | 'privacy'
  | 'study'
  | 'notifications'
  | 'writing'
  | 'data'
  | 'shortcuts'
  | 'danger'
  | 'about';

const SECTIONS: { id: SectionId; icon: string; label: { bg: string; en: string } }[] = [
  { id: 'account', icon: 'user', label: L('Профил и акаунт', 'Profile & account') },
  { id: 'security', icon: 'shield', label: L('Сигурност', 'Security') },
  { id: 'sync', icon: 'cloud', label: L('Синхронизация', 'Sync') },
  { id: 'appearance', icon: 'palette', label: L('Изглед и език', 'Appearance & language') },
  { id: 'access', icon: 'eye', label: L('Достъпност', 'Accessibility') },
  { id: 'privacy', icon: 'shield', label: L('Поверителност', 'Privacy') },
  { id: 'study', icon: 'timer', label: L('Фокус и оценки', 'Focus & marks') },
  { id: 'notifications', icon: 'bell', label: L('Известия', 'Notifications') },
  { id: 'writing', icon: 'pencil', label: L('Писане', 'Writing') },
  { id: 'data', icon: 'archive', label: L('Данни и офлайн', 'Data & offline') },
  { id: 'shortcuts', icon: 'command', label: L('Клавиши', 'Shortcuts') },
  { id: 'danger', icon: 'trash', label: L('Изтриване на профила', 'Delete account') },
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
  const requested = useApp((s) => s.settingsSection);

  // Somewhere else asked for a particular room — the profile menu pointing at
  // sync, or "Take your data with you" pointing at the backup.
  useEffect(() => {
    if (!open || !requested) return;
    if (SECTIONS.some((s) => s.id === requested)) setSection(requested as SectionId);
  }, [open, requested]);

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

  const body = <SectionBody id={section} onClose={onClose} />;

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
                borderColor: 'var(--c-line)',
                background: section === s.id ? 'var(--c-surface-3)' : 'var(--c-surface)',
                color: section === s.id ? 'var(--c-text)' : 'var(--c-muted)',
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
        className="animate-scale flex w-full max-w-[860px] overflow-hidden rounded-[14px]"
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
              className={`mb-0.5 flex h-9 cursor-pointer items-center gap-2.5 rounded-[8px] px-2.5 text-[13px] transition-colors ${
                section === s.id
                  ? 'bg-surface-3 font-medium text-ink'
                  : 'text-muted hover:bg-surface-3 hover:text-ink'
              }`}
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

function SectionBody({ id, onClose }: { id: SectionId; onClose: () => void }) {
  switch (id) {
    case 'account':
      return <ProfileSection />;
    case 'appearance':
      return <AppearanceSection />;
    case 'security':
      return <SecuritySection />;
    case 'sync':
      return <SyncSection />;
    case 'danger':
      return <DangerSection onClose={onClose} />;
    case 'access':
      return <AccessibilitySection />;
    case 'privacy':
      return <PrivacySection />;
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
                className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px] text-[11px] font-semibold"
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
        title={t(L('Акцент', 'Accent'))}
        hint={t(
          L(
            'Оцветява бутоните, избраното и напредъка. Знакът на Plauvia остава син — самоличност, която се сменя с настройка, не е самоличност.',
            'Colours the buttons, the selection and the progress. The Plauvia mark stays blue — an identity that changes with a preference is not an identity.',
          ),
        )}
      >
        <div className="flex flex-wrap gap-2">
          {ACCENT_CHOICES.map((option) => (
            <button
              key={option.id}
              onClick={() => s.set('accent', option.id)}
              aria-pressed={s.accent === option.id}
              className="flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-[13px] font-medium transition-colors"
              style={{
                borderColor: s.accent === option.id ? 'var(--c-accent)' : 'var(--c-line)',
                background: s.accent === option.id ? 'var(--c-accent-soft)' : 'var(--c-surface)',
              }}
            >
              <span aria-hidden className="h-4 w-4 rounded-full" style={{ background: option.swatch }} />
              {t(option.label)}
              {s.accent === option.id && <Icon name="check" size={13} strokeWidth={2.6} className="text-accent" />}
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


/** The six accents, and the swatch each of them shows in its own colour. */
const ACCENT_CHOICES: { id: Accent; label: { bg: string; en: string }; swatch: string }[] = [
  { id: 'brand', label: L('Plauvia', 'Plauvia'), swatch: '#1857d6' },
  { id: 'cyan', label: L('Циан', 'Cyan'), swatch: '#00697f' },
  { id: 'green', label: L('Зелено', 'Green'), swatch: '#04703f' },
  { id: 'amber', label: L('Кехлибар', 'Amber'), swatch: '#9a5b00' },
  { id: 'rose', label: L('Розово', 'Rose'), swatch: '#c22a63' },
  { id: 'violet', label: L('Виолетово', 'Violet'), swatch: '#6539d6' },
];

/* ---------------------------------------------------------- accessibility */

/**
 * The three preferences that decide whether the product is usable at all for
 * some people, in one place rather than scattered through the appearance tab.
 *
 * None of them is asked for during setup. Somebody who needs larger text
 * already has it turned on system-wide and does not want a wizard asking; the
 * point of this page is that it is findable, not that it is unavoidable.
 */
function AccessibilitySection() {
  const t = useT();
  const s = useSettings();
  const systemReduced =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <div className="space-y-7">
      <Group
        title={t(L('Размер на текста', 'Text size'))}
        hint={t(
          L(
            'Мащабира целия интерфейс наведнъж, не само едно място.',
            'Scales the whole interface at once, not one corner of it.',
          ),
        )}
      >
        <div className="grid grid-cols-4 gap-2">
          {(
            [
              [0.9, L('Компактен', 'Compact')],
              [1, L('Обичаен', 'Default')],
              [1.15, L('Едър', 'Large')],
              [1.3, L('Много едър', 'Larger')],
            ] as const
          ).map(([scale, label]) => (
            <button
              key={scale}
              onClick={() => s.set('typeScale', scale)}
              aria-pressed={s.typeScale === scale}
              className="cursor-pointer rounded-[12px] border p-3 text-center transition-colors"
              style={{
                borderColor: s.typeScale === scale ? 'var(--c-accent)' : 'var(--c-line)',
                background: s.typeScale === scale ? 'var(--c-accent-soft)' : 'var(--c-surface)',
              }}
            >
              <span className="block font-semibold leading-none" style={{ fontSize: `${13 * scale}px` }}>
                Aa
              </span>
              <span className="mt-1.5 block text-[11px] text-muted">{t(label)}</span>
            </button>
          ))}
        </div>
      </Group>

      <Group
        title={t(L('Движение', 'Motion'))}
        hint={
          systemReduced
            ? t(L('Системата ти вече иска по-малко движение.', 'Your system already asks for less motion.'))
            : undefined
        }
      >
        <div className="flex gap-1.5">
          {(
            [
              ['system', L('Като системата', 'Follow the system')],
              ['reduced', L('По-малко', 'Reduced')],
              ['full', L('Пълно', 'Full')],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              className={`btn flex-1 ${s.motion === id ? 'btn-ghost-active' : 'btn-outline'}`}
              aria-pressed={s.motion === id}
              onClick={() => s.set('motion', id)}
            >
              {t(label)}
            </button>
          ))}
        </div>
      </Group>

      <Group title={t(L('Контраст', 'Contrast'))}>
        <Toggle
          checked={s.highContrast}
          onChange={(v) => s.set('highContrast', v)}
          label={t(L('Висок контраст', 'High contrast'))}
          hint={t(
            L(
              'Подсилва границите между панелите и най-тихия текст, вместо да обръща палитрата.',
              'Strengthens the borders between panels and the quietest text, rather than inverting the palette.',
            ),
          )}
        />
      </Group>
    </div>
  );
}

/* --------------------------------------------------------------- privacy */

/**
 * Who may see what — set now, for a product that shows nobody anything yet.
 *
 * Saying that plainly at the top matters more than the switches do: a privacy
 * page that implies a profile is already public would be its own small lie.
 */
function PrivacySection() {
  const t = useT();
  const privacy = useWorkspace((s) => s.privacy);
  const save = useWorkspace((s) => s.savePrivacy);

  type Row = Exclude<keyof PrivacySettings, 'updatedAt'>;
  const rows: { key: Row; label: { bg: string; en: string }; hint: { bg: string; en: string } }[] = [
    {
      key: 'profile',
      label: L('Профил', 'Profile'),
      hint: L('Основният превключвател: без него нищо друго не се вижда.', 'The main switch: with it off, nothing else is visible.'),
    },
    {
      key: 'displayName',
      label: L('Име за показване', 'Display name'),
      hint: L('Името, с което те поздравява приложението.', 'The name the app greets you by.'),
    },
    {
      key: 'interests',
      label: L('Интереси', 'Interests'),
      hint: L('Предметите, които си избрал при настройката.', 'The subjects you picked during setup.'),
    },
    {
      key: 'achievements',
      label: L('Постижения', 'Achievements'),
      hint: L('Ниво, значки и серии.', 'Level, badges and streaks.'),
    },
    {
      key: 'progress',
      label: L('Напредък', 'Progress'),
      hint: L('Часове и напредък по учебник.', 'Hours and progress per book.'),
    },
  ];

  return (
    <div className="space-y-7">
      <div
        className="flex gap-3 rounded-[var(--radius-lg)] p-3.5"
        style={{ background: 'var(--c-info-soft)', border: '1px solid color-mix(in srgb, var(--c-info) 30%, transparent)' }}
      >
        <Icon name="info" size={16} className="mt-px shrink-0" style={{ color: 'var(--c-info)' }} />
        <p className="text-[12.5px] leading-relaxed" style={{ color: 'var(--c-info)' }}>
          {t(
            L(
              'Plauvia още няма публични профили — нищо тук не се вижда от друг човек. Настройките съществуват отсега, за да не се налага един ден да се гадае какво би искал.',
              'Plauvia has no public profiles yet — none of this is visible to anyone else. The settings exist now so that nobody has to guess later what you would have wanted.',
            ),
          )}
        </p>
      </div>

      {rows.map((row) => (
        <Group key={row.key} title={t(row.label)} hint={t(row.hint)}>
          <div className="flex gap-1.5">
            {(
              [
                ['private', L('Само за мен', 'Only me'), 'lock'],
                ['public', L('Публично', 'Public'), 'globe'],
              ] as const
            ).map(([value, label, icon]) => (
              <button
                key={value}
                className={`btn flex-1 ${privacy[row.key] === value ? 'btn-ghost-active' : 'btn-outline'}`}
                aria-pressed={privacy[row.key] === value}
                onClick={() => void save({ [row.key]: value } as Partial<PrivacySettings>)}
              >
                <Icon name={icon} size={14} />
                {t(label)}
              </button>
            ))}
          </div>
        </Group>
      ))}
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
      {/* The lengths and the daily goal used to live here, three clicks from
          the clock they belong to. They are on the focus screen now, beside
          the ring — a number you change because today feels like a
          fifty-minute day should not be behind a settings dialog. What is left
          here is the pointer, so somebody who goes looking in the old place
          finds the new one instead of an absence. */}
      <Group
        title={t(L('Фокус сесия', 'Focus session'))}
        hint={t(
          L(
            'Дължините на блоковете и дневната цел вече се нагласят на екрана „Фокус“, до самия часовник.',
            'Block lengths and the daily goal are set on the Focus screen now, next to the clock itself.',
          ),
        )}
      >
        <button
          onClick={() => {
            useApp.getState().setSettings(false);
            useApp.getState().go('focus');
          }}
          className="flex w-full cursor-pointer items-center gap-3 rounded-[12px] border border-line p-3 text-left transition-colors hover:border-line-strong hover:bg-surface-2"
        >
          <span
            className="grid h-10 w-10 shrink-0 place-items-center rounded-[11px]"
            style={{ background: 'var(--c-accent-soft)', color: 'var(--c-accent)' }}
          >
            <Icon name="timer" size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13.5px] font-medium">{t(L('Отвори „Фокус“', 'Open Focus'))}</span>
            <span className="t-num block text-[12px] text-muted">
              {t(
                L(
                  `Сега: ${timer.work} / ${timer.break} / ${timer.long} мин · цел ${timer.goal} мин`,
                  `Now: ${timer.work} / ${timer.break} / ${timer.long} min · goal ${timer.goal} min`,
                ),
              )}
            </span>
          </span>
          <Icon name="arrowRight" size={16} className="shrink-0 text-faint" />
        </button>
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
  const [permission, setPermission] = useState<NotifyPermission>(notifyPermission());

  /**
   * The browser is asked at the moment the switch is flipped, not on arrival.
   * A permission prompt that appears before anybody has asked for anything is
   * a prompt that gets denied, and a denial is permanent.
   */
  const enable = async () => {
    const result = await askPermission();
    setPermission(result);
    if (result === 'granted') s.setReminders({ enabled: true });
  };

  const on = s.reminders.enabled && permission === 'granted';

  return (
    <div className="space-y-7">
      <Group
        title={t(L('В приложението', 'Inside the app'))}
        hint={t(L('Кутията долу вляво събира просрочени задачи, наближаващи срокове и серии в риск. Списъкът се строи от твоите записи всеки път, когато го отвориш — нищо не се праща никъде.', 'The inbox at the foot of the rail gathers overdue tasks, deadlines coming up and streaks at risk. The list is built from your own records each time you open it — nothing is sent anywhere.'))}
      >
        <div className="card-quiet flex items-center gap-3 p-3">
          <Icon name="bellRing" size={18} className="text-accent" />
          <span className="flex-1 text-[13px]">
            {t(L('Известията в приложението са винаги включени.', 'In-app notices are always on.'))}
          </span>
        </div>
      </Group>

      {/* ------------------------------------------------------ reminders */}
      <Group
        title={t(L('Напомняния на устройството', 'Reminders on this device'))}
        hint={t(
          L(
            'Записът с час си има напомняне; то идва като истинско известие, дори когато приложението е зад друг прозорец. Проверката се прави тук, на устройството — нищо не пътува до сървър.',
            'An entry with a time carries a reminder, and it arrives as a real notification even when the app is behind another window. The checking happens here, on the device — nothing travels to a server.',
          ),
        )}
      >
        {permission === 'unsupported' ? (
          <p className="text-[12.5px] text-muted">
            {t(L('Този браузър не поддържа системни известия.', 'This browser does not support system notifications.'))}
          </p>
        ) : permission !== 'granted' ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="min-w-[200px] flex-1 text-[12.5px] text-muted">
              {permission === 'denied'
                ? t(L('Отказано е от браузъра. Разреши го от иконата до адреса.', 'Blocked by the browser — allow it from the icon next to the address bar.'))
                : t(L('Плаувия ще поиска разрешение от браузъра.', 'Plauvia will ask the browser for permission.'))}
            </span>
            <Button variant="primary" icon="bell" disabled={permission === 'denied'} onClick={() => void enable()}>
              {t(L('Включи напомнянията', 'Turn reminders on'))}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <Toggle
              checked={s.reminders.enabled}
              onChange={(v) => s.setReminders({ enabled: v })}
              label={t(L('Напомняния за записи с час', 'Remind me about entries with a time'))}
            />
            <Toggle
              checked={s.reminders.dueTimes}
              onChange={(v) => s.setReminders({ dueTimes: v })}
              disabled={!on}
              label={t(L('И за срокове, на които си сложил час', 'And for deadlines that carry an hour'))}
            />
            <Toggle
              checked={s.reminders.digest}
              onChange={(v) => s.setReminders({ digest: v })}
              disabled={!on}
              label={t(L('Вечерна проверка: какво остана за днес', 'Evening check: what is still open today'))}
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="t-label mb-1 block">{t(L('Час на вечерната проверка', 'Evening check at'))}</span>
                <input
                  type="time"
                  className="field t-num"
                  disabled={!on || !s.reminders.digest}
                  value={s.reminders.digestAt}
                  onChange={(e) => s.setReminders({ digestAt: e.target.value || '18:00' })}
                />
              </label>
              <label className="block">
                <span className="t-label mb-1 block">{t(L('Колко по-рано', 'How early'))}</span>
                <Select
                  value={String(s.reminders.lead)}
                  width={200}
                  options={[0, 5, 10, 15, 30, 60].map((m) => ({
                    value: String(m),
                    label: m === 0 ? t(L('Точно навреме', 'Right on time')) : t(L(`${m} мин по-рано`, `${m} min earlier`)),
                  }))}
                  onChange={(v) => s.setReminders({ lead: Number(v) })}
                />
              </label>
            </div>

            <div className="flex items-center gap-3">
              <span className="flex-1 text-[12px] text-faint">
                {t(
                  L(
                    'Известията се проверяват, докато разделът е отворен или приложението е инсталирано.',
                    'Reminders are checked while the tab is open or the app is installed.',
                  ),
                )}
              </span>
              <Button variant="outline" icon="bellRing" onClick={() => void testNotification()}>
                {t(L('Пробно известие', 'Send a test'))}
              </Button>
            </div>
          </div>
        )}
      </Group>

      <Group
        title={t(L('Фокус таймер', 'Focus timer'))}
        hint={t(L('Използва се само за края на фокус блок, докато разделът е отворен.', 'Used only when a focus block ends, while the tab is open.'))}
      >
        <Toggle
          checked={s.timer.notify}
          onChange={(v) => {
            if (v && permission !== 'granted') void enable();
            s.setTimer({ notify: v });
          }}
          disabled={permission === 'unsupported' || permission === 'denied'}
          label={t(L('Известие в края на блок', 'Notify when a block ends'))}
        />
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
          className="grid h-12 w-12 shrink-0 place-items-center rounded-[12px]"
          style={{ background: 'var(--c-accent-soft)', color: 'var(--c-accent)' }}
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

/** The dozen the profile picker offers; the onboarding offers the same set. */
const AVATARS = ['🦉', '🐨', '🦊', '🐼', '🐢', '🦁', '🐙', '🦄', '🐝', '🌿', '⚡️', '🚀'];

function completion(profile: Profile, learning: LearningProfile): { done: number; total: number } {
  const checks = [
    profile.name.trim().length > 0,
    profile.username.trim().length > 0,
    profile.avatar.length > 0 || profile.photo.length > 0,
    learning.interests.length > 0,
    learning.goals.length > 0,
    learning.styles.length > 0,
  ];
  return { done: checks.filter(Boolean).length, total: checks.length };
}

function ProfileSection() {
  const t = useT();
  const profile = useWorkspace((s) => s.profile);
  const learning = useWorkspace((s) => s.learning);
  const save = useWorkspace((s) => s.saveProfile);
  const [handle, setHandle] = useState(profile.username);
  const [handleMsg, setHandleMsg] = useState<string | null>(null);
  const { done, total } = completion(profile, learning);

  const commitHandle = () => {
    const value = handle.trim();
    if (!value) {
      setHandleMsg(null);
      void save({ username: '' });
      return;
    }
    const problem = validateUsername(value);
    setHandleMsg(problem);
    if (problem) return;
    const normalised = normaliseUsername(value);
    setHandle(normalised);
    void save({ username: normalised });
    void claimUsername(normalised).then((err) => setHandleMsg(err));
  };

  return (
    <Group title={t(S.profile)}>
      <div className="mb-4">
        <div className="flex items-baseline justify-between">
          <span className="text-[12.5px] text-muted">
            {t(L(`Профилът е попълнен ${done} от ${total}`, `Profile ${done} of ${total} filled in`))}
          </span>
          <span className="t-num text-[12px] text-faint">{Math.round((done / total) * 100)}%</span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--c-surface-3)' }}>
          <span
            className="block h-full rounded-full transition-[width]"
            style={{ width: `${(done / total) * 100}%`, background: 'var(--c-accent)' }}
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <ProfileAvatar size={56} />
        <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
          <input
            value={profile.name}
            onChange={(e) => void save({ name: e.target.value })}
            placeholder={t(L('Име', 'First name'))}
            autoComplete="given-name"
            className="field"
          />
          <input
            value={profile.lastName}
            onChange={(e) => void save({ lastName: e.target.value })}
            placeholder={t(L('Фамилия (по избор)', 'Last name (optional)'))}
            autoComplete="family-name"
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
            className="field"
          />
        </div>
      </div>

      <div className="mt-3">
        <span className="relative block">
          <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-faint">
            @
          </span>
          <input
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            onBlur={commitHandle}
            onKeyDown={(e) => e.key === 'Enter' && commitHandle()}
            placeholder={t(L('потребителско име (по избор)', 'username (optional)'))}
            autoComplete="username"
            spellCheck={false}
            className="field pl-7"
          />
        </span>
        <p className="mt-1.5 text-[11.5px] leading-relaxed" style={{ color: handleMsg ? 'var(--c-danger)' : 'var(--c-faint)' }}>
          {handleMsg ?? t(L('Запазва името за теб. Никъде още не се показва публично.', 'Reserves the name for you. Nothing shows it publicly yet.'))}
        </p>
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
