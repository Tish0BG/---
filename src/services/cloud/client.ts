import type { SupabaseClient } from '@supabase/supabase-js';
import { cloudConfig } from './config';

/**
 * The Supabase client, created once per configuration and — importantly —
 * downloaded only when there is a configuration at all.
 *
 * The SDK is a sizeable chunk, and the app is fully usable with no account
 * whatsoever, so a student who never signs in should never fetch it. That is
 * why this is an async import rather than a plain one at the top of the file.
 */
let cached: { key: string; client: Promise<SupabaseClient> } | null = null;

export const RECORDS_TABLE = 'records';
export const FILES_BUCKET = 'library';

export type Client = SupabaseClient;

export function getClient(): Promise<SupabaseClient | null> {
  const cfg = cloudConfig();
  if (!cfg) return Promise.resolve(null);
  const key = `${cfg.url}|${cfg.anonKey}`;
  if (cached?.key !== key) {
    cached = {
      key,
      client: import('@supabase/supabase-js').then(({ createClient }) =>
        createClient(cfg.url, cfg.anonKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            // Deliberately unchanged: renaming the storage key would sign
            // every existing user out and orphan their local library.
            storageKey: 'studypdf.auth',
          },
          global: { headers: { 'x-application-name': 'plauvia' } },
        }),
      ),
    };
  }
  return cached.client;
}

/** Drops the cached client so a new configuration takes effect immediately. */
export function resetClient(): void {
  cached = null;
}

/**
 * Supabase speaks English; students do not. Everything shown to the user goes
 * through here so a failed login reads like a sentence, not like an API.
 */
export function humanError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? '');
  const m = raw.toLowerCase();
  if (!raw) return 'Нещо се обърка.';
  if (m.includes('invalid login credentials')) return 'Грешен имейл или парола.';
  if (m.includes('email not confirmed')) return 'Първо потвърди имейла си от писмото, което ти изпратихме.';
  if (m.includes('user already registered')) return 'Вече има профил с този имейл. Влез вместо това.';
  if (m.includes('password should be at least')) return 'Паролата трябва да е поне 8 знака.';
  if (m.includes('unable to validate email') || m.includes('invalid email')) return 'Имейлът не изглежда валиден.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Твърде много опити. Опитай пак след минута.';
  if (m.includes('failed to fetch') || m.includes('networkerror')) return 'Няма връзка със сървъра. Провери интернета.';
  if (
    (m.includes('relation') && m.includes('does not exist')) ||
    m.includes('schema cache') ||
    m.includes('pgrst205')
  ) {
    return 'Таблицата „records“ я няма. Пусни SQL скрипта от екрана за вход в Supabase → SQL Editor.';
  }
  if (m.includes('bucket not found') || m.includes('nosuchbucket')) {
    return 'Липсва хранилището „library“. Направи го от Supabase → Storage → New bucket (private).';
  }
  if (m.includes('row-level security') || m.includes('permission denied')) {
    return 'Достъпът е отказан. Провери правилата (RLS) в Supabase.';
  }
  if (m.includes('invalid api key') || m.includes('no api key')) {
    return 'Ключът не е приет. Вземи „publishable“ или „anon public“ ключа от Project Settings → API.';
  }
  if (m.includes('signups not allowed') || m.includes('signup is disabled')) {
    return 'Регистрацията е изключена за този проект (Authentication → Sign In / Providers).';
  }
  if (m.includes('auth session missing')) return 'Сесията изтече. Влез отново.';
  if (m.includes('for security purposes') || m.includes('only request this after')) {
    return 'Изчакай малко преди следващия опит — Supabase ограничава честотата на писмата.';
  }
  return raw;
}
