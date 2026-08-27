import type { PlannerItem } from '@/types';
import { dayKey } from '@/lib/util';
import { useSettings } from '@/state/settingsStore';
import { usePlanner, startOfDay } from '@/state/plannerStore';
import { navigateTo, useApp } from '@/state/appStore';
import { notify } from '@/state/toastStore';
import { currentLang, type Msg } from '@/i18n';

/**
 * ───────────────────────────────────────────── notifications that arrive ──
 *
 * The notice panel inside the app is *derived* — a query over the records,
 * run when the panel opens. That is the right shape for a feed you go and
 * look at, and the wrong shape for a reminder, whose whole job is to reach
 * you when you are not looking.
 *
 * So this is the other half: a clock that ticks while the tab is alive, and
 * hands the operating system a notification when an entry's own time comes
 * round, or when the evening arrives with things still open. Nothing is
 * queued days in advance — a browser cannot promise to wake up — so what is
 * delivered is always checked against the records as they are right now, and
 * a reminder for something already ticked or deleted simply never fires.
 *
 * Everything here is silent until the person turns it on: `settings.reminders`
 * starts disabled, and the browser's permission prompt is asked for at the
 * moment the switch is flipped, never on arrival.
 */

const FIRED_KEY = 'plauvia.reminders.fired.v1';
/** How far past a reminder's time it is still worth delivering it. */
const GRACE = 60 * 60 * 1000;
const TICK = 30_000;

type FiredLog = Record<string, number>;

function loadFired(): FiredLog {
  try {
    const raw = localStorage.getItem(FIRED_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as FiredLog;
    const cutoff = Date.now() - 14 * 86_400_000;
    return Object.fromEntries(Object.entries(parsed).filter(([, at]) => at > cutoff));
  } catch {
    return {};
  }
}

let fired: FiredLog = loadFired();

function remember(key: string) {
  fired[key] = Date.now();
  try {
    localStorage.setItem(FIRED_KEY, JSON.stringify(fired));
  } catch {
    /* private mode: the log is a nicety, not a requirement */
  }
}

/* ------------------------------------------------------------ permission */

export type NotifyPermission = 'unsupported' | 'default' | 'granted' | 'denied';

export function notifyPermission(): NotifyPermission {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission as NotifyPermission;
}

/** Asks once. Returns what the browser decided, without throwing anywhere. */
export async function askPermission(): Promise<NotifyPermission> {
  if (typeof Notification === 'undefined') return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission as NotifyPermission;
  try {
    return (await Notification.requestPermission()) as NotifyPermission;
  } catch {
    return 'denied';
  }
}

/* -------------------------------------------------------------- delivery */

interface Delivery {
  /** dedupe key; one notification per key, ever */
  key: string;
  title: string;
  body: string;
  /** where clicking it lands */
  target?: string;
  targetId?: string;
  /**
   * "Consider this handled, but say nothing."
   *
   * The evening check with nothing left to say still has to be marked as
   * done, or it is re-evaluated every thirty seconds until midnight. Saying
   * so with a flag keeps `pendingDeliveries` a pure function of its inputs.
   */
  silent?: true;
}

const say = (msg: Msg): string => (currentLang() === 'en' ? msg.en : msg.bg);

async function deliver(n: Delivery): Promise<void> {
  if (notifyPermission() !== 'granted') return;
  const options: NotificationOptions = {
    body: n.body,
    icon: '/favicon-192.png',
    badge: '/favicon-96.png',
    tag: n.key,
    data: { target: n.target ?? 'plan', id: n.targetId ?? null },
  };

  // The service worker's notification survives the tab being closed and is
  // the only kind Android will show at all; the constructor is the fallback
  // for browsers without one registered.
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) {
      await reg.showNotification(n.title, options);
      return;
    }
  } catch {
    /* fall through to the plain constructor */
  }

  try {
    const note = new Notification(n.title, options);
    note.onclick = () => {
      window.focus();
      navigateTo(n.target ?? 'plan', n.targetId ?? undefined);
      note.close();
    };
  } catch {
    /* a browser that has the API but refuses the constructor: nothing to do */
  }
}

/* ------------------------------------------------------------ what is due */

const hhmm = (ts: number) =>
  new Date(ts).toLocaleTimeString(currentLang() === 'en' ? 'en-GB' : 'bg-BG', {
    hour: '2-digit',
    minute: '2-digit',
  });

/**
 * Everything that should be said right now, given the records and the clock.
 *
 * Pure and exported so the behaviour can be reasoned about — and tested —
 * without a browser, a permission or a timer.
 */
