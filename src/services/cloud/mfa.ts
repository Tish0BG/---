import { getClient, humanError } from './client';
import { L, tr } from '@/i18n';

/**
 * Two-factor authentication, backup codes, and the log of what happened to an
 * account.
 *
 * The second factor is a code from an authenticator app rather than a text
 * message. That is not a compromise: an SMS costs money per person, arrives
 * late or not at all abroad, and is the one factor that can be taken from
 * somebody by talking their mobile operator into moving a number. A code
 * generated on the device costs nothing and cannot be intercepted in transit,
 * because it never travels.
 */

export interface Factor {
  id: string;
  friendlyName: string | null;
  /** 'verified' once the person has proved the app is set up */
  status: string;
}

export interface EnrolStart {
  factorId: string;
  /** the QR image, as a data: URI — scanned by the authenticator app */
  qr: string;
  /** the same secret in text, for someone typing it in by hand */
  secret: string;
}

export type Assurance = 'aal1' | 'aal2' | null;

/* ------------------------------------------------------------- factors */

export async function listFactors(): Promise<Factor[]> {
  const client = await getClient();
  if (!client) return [];
  const { data, error } = await client.auth.mfa.listFactors();
  if (error || !data) return [];
  return (data.totp ?? []).map((f) => ({
    id: f.id,
    friendlyName: f.friendly_name ?? null,
    status: f.status,
  }));
}

/** What the current session has proved, and what it would need to prove. */
export async function assurance(): Promise<{ current: Assurance; next: Assurance }> {
  const client = await getClient();
  if (!client) return { current: null, next: null };
  const { data } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
  return {
    current: (data?.currentLevel as Assurance) ?? null,
    next: (data?.nextLevel as Assurance) ?? null,
  };
}

/** True while a signed-in session still owes a second factor before it is trusted. */
export async function needsChallenge(): Promise<boolean> {
  const { current, next } = await assurance();
  return current === 'aal1' && next === 'aal2';
}

/* ------------------------------------------------------------ enrolling */

/**
 * Starts setting up an authenticator app. Nothing is switched on until
 * `confirmEnrol` proves the app is producing the right codes — otherwise it is
 * possible to lock yourself out of your own account with a typo.
 */
export async function startEnrol(): Promise<EnrolStart | string> {
  const client = await getClient();
  if (!client) return tr(L('Облакът не е настроен.', 'The cloud is not configured.'));

  // A half-finished attempt from a previous visit would otherwise collide with
  // this one; Supabase refuses a second unverified factor.
  for (const factor of await listFactors()) {
    if (factor.status !== 'verified') await client.auth.mfa.unenroll({ factorId: factor.id });
  }

  const { data, error } = await client.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: `Plauvia · ${new Date().toISOString().slice(0, 10)}`,
  });
  if (error || !data) return humanError(error);
  return { factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret };
}

/** Finishes setup by checking a code the app has just produced. */
export async function confirmEnrol(factorId: string, code: string): Promise<string | null> {
  const client = await getClient();
  if (!client) return tr(L('Облакът не е настроен.', 'The cloud is not configured.'));

  const { data: challenge, error: challengeError } = await client.auth.mfa.challenge({ factorId });
  if (challengeError || !challenge) return humanError(challengeError);

  const { error } = await client.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code: clean(code),
  });
  if (error) return wrongCode(error);

  await logEvent('mfa_enabled');
  return null;
}

/** Turns the second factor off. The password alone is enough again afterwards. */
export async function disableMfa(): Promise<string | null> {
  const client = await getClient();
  if (!client) return tr(L('Облакът не е настроен.', 'The cloud is not configured.'));
  for (const factor of await listFactors()) {
    const { error } = await client.auth.mfa.unenroll({ factorId: factor.id });
    if (error) return humanError(error);
  }
  await logEvent('mfa_disabled');
  return null;
}

/* ----------------------------------------------------------- challenge */

/** The code asked for at sign-in, once an authenticator app is set up. */
export async function submitChallenge(code: string): Promise<string | null> {
  const client = await getClient();
  if (!client) return tr(L('Облакът не е настроен.', 'The cloud is not configured.'));

  const factors = await listFactors();
  const factor = factors.find((f) => f.status === 'verified') ?? factors[0];
  if (!factor) return tr(L('Няма настроена двуфакторна защита.', 'No second factor is set up.'));

  const { data: challenge, error: challengeError } = await client.auth.mfa.challenge({
    factorId: factor.id,
  });
  if (challengeError || !challenge) return humanError(challengeError);

  const { error } = await client.auth.mfa.verify({
    factorId: factor.id,
    challengeId: challenge.id,
    code: clean(code),
  });
  return error ? wrongCode(error) : null;
}

