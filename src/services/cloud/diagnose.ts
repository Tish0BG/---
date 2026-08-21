import { FILES_BUCKET, RECORDS_TABLE, getClient } from './client';
import { cloudConfig, configSource, isSecretKey, SOURCE_LABEL } from './config';

/**
 * A connection self-test.
 *
 * "It doesn't work" is not something a student can act on, and neither is a
 * raw PostgREST error code. Each step here checks exactly one thing and, when
 * it fails, says what to click to fix it — so setting up the account is a
 * sequence of green ticks rather than a guessing game.
 */

export type CheckState = 'ok' | 'fail' | 'warn' | 'skip';

export interface CheckResult {
  id: string;
  label: string;
  state: CheckState;
  detail: string;
  /** what to do about it */
  fix?: string;
}

const timeout = (ms: number) => {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  return { signal: c.signal, done: () => clearTimeout(t) };
};

export async function diagnose(): Promise<CheckResult[]> {
  const out: CheckResult[] = [];
  const cfg = cloudConfig();
  const source = configSource();

  /* ------------------------------------------------------- 1. settings */

  if (!cfg) {
    out.push({
      id: 'config',
      label: 'Настройка',
      state: 'fail',
      detail: 'Приложението няма адрес и ключ за база.',
      fix: 'Попълни public/cloud.json с адреса и publishable ключа — файлът се качва както си е и не иска ново сглобяване.',
    });
    return out;
  }

  const host = cfg.url.replace(/^https?:\/\//, '');
  out.push({
    id: 'config',
    label: 'Настройка',
    state: isSecretKey(cfg.anonKey) ? 'fail' : 'ok',
    detail: isSecretKey(cfg.anonKey)
      ? 'Използва се ТАЕН ключ. Смени го веднага в Supabase.'
      : `${host} · ${SOURCE_LABEL[source]}`,
    fix: isSecretKey(cfg.anonKey)
      ? 'Браузърният код е видим за всички. Вземи „publishable“ ключа и завърти тайния в Supabase → API Keys.'
      : undefined,
  });

  /* -------------------------------------------------------- 2. project */

  try {
    const t = timeout(10000);
    const res = await fetch(`${cfg.url}/auth/v1/health`, {
      headers: { apikey: cfg.anonKey },
      signal: t.signal,
    });
    t.done();
    out.push({
      id: 'project',
      label: 'Проектът е достъпен',
      state: res.ok ? 'ok' : 'fail',
      detail: res.ok ? 'Supabase отговаря.' : `Отговори с ${res.status}.`,
      fix: res.ok ? undefined : 'Провери адреса — трябва да е точно този от Project Settings → API.',
    });
    if (!res.ok) return out;
  } catch {
    out.push({
      id: 'project',
      label: 'Проектът е достъпен',
      state: 'fail',
      detail: 'Няма отговор от този адрес.',
      fix: 'Провери интернета и адреса. Спрян ли е проектът в Supabase? Безплатните проекти заспиват след дълга пауза.',
    });
    return out;
  }

  const client = await getClient();
  if (!client) {
    out.push({ id: 'client', label: 'Клиент', state: 'fail', detail: 'Клиентът не се създаде.' });
    return out;
  }

  /* --------------------------------------------------------- 3. signed in */

  const { data: sessionData } = await client.auth.getSession();
  const session = sessionData.session;
  out.push({
    id: 'session',
    label: 'Влизане',
    state: session ? 'ok' : 'warn',
    detail: session ? `Влязъл си като ${session.user.email ?? session.user.id}.` : 'Още не си влязъл в профил.',
    fix: session ? undefined : 'Влез или се регистрирай — останалите проверки минават и без това.',
  });

  /* ----------------------------------------------------------- 4. table */

  const { error: tableError } = await client.from(RECORDS_TABLE).select('id').limit(1);
  if (tableError) {
    const message = tableError.message.toLowerCase();
    const missing =
      message.includes('does not exist') ||
      message.includes('schema cache') ||
      tableError.code === 'PGRST205' ||
      tableError.code === '42P01';
    out.push({
      id: 'table',
      label: 'Таблица records',
      state: 'fail',
      detail: missing ? 'Таблицата я няма.' : tableError.message,
      fix: missing
        ? 'Пусни SQL скрипта от този екран в Supabase → SQL Editor → New query → Run.'
        : 'Провери правилата (RLS) на таблицата.',
    });
  } else {
    out.push({
      id: 'table',
      label: 'Таблица records',
      state: 'ok',
      detail: 'Съществува и е достъпна.',
    });
  }

  /* ---------------------------------------------------------- 5. bucket */

  /**
   * Listing is useless here: Supabase answers `[]` with HTTP 200 for a bucket
   * that does not exist at all, so a listing check would always come back
   * green. The only honest test is to actually put a byte in and take it out
   * again — which needs a session, so without one this step says so instead
   * of guessing.
   */
  if (!session) {
    out.push({
      id: 'bucket',
      label: 'Хранилище library',
      state: 'skip',
      detail: 'Проверява се след влизане — дотогава Supabase не отговаря честно.',
    });
  } else {
    const path = `${session.user.id}/probe/.check`;
    const { error: uploadError } = await client.storage
      .from(FILES_BUCKET)
      .upload(path, new Blob([new Uint8Array([1])]), {
        upsert: true,
        contentType: 'application/octet-stream',
      });
    if (uploadError) {
      const missing = /not found|nosuchbucket/i.test(uploadError.message);
      out.push({
        id: 'bucket',
        label: 'Хранилище library',
        state: 'fail',
        detail: missing ? 'Кофата „library“ я няма.' : uploadError.message,
        fix: missing
          ? 'Supabase → Storage → New bucket → име „library“, остави го private. Бележките, картите и задачите се синхронизират и без нея; PDF-ите и картинките — не.'
          : 'Пусни SQL скрипта отново — правилата за storage.objects идват от него.',
      });
    } else {
      await client.storage.from(FILES_BUCKET).remove([path]);
      out.push({
        id: 'bucket',
        label: 'Хранилище library',
        state: 'ok',
        detail: 'Качването и триенето минаха.',
      });
    }
  }

  /* -------------------------------------------------- 6. e-mail policy */

  try {
    const t = timeout(10000);
    const res = await fetch(`${cfg.url}/auth/v1/settings`, {
      headers: { apikey: cfg.anonKey },
      signal: t.signal,
    });
    t.done();
    const settings = (await res.json()) as {
      disable_signup?: boolean;
      mailer_autoconfirm?: boolean;
      external?: { email?: boolean };
    };
    if (settings.disable_signup) {
      out.push({
        id: 'signup',
        label: 'Регистрация',
        state: 'fail',
        detail: 'Регистрацията е изключена за този проект.',
        fix: 'Supabase → Authentication → Sign In / Providers → включи Email.',
      });
    } else if (settings.mailer_autoconfirm === false) {
      out.push({
        id: 'signup',
        label: 'Регистрация',
        state: 'warn',
        detail: 'Иска се потвърждение по имейл: след регистрация не влизаш, докато не кликнеш линка в писмото.',
        fix: 'За личен профил е по-лесно да го изключиш: Supabase → Authentication → Sign In / Providers → Email → „Confirm email“ → изключено.',
      });
    } else {
      out.push({
        id: 'signup',
        label: 'Регистрация',
        state: 'ok',
        detail: 'Регистрацията влиза веднага, без писмо.',
      });
    }
  } catch {
    out.push({ id: 'signup', label: 'Регистрация', state: 'skip', detail: 'Не можа да се провери.' });
  }

  return out;
}

export const worstOf = (results: CheckResult[]): CheckState =>
  results.some((r) => r.state === 'fail') ? 'fail' : results.some((r) => r.state === 'warn') ? 'warn' : 'ok';
