/**
 * Where the account lives.
 *
 * The app is published as plain static files — often by dragging a folder onto
 * a host — so build-time environment variables are not always available. The
 * two Supabase values are public by design (the anon key only ever works
 * through row-level security), which is why they may also be pasted into the
 * settings screen at runtime and kept in localStorage.
 */
const KEY = 'studypdf.cloud.v1';

export interface CloudConfig {
  url: string;
  anonKey: string;
}

interface Env {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
}

const env = import.meta.env as unknown as Env;

function fromEnv(): CloudConfig | null {
  const url = env.VITE_SUPABASE_URL?.trim();
  const anonKey = env.VITE_SUPABASE_ANON_KEY?.trim();
  return url && anonKey ? { url: url.replace(/\/+$/, ''), anonKey } : null;
}

/** Where the current configuration came from, for the diagnostics screen. */
export type ConfigSource = 'env' | 'settings' | 'none';

export function configSource(): ConfigSource {
  if (fromEnv()) return 'env';
  if (fromStorage()) return 'settings';
  return 'none';
}

function fromStorage(): CloudConfig | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CloudConfig>;
    if (!parsed.url || !parsed.anonKey) return null;
    return { url: parsed.url.replace(/\/+$/, ''), anonKey: parsed.anonKey };
  } catch {
    return null;
  }
}

/** Build-time settings win; otherwise whatever was pasted into settings. */
export function cloudConfig(): CloudConfig | null {
  return fromEnv() ?? fromStorage();
}

export function isCloudConfigured(): boolean {
  return cloudConfig() !== null;
}

/** True when the values came from the build and cannot be changed here. */
export function isCloudFixed(): boolean {
  return fromEnv() !== null;
}

export function saveCloudConfig(cfg: CloudConfig | null): void {
  try {
    if (cfg) localStorage.setItem(KEY, JSON.stringify({ url: cfg.url.replace(/\/+$/, ''), anonKey: cfg.anonKey }));
    else localStorage.removeItem(KEY);
  } catch {
    /* private mode */
  }
}

/**
 * A key that must never reach a browser. Supabase's connect panel shows the
 * secret one right next to the publishable one, and pasting the wrong line
 * would hand every visitor full access to the database — worth catching
 * before the first request, not after.
 */
export function isSecretKey(key: string): boolean {
  const k = key.trim();
  if (k.startsWith('sb_secret_')) return true;
  if (/service_role/i.test(k)) return true;
  // legacy service-role keys are JWTs whose payload names the role
  const payload = k.split('.')[1];
  if (payload) {
    try {
      return /service_role/i.test(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    } catch {
      return false;
    }
  }
  return false;
}

/** Cheap sanity check before we bother the network. */
export function validateConfig(url: string, key: string): string | null {
  const u = url.trim();
  const k = key.trim();
  if (!/^https?:\/\/[^\s]+$/i.test(u)) {
    return 'Адресът трябва да изглежда като https://xxxxx.supabase.co';
  }
  if (!k) return 'Липсва ключ.';
  if (isSecretKey(k)) {
    return 'Това е тайният ключ (secret / service_role). Той никога не бива да влиза в браузърно приложение — вземи „publishable“ или „anon public“ ключа.';
  }
  if (k.length < 20) return 'Ключът изглежда непълен.';
  if (!k.startsWith('sb_publishable_') && !k.startsWith('eyJ')) {
    return 'Ключът трябва да започва с „sb_publishable_“ или с „eyJ“.';
  }
  return null;
}
