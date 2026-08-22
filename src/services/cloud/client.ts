import type { SupabaseClient } from '@supabase/supabase-js';
import { cloudConfig } from './config';
import { L, tr, type Msg } from '@/i18n';

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
 * Supabase speaks English; students do not — and half of them are reading the
 * app in Bulgarian.
 *
 * Everything shown to a person goes through here so a failed sign-in reads
 * like a sentence in the language they chose, not like an API in one they did
 * not. Two of these are deliberately vaguer than the underlying error: whether
 * an address already has an account is not something a stranger gets to find
 * out by typing it into a form.
 */
export function humanError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? '');
  const m = raw.toLowerCase();
  if (!raw) return tr(L('Нещо се обърка.', 'Something went wrong.'));

  for (const [test, message] of MESSAGES) {
    if (test(m)) return tr(message);
  }
  // Anything unrecognised is shown as-is: a mangled English sentence is still
  // more use in a bug report than "something went wrong".
  return raw;
}

const MESSAGES: [(m: string) => boolean, Msg][] = [
  [
    (m) => m.includes('invalid login credentials'),
    L('Грешен имейл или парола.', 'That e-mail and password do not match.'),
  ],
  [
    (m) => m.includes('email not confirmed'),
    L(
      'Първо потвърди имейла си от писмото, което ти изпратихме.',
      'Confirm your e-mail first, from the message we sent you.',
    ),
  ],
  [
    // Deliberately not "this e-mail is taken": that turns the sign-up form
    // into a way of checking who has an account here.
    (m) => m.includes('user already registered') || m.includes('already been registered'),
    L(
      'Не успяхме да създадем профил с този имейл. Ако вече имаш профил, влез или поискай нова парола.',
      'We could not create an account with that e-mail. If you already have one, sign in or ask for a new password.',
    ),
  ],
  [
    (m) => m.includes('password should be at least') || m.includes('password is too short'),
    L('Паролата трябва да е поне 8 знака.', 'The password must be at least 8 characters.'),
  ],
  [
    (m) => m.includes('password') && m.includes('compromised'),
    L(
      'Тази парола е попадала в изтичане на данни. Избери друга.',
      'That password has appeared in a data breach. Pick a different one.',
    ),
  ],
  [
    (m) => m.includes('unable to validate email') || m.includes('invalid email'),
    L('Имейлът не изглежда валиден.', 'That e-mail does not look valid.'),
  ],
  [
    (m) => m.includes('rate limit') || m.includes('too many'),
    L('Твърде много опити. Опитай пак след минута.', 'Too many attempts. Try again in a minute.'),
  ],
  [
    (m) => m.includes('failed to fetch') || m.includes('networkerror') || m.includes('load failed'),
    L('Няма връзка със сървъра. Провери интернета.', 'No connection to the server. Check your internet.'),
  ],
  [
    (m) => (m.includes('relation') && m.includes('does not exist')) || m.includes('schema cache') || m.includes('pgrst205'),
    L(
      'Таблицата „records“ я няма. Пусни SQL скрипта от екрана за вход в Supabase → SQL Editor.',
      'The "records" table is missing. Run the SQL script from the sign-in screen in Supabase → SQL Editor.',
    ),
  ],
  [
    (m) => m.includes('bucket not found') || m.includes('nosuchbucket'),
    L(
      'Липсва хранилището „library“. Направи го от Supabase → Storage → New bucket (private).',
      'The "library" bucket is missing. Create it in Supabase → Storage → New bucket (private).',
    ),
  ],
  [
    (m) => m.includes('row-level security') || m.includes('permission denied'),
    L('Достъпът е отказан. Провери правилата (RLS) в Supabase.', 'Access denied. Check the row-level security rules in Supabase.'),
  ],
  [
    (m) => m.includes('invalid api key') || m.includes('no api key'),
    L(
      'Ключът не е приет. Вземи „publishable“ или „anon public“ ключа от Project Settings → API.',
      'The key was refused. Take the "publishable" or "anon public" key from Project Settings → API.',
    ),
  ],
  [
    (m) => m.includes('signups not allowed') || m.includes('signup is disabled'),
    L(
      'Регистрацията е изключена за този проект (Authentication → Sign In / Providers).',
      'Sign-up is switched off for this project (Authentication → Sign In / Providers).',
    ),
  ],
  [
    (m) => m.includes('provider is not enabled') || m.includes('unsupported provider'),
    L(
      'Влизането с Google не е включено за този проект (Authentication → Providers).',
      'Google sign-in is not enabled for this project (Authentication → Providers).',
    ),
  ],
  [
    (m) => m.includes('auth session missing') || m.includes('session_not_found'),
    L('Сесията изтече. Влез отново.', 'The session has expired. Sign in again.'),
  ],
  [
    (m) => m.includes('for security purposes') || m.includes('only request this after'),
    L(
      'Изчакай малко преди следващия опит — Supabase ограничава честотата на писмата.',
      'Wait a moment before trying again — the mail rate limit is doing its job.',
    ),
  ],
  [
    (m) => m.includes('new password should be different'),
    L('Новата парола трябва да е различна от старата.', 'The new password has to differ from the old one.'),
  ],
];