export function pendingDeliveries(input: {
  items: PlannerItem[];
  now: number;
  lead: number;
  digest: boolean;
  digestAt: string;
  dueTimes: boolean;
  fired: FiredLog;
}): Delivery[] {
  const { items, now, lead, digest, digestAt, dueTimes } = input;
  const out: Delivery[] = [];
  const seen = (key: string) => key in input.fired;

  for (const item of items) {
    if (item.done) continue;

    /* ------------------------------------------------ its own reminder */
    if (typeof item.remindAt === 'number') {
      const at = item.remindAt - lead * 60_000;
      const key = `rem:${item.id}:${item.remindAt}`;
      if (now >= at && now - at < GRACE && !seen(key)) {
        out.push({
          key,
          title: say({ bg: 'Напомняне', en: 'Reminder' }),
          body: item.time || item.due ? `${item.title} · ${hhmm(item.remindAt)}` : item.title,
          target: 'plan',
          targetId: item.id,
        });
      }
    }

    /* ------------------------------------- a deadline with an hour on it */
    if (dueTimes && item.due !== null && item.time) {
      const [h, m] = item.time.split(':').map(Number);
      const at = startOfDay(new Date(item.due)) + (h || 0) * 3_600_000 + (m || 0) * 60_000 - lead * 60_000;
      const key = `due:${item.id}:${item.due}:${item.time}`;
      if (now >= at && now - at < GRACE && !seen(key)) {
        out.push({
          key,
          title: say({ bg: `В ${item.time}`, en: `At ${item.time}` }),
          body: item.title,
          target: 'plan',
          targetId: item.id,
        });
      }
    }
  }

  /* ------------------------------------------------------- daily digest */
  if (digest) {
    const [h, m] = digestAt.split(':').map(Number);
    const at = startOfDay(new Date(now)) + (h || 0) * 3_600_000 + (m || 0) * 60_000;
    const key = `digest:${dayKey(now)}`;
    if (now >= at && now - at < GRACE && !seen(key)) {
      const today = items.filter(
        (i) => !i.done && i.due !== null && i.due >= startOfDay(new Date(now)) && i.due <= startOfDay(new Date(now)) + 86_399_999,
      );
      const late = items.filter((i) => !i.done && i.due !== null && i.due < startOfDay(new Date(now)));
      const open = today.length + late.length;
      if (open > 0) {
        const names = [...today, ...late].slice(0, 3).map((i) => i.title).join(', ');
        out.push({
          key,
          title: say(
            open === 1
              ? { bg: 'Едно нещо остана за днес', en: 'One thing is still open today' }
              : { bg: `${open} неща остават за днес`, en: `${open} things are still open today` },
          ),
          body: open > 3 ? `${names}…` : names,
          target: 'plan',
        });
      } else {
        out.push({ key, title: '', body: '', silent: true });
      }
    }
  }

  return out;
}

/* ------------------------------------------------------------------ tick */

async function tick(): Promise<void> {
  const { reminders } = useSettings.getState();
  if (!reminders.enabled || notifyPermission() !== 'granted') return;
  if (!usePlanner.getState().loaded) return;

  const due = pendingDeliveries({
    items: usePlanner.getState().items,
    now: Date.now(),
    lead: reminders.lead,
    digest: reminders.digest,
    digestAt: reminders.digestAt,
    dueTimes: reminders.dueTimes,
    fired,
  });

  for (const n of due) {
    remember(n.key);
    if (n.silent) continue;
    await deliver(n);
    // Stamping the record too means another device that syncs afterwards can
    // see the reminder was handled rather than repeating it in your pocket.
    const id = n.key.startsWith('rem:') ? n.key.split(':')[1] : null;
    if (id) void usePlanner.getState().updateItem(id, { remindedAt: Date.now() });
  }
}

/**
 * Starts the clock. Returns the way to stop it, so `App` can tear it down
 * with everything else it installs.
 */
export function installReminders(): () => void {
  const timer = window.setInterval(() => void tick(), TICK);

  // A laptop that was shut overnight wakes up with a stale interval and a
  // backlog; running the check the moment the tab is looked at again is what
  // makes a morning reminder arrive at breakfast rather than at lunch.
  const onVisible = () => {
    if (document.visibilityState === 'visible') void tick();
  };
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('focus', onVisible);

  const onMessage = (event: MessageEvent) => {
    const data = event.data as { type?: string; target?: string; id?: string } | null;
    if (data?.type === 'notification-click') navigateTo(data.target ?? 'plan', data.id ?? undefined);
  };
  navigator.serviceWorker?.addEventListener('message', onMessage);

  void tick();

  return () => {
    window.clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('focus', onVisible);
    navigator.serviceWorker?.removeEventListener('message', onMessage);
  };
}

/**
 * "Saved — but this device is on mute."
 *
 * Called wherever a reminder is set. Storing a time and then never ringing is
 * the worst of the three possible behaviours, and the moment somebody has
 * just asked to be reminded is the right moment to offer them the switch that
 * makes it happen. Silent when notifications are already on, so the ordinary
 * case says nothing at all.
 */
export function noteReminderSaved(): void {
  const { reminders } = useSettings.getState();
  if (reminders.enabled && notifyPermission() === 'granted') return;
  notify.push({
    tone: 'info',
    title: say({ bg: 'Напомнянето е записано', en: 'The reminder is saved' }),
    detail: say({
      bg: 'Известията на това устройство са изключени, така че то няма да звънне.',
      en: 'Notifications are off on this device, so it will not ring.',
    }),
    action: {
      label: say({ bg: 'Включи', en: 'Turn on' }),
      run: () => useApp.getState().setSettings(true, 'notifications'),
    },
    timeout: 8000,
  });
}

/** Fires one notification straight away, so the switch can prove itself. */
export async function testNotification(): Promise<void> {
  await deliver({
    key: `test:${Date.now()}`,
    title: say({ bg: 'Известията работят', en: 'Notifications are working' }),
    body: say({
      bg: 'Така ще изглежда напомнянето, когато дойде времето му.',
      en: 'This is how a reminder will look when its time comes.',
    }),
  });
}
