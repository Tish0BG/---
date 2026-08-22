import { useMemo } from 'react';
import { VIEW_TITLES, useApp } from '@/state/appStore';
import { useWorkspace } from '@/state/workspaceStore';
import { useLibrary } from '@/state/libraryStore';
import { useTimer, formatClock } from '@/state/timerStore';
import { useT, L, useLang, longDate } from '@/i18n';
import { S } from '@/i18n/strings';
import { Icon } from '../Icon';
import { Popover, MenuItem, MenuSep } from '../ui';
import { Button, IconButton, Tooltip, useIsPhone } from '../kit';
import { UtilityButton } from '../utilities/UtilityLayer';
import { ProfileMenu } from './ProfileMenu';
import { NoticeBell } from './NoticePanel';

/**
 * The header is the app's control surface: where you are, one field that
 * reaches everything, and the one button that makes something new. Everything
 * else in it is a status light, and status lights are small.
 */
export function AppHeader({ onMenu }: { onMenu?: () => void }) {
  const t = useT();
  const lang = useLang();
  const view = useApp((s) => s.view);
  const subjectId = useApp((s) => s.subjectId);
  const subject = useWorkspace((s) => s.subjects.find((x) => x.id === subjectId));
  const importing = useLibrary((s) => s.importing);
  const running = useTimer((s) => s.running);
  const left = useTimer((s) => s.left);
  const phone = useIsPhone();

  const today = useMemo(() => longDate(Date.now(), lang), [lang]);

  return (
    <header
      className="glass sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-line px-3 sm:px-4"
    >
      {onMenu && (
        <IconButton icon="menu" label={t(L('Меню', 'Menu'))} onClick={onMenu} className="lg:hidden" />
      )}

      {/* A label, not a heading: the screen below states its own <h1>, and two
          competing ones is how a page ends up with no clear heading at all. */}
      <div className="flex min-w-0 items-baseline gap-2.5">
        <span className="truncate text-[14.5px] font-semibold tracking-[-0.012em]">
          {subject ? subject.name : t(VIEW_TITLES[view])}
        </span>
        {view === 'dashboard' && !phone && (
          <span className="hidden truncate text-[12.5px] text-muted md:block">{today}</span>
        )}
      </div>

      {/* ------------------------------------------------------------ search */}
      <button
        onClick={() => useApp.getState().setPalette(true)}
        className="mx-auto hidden h-9 w-full max-w-[420px] cursor-pointer items-center gap-2 rounded-[10px] border border-line px-3 text-[13px] text-faint transition-all duration-150 hover:border-line-strong hover:bg-surface-2 sm:flex"
        style={{ background: 'var(--c-surface-2)' }}
      >
        <Icon name="search" size={15} />
        <span className="flex-1 truncate text-left">{t(L('Търси навсякъде…', 'Search everything…'))}</span>
        <kbd className="kbd">⌘K</kbd>
      </button>

      <div className="ml-auto flex shrink-0 items-center gap-1">
        {importing && (
          <span className="t-num hidden items-center gap-1.5 text-[11.5px] text-muted md:flex">
            <Icon name="refresh" size={13} className="animate-spin text-accent" />
            {importing.done + 1}/{importing.total}
          </span>
        )}

        {running && (
          <Tooltip label={t(L('Фокус сесия — отвори', 'Focus session — open'))}>
            <button
              onClick={() => useTimer.getState().setView('full')}
              className="t-num mr-1 hidden h-8 cursor-pointer items-center gap-1.5 rounded-full px-2.5 text-[12.5px] font-semibold sm:flex"
              style={{
                background: 'color-mix(in srgb, var(--c-timer-focus) 14%, transparent)',
                color: 'var(--c-timer-focus)',
              }}
            >
              <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: 'currentColor' }} />
              {formatClock(left)}
            </button>
          </Tooltip>
        )}

        <IconButton
          icon="search"
          label={t(S.search)}
          className="sm:hidden"
          onClick={() => useApp.getState().setPalette(true)}
        />

        <NewButton compact={phone} />
        <NoticeBell />
        {!phone && <UtilityButton compact />}
        <div className="mx-1 hidden h-6 w-px bg-line sm:block" />
        <ProfileMenu />
      </div>
    </header>
  );
}

/**
 * One button that makes anything. The menu is the same list the command
 * palette and the phone's plus button offer, so "how do I add a task" has a
 * single answer wherever you are.
 */
export function NewButton({ compact }: { compact?: boolean }) {
  const t = useT();
  return (
    <Popover
      width={216}
      align="end"
      trigger={({ toggle, ref }) =>
        compact ? (
          <button ref={ref} onClick={toggle} className="btn btn-primary h-8 w-8 p-0" aria-label={t(S.create)}>
            <Icon name="plus" size={17} strokeWidth={2.2} />
          </button>
        ) : (
          <Button ref={ref} variant="primary" icon="plus" onClick={toggle}>
            {t(L('Създай', 'New'))}
          </Button>
        )
      }
    >
      {(close) => (
        <>
          <MenuItem
            icon="listTodo"
            label={t(S.task)}
            shortcut="T"
            onClick={() => {
              useApp.getState().setQuick('task');
              close();
            }}
          />
          <MenuItem
            icon="graduation"
            label={t(S.exam)}
            shortcut="E"
            onClick={() => {
              useApp.getState().setQuick('exam');
              close();
            }}
          />
          <MenuItem
            icon="target"
            label={t(S.goal)}
            shortcut="G"
            onClick={() => {
              useApp.getState().setQuick('goal');
              close();
            }}
          />
          <MenuItem
            icon="calendar"
            label={t(L('Час в програмата', 'Timetable slot'))}
            onClick={() => {
              useApp.getState().setQuick('event');
              close();
            }}
          />
          <MenuSep />
          <MenuItem
            icon="timer"
            label={t(L('Започни фокус', 'Start focus'))}
            onClick={() => {
              useTimer.getState().setView('full');
              useTimer.getState().start();
              close();
            }}
          />
        </>
      )}
    </Popover>
  );
}