/* --------------------------------------------------------- backup codes */

/**
 * Ten new codes, shown once and never again — what is kept is a hash, so a
 * database that leaks does not hand over the other half of everybody's
 * two-factor protection. Generating a new set voids the old one.
 */
export async function generateBackupCodes(): Promise<string[] | string> {
  const client = await getClient();
  if (!client) return tr(L('Облакът не е настроен.', 'The cloud is not configured.'));
  const { data, error } = await client.rpc('generate_backup_codes');
  if (error) return rpcError(error);
  return (data as string[]) ?? [];
}

export async function backupCodesLeft(): Promise<number> {
  const client = await getClient();
  if (!client) return 0;
  const { data, error } = await client.rpc('backup_codes_left');
  return error ? 0 : ((data as number) ?? 0);
}

/**
 * The way back in when the phone with the authenticator app is gone.
 *
 * A correct code does not grant the second factor — it removes it, so the
 * password alone gets the person in and they are asked to set the app up
 * again. That matches what has actually happened: the second device is lost.
 */
export async function useBackupCode(code: string): Promise<boolean | string> {
  const client = await getClient();
  if (!client) return tr(L('Облакът не е настроен.', 'The cloud is not configured.'));
  const { data, error } = await client.rpc('use_backup_code', { p_code: code });
  if (error) return rpcError(error);
  if (!data) return tr(L('Кодът не е разпознат.', 'That code was not recognised.'));
  // The session already passed the password; with the factor gone it is whole.
  await client.auth.refreshSession();
  return true;
}

/* ------------------------------------------------------------ the log */

export interface SecurityEvent {
  id: number;
  kind: string;
  at: string;
  userAgent: string | null;
}

export async function securityLog(limit = 20): Promise<SecurityEvent[]> {
  const client = await getClient();
  if (!client) return [];
  const { data, error } = await client
    .from('security_events')
    .select('id, kind, at, user_agent')
    .order('at', { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data.map((row) => ({
    id: row.id as number,
    kind: row.kind as string,
    at: row.at as string,
    userAgent: (row.user_agent as string | null) ?? null,
  }));
}

/**
 * Records something the database cannot see for itself — a password change
 * goes through the auth service, not through Postgres. Sign-ins are not logged
 * from here: those come from a trigger, precisely so that nobody signed into
 * somebody else's account can decline to mention it.
 */
export async function logEvent(kind: string, meta?: Record<string, unknown>): Promise<void> {
  const client = await getClient();
  if (!client) return;
  await client.rpc('log_security_event', { p_kind: kind, p_meta: meta ?? null });
}

/* ---------------------------------------------------------------- bits */

/** People paste codes with spaces in them, and read "0" where the app shows "O". */
const clean = (code: string): string => code.replace(/\s+/g, '').trim();

function wrongCode(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? '');
  if (/invalid|incorrect|not valid/i.test(raw)) {
    return tr(
      L(
        'Кодът не съвпада. Провери дали часовникът на телефона е точен — кодовете зависят от него.',
        'That code does not match. Check the clock on your phone — the codes depend on it.',
      ),
    );
  }
  return humanError(err);
}

/** Postgres exceptions arrive as a message; the two we raise deserve sentences. */
function rpcError(err: { message?: string } | null): string {
  const raw = err?.message ?? '';
  if (/too many attempts/i.test(raw)) {
    return tr(L('Твърде много опити. Опитай пак по-късно.', 'Too many attempts. Try again later.'));
  }
  if (/not signed in/i.test(raw)) {
    return tr(L('Сесията изтече. Влез отново.', 'The session has expired. Sign in again.'));
  }
  if (/function .* does not exist|schema cache/i.test(raw)) {
    return tr(
      L(
        'Тази част още не е инсталирана в базата. Пусни supabase/security.sql.',
        'This part is not installed in the database yet. Run supabase/security.sql.',
      ),
    );
  }
  return humanError(new Error(raw));
}
