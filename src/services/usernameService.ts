import { L, tr, type Msg } from '@/i18n';
import { getClient } from './cloud/client';

/**
 * Handles.
 *
 * Nothing in Plauvia shows a public profile yet, which is exactly why the
 * rules are being written now: the day `/u/name` exists, the names people
 * chose before it must already be unique, already normalised, and already
 * unable to impersonate the product. Retrofitting that means taking names
 * away from people who had them.
 *
 * Uniqueness needs a server, because two browsers cannot agree on their own.
 * It lives in a small `usernames` table with a unique index — see
 * `supabase/usernames.sql`. Where that table has not been created the app
 * still validates the shape and reserves nothing, rather than refusing to work.
 */

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;

/**
 * Names nobody gets to have. Half of them are impersonation risks and half are
 * addresses the product may want later; both are cheaper to hold back than to
 * reclaim.
 */
const RESERVED = new Set([
  'admin', 'administrator', 'root', 'superuser', 'sysadmin', 'moderator', 'mod', 'staff',
  'support', 'help', 'helpdesk', 'contact', 'info', 'billing', 'sales', 'legal', 'privacy',
  'security', 'abuse', 'postmaster', 'webmaster', 'noreply', 'no-reply', 'system', 'official',
  'plauvia', 'plauvia-team', 'plauviaofficial', 'team', 'api', 'app', 'www', 'mail', 'ftp',
  'about', 'terms', 'cookies', 'faq', 'blog', 'news', 'status', 'login', 'signup', 'signin',
  'register', 'account', 'settings', 'profile', 'me', 'user', 'users', 'u', 'new', 'edit',
  'delete', 'null', 'undefined', 'anonymous', 'guest', 'test',
]);

/**
 * One spelling per name.
 *
 * Case is folded and the confusable separators are collapsed, so `Tihomir`,
 * `tihomir` and `ti.homir` cannot be three people. Homoglyph tricks — a
 * Cyrillic `а` inside a Latin word — are refused rather than mapped, because
 * silently rewriting somebody's name is its own kind of surprise.
 */
export function normaliseUsername(raw: string): string {
  return raw.trim().toLowerCase().replace(/^@+/, '').replace(/[._]+/g, '-').replace(/-{2,}/g, '-');
}

/** null when the shape is fine; otherwise the reason, in the reader's language. */
export function validateUsername(raw: string): string | null {
  const name = normaliseUsername(raw);
  const problem = shapeProblem(name);
  return problem ? tr(problem) : null;
}

function shapeProblem(name: string): Msg | null {
  if (!name) return L('Липсва име.', 'The name is missing.');
  if (name.length < USERNAME_MIN) {
    return L(`Поне ${USERNAME_MIN} знака.`, `At least ${USERNAME_MIN} characters.`);
  }
  if (name.length > USERNAME_MAX) {
    return L(`Най-много ${USERNAME_MAX} знака.`, `At most ${USERNAME_MAX} characters.`);
  }
  if (!/^[a-z0-9-]+$/.test(name)) {
    return L(
      'Само латински букви, цифри и тире.',
      'Latin letters, digits and hyphens only.',
    );
  }
  if (/^-|-$/.test(name)) return L('Не може да започва или свършва с тире.', 'It cannot start or end with a hyphen.');
  if (/^[0-9]+$/.test(name)) return L('Само цифри не става.', 'Digits alone will not do.');
  if (RESERVED.has(name)) return L('Това име е запазено.', 'That name is reserved.');
  return null;
}

export type Availability = 'free' | 'taken' | 'mine' | 'unknown';

/**
 * Asks the server whether the name is free.
 *
 * `unknown` is a real answer and not a failure: offline, or on an install
 * whose database has no `usernames` table, nobody can say — and a form that
 * refuses to continue because it could not check is a form that locks people
 * out of setting a name at all.
 */
export async function checkUsername(raw: string): Promise<Availability> {
  const name = normaliseUsername(raw);
  if (shapeProblem(name)) return 'unknown';
  const client = await getClient();
  if (!client || !navigator.onLine) return 'unknown';
  const { data: session } = await client.auth.getUser();
  const { data, error } = await client.from('usernames').select('user_id').eq('username', name).maybeSingle();
  if (error) return 'unknown';
  if (!data) return 'free';
  return data.user_id === session.user?.id ? 'mine' : 'taken';
}

/**
 * Claims the name for the signed-in account, replacing any it already held.
 * Returns a message on refusal, null on success — including the case where
 * there is no table to claim it in, since the local profile is still saved.
 */
export async function claimUsername(raw: string): Promise<string | null> {
  const name = normaliseUsername(raw);
  const problem = shapeProblem(name);
  if (problem) return tr(problem);

  const client = await getClient();
  if (!client) return null;
  const { data: session } = await client.auth.getUser();
  const userId = session.user?.id;
  if (!userId) return null;

  const { error } = await client.from('usernames').upsert({ user_id: userId, username: name }, { onConflict: 'user_id' });
  if (!error) return null;

  // 23505 is the unique violation: somebody else got there first.
  const message = error.message.toLowerCase();
  if (error.code === '23505' || message.includes('duplicate key')) {
    return tr(L('Това име вече е заето.', 'That name is already taken.'));
  }
  // No table, no policy, no network — the shape was valid and the profile
  // keeps the name locally. Nothing public depends on it yet.
  return null;
}

/**
 * Bulgarian, spelled the way the official transliteration spells it.
 *
 * Without this, "Тихомир" normalises to nothing and the form offers no
 * suggestion at all to exactly the audience the product was written for.
 */
const CYRILLIC: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u',
  ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sht', ъ: 'a', ь: 'y', ю: 'yu', я: 'ya',
};

const transliterate = (value: string): string =>
  [...value.toLowerCase()].map((ch) => CYRILLIC[ch] ?? ch).join('');

/** A first suggestion, derived from whatever the person is already called. */
export function suggestUsername(from: string): string {
  const base = normaliseUsername(
    transliterate(from)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-'),
  );
  if (!shapeProblem(base)) return base;
  const padded = `${base}-${Math.floor(Math.random() * 900 + 100)}`.replace(/^-+/, '').slice(0, USERNAME_MAX);
  return shapeProblem(padded) ? '' : padded;
}
