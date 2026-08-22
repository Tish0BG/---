-- Plauvia — сигурност: журнал, резервни кодове, квоти, ограничаване
--
-- Пусни целия файл веднъж в Supabase → SQL Editor → New query → Run.
-- Безопасно е да се пуска повторно. Не пипа съществуващи данни.
--
-- Четирите неща тук съществуват, защото браузърът не може да ги гарантира сам:
-- запис, който потребителят не може да заличи; резервни кодове, чиито тайни
-- никога не напускат базата; таван за качените файлове; и ограничител, който
-- не се заобикаля с curl.

create extension if not exists pgcrypto with schema extensions;

-- ─────────────────────────────────────────────── журнал за сигурност ──
--
-- Показва се на самия потребител в Настройки → Сигурност: „влизане от ново
-- устройство“, „сменена парола“, „включена двуфакторна защита“. Затова е важно
-- КОЙ го пише. Ако редовете идваха от браузъра, всеки, който е влязъл в чужд
-- профил, би могъл просто да не изпрати реда за собственото си влизане.
-- Затова влизанията се пишат от тригер върху auth.sessions, а таблицата не
-- приема нищо направо от клиента.
create table if not exists public.security_events (
  id         bigint generated always as identity primary key,
  user_id    uuid        not null references auth.users (id) on delete cascade,
  -- 'signin' | 'password_changed' | 'mfa_enabled' | 'mfa_disabled'
  -- | 'backup_code_used' | 'email_changed' | 'sessions_revoked'
  kind       text        not null,
  at         timestamptz not null default now(),
  user_agent text,
  meta       jsonb
);

create index if not exists security_events_user_at_idx
  on public.security_events (user_id, at desc);

alter table public.security_events enable row level security;

-- Чете само своите. Никой не пише направо — редовете идват от функциите
-- по-долу, които се изпълняват с правата на собственика.
drop policy if exists "own security events" on public.security_events;
create policy "own security events" on public.security_events
  for select to authenticated using (auth.uid() = user_id);

revoke insert, update, delete on public.security_events from authenticated, anon;

/**
 * Записва събитие за текущия потребител. Викана от другите функции тук и от
 * приложението за нещата, които базата не вижда (смяна на парола минава през
 * GoTrue, не през Postgres).
 */
create or replace function public.log_security_event(p_kind text, p_meta jsonb default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;
  -- Затворен списък: иначе едно поле за свободен текст, писано от браузъра,
  -- се превръща в място, където някой пише каквото си иска в чужд екран.
  if p_kind not in (
    'signin', 'password_changed', 'mfa_enabled', 'mfa_disabled',
    'backup_code_used', 'backup_codes_generated', 'email_changed',
    'sessions_revoked', 'account_deleted'
  ) then
    raise exception 'unknown event kind';
  end if;

  insert into public.security_events (user_id, kind, meta)
  values (auth.uid(), p_kind, p_meta);
end;
$$;

revoke all on function public.log_security_event(text, jsonb) from public, anon;
grant execute on function public.log_security_event(text, jsonb) to authenticated;

/**
 * Всяко ново влизане оставя следа, независимо през коя врата е минало —
 * парола, Google или код по имейл. Тригерът вижда сесията в момента, в който
 * GoTrue я създава, така че нито един клиент не може да го пропусне.
 */
create or replace function public.on_auth_session_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.security_events (user_id, kind, user_agent, meta)
  values (new.user_id, 'signin', new.user_agent, jsonb_build_object('aal', new.aal));
  return new;
exception when others then
  -- Журналът никога не бива да попречи на човек да влезе в профила си.
  return new;
end;
$$;

drop trigger if exists plauvia_log_signin on auth.sessions;
create trigger plauvia_log_signin
  after insert on auth.sessions
  for each row execute function public.on_auth_session_created();

/** Чистене: журналът е за човека, не е архив. Пази последните 90 дни. */
create or replace function public.prune_security_events()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.security_events where at < now() - interval '90 days';
$$;

-- ───────────────────────────────────────────────── ограничаване ──
--
-- Ограничителят в браузъра казва на човека да изчака; този тук отказва на
-- този, който не пита. Важи за функциите в тази база — влизането минава през
-- GoTrue и има свои лимити в настройките на проекта.
create table if not exists public.rate_limits (
  subject      text        not null,
  action       text        not null,
  window_start timestamptz not null,
  hits         integer     not null default 0,
  primary key (subject, action, window_start)
);

alter table public.rate_limits enable row level security;
-- Никой клиент не чете и не пише тук направо.
revoke all on table public.rate_limits from authenticated, anon;

/**
 * Връща true, ако действието е позволено, и брои опита. Прозорецът е
 * плаващ на стъпки: по-евтино от точен плъзгащ прозорец и достатъчно
 * за целта.
 */
create or replace function public.rl_allow(
  p_action text,
  p_limit  integer,
  p_window interval default interval '1 hour'
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subject text := coalesce(auth.uid()::text, 'anon');
  v_secs    bigint := greatest(1, extract(epoch from p_window)::bigint);
  -- Кофи с фиксирана дължина: epoch, закръглен надолу до размера на прозореца.
  -- По-евтино от истински плъзгащ прозорец и напълно достатъчно, за да не
  -- може някой да върти функцията в цикъл.
  v_start   timestamptz := to_timestamp(floor(extract(epoch from now()) / v_secs) * v_secs);
  v_hits    integer;
begin
  insert into public.rate_limits (subject, action, window_start, hits)
  values (v_subject, p_action, v_start, 1)
  on conflict (subject, action, window_start)
    do update set hits = public.rate_limits.hits + 1
  returning hits into v_hits;

  -- Изчистване на старото, рядко и евтино.
  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;

  return v_hits <= p_limit;
end;
$$;

revoke all on function public.rl_allow(text, integer, interval) from public, anon;
grant execute on function public.rl_allow(text, integer, interval) to authenticated;

-- ─────────────────────────────────────────────── резервни кодове ──
--
-- За деня, в който телефонът с приложението за кодове го няма. Кодовете се
-- пазят хеширани — база, от която изтекат резервните кодове в четим вид, е
-- база, от която изтича втората половина на всяка двуфакторна защита.
--
-- Използването на код НЕ дава директно втора степен на достъп: то маха
-- двуфакторната защита, за да може човекът да влезе с паролата си и да я
-- настрои наново. Това е и по-честното поведение — след като си използвал
-- резервен код, второто устройство така или иначе го няма.
create table if not exists public.backup_codes (
  user_id    uuid        not null references auth.users (id) on delete cascade,
  code_hash  text        not null,
  used_at    timestamptz,
  created_at timestamptz not null default now(),
  primary key (user_id, code_hash)
);

alter table public.backup_codes enable row level security;
-- Нито четене, нито писане от клиента. Само през функциите.
revoke all on table public.backup_codes from authenticated, anon;

/** Колко неизползвани кода са останали — единственото, което клиентът вижда. */
create or replace function public.backup_codes_left()
returns integer
language sql
security definer
set search_path = public
as $$
  select count(*)::integer
    from public.backup_codes
   where user_id = auth.uid() and used_at is null;
$$;

revoke all on function public.backup_codes_left() from public, anon;
grant execute on function public.backup_codes_left() to authenticated;

/**
 * Издава десет нови кода и обезсилва старите. Връща ги в четим вид ровно
 * веднъж — това е единственият момент, в който съществуват извън хеша.
 */
create or replace function public.generate_backup_codes()
returns setof text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid  uuid := auth.uid();
  v_code text;
  i      integer;
begin
  if v_uid is null then
    raise exception 'not signed in';
  end if;
  if not public.rl_allow('backup_codes', 5, interval '1 hour') then
    raise exception 'too many attempts';
  end if;

  delete from public.backup_codes where user_id = v_uid;

  for i in 1..10 loop
    -- Азбука без 0/O/1/I/L: кодове се преписват на ръка от лист хартия.
    v_code := (
      select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789',
                               1 + floor(random() * 31)::int, 1), '')
        from generate_series(1, 10)
    );
    insert into public.backup_codes (user_id, code_hash)
    values (v_uid, extensions.crypt(v_code, extensions.gen_salt('bf', 8)));
    return next substr(v_code, 1, 5) || '-' || substr(v_code, 6, 5);
  end loop;

  insert into public.security_events (user_id, kind) values (v_uid, 'backup_codes_generated');
end;
$$;

revoke all on function public.generate_backup_codes() from public, anon;
grant execute on function public.generate_backup_codes() to authenticated;

/**
 * Проверява код и, ако е верен, сваля двуфакторната защита, за да може
 * човекът да влезе. Кодът се маркира като използван, дори когато е бил
 * последният.
 */
create or replace function public.use_backup_code(p_code text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions, auth
as $$
declare
  v_uid   uuid := auth.uid();
  v_clean text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  v_row   public.backup_codes%rowtype;
begin
  if v_uid is null then
    raise exception 'not signed in';
  end if;
  -- Този, който стигне дотук, вече знае паролата. Десет опита на час правят
  -- налучкването на десетзначен код безсмислено.
  if not public.rl_allow('use_backup_code', 10, interval '1 hour') then
    raise exception 'too many attempts';
  end if;

  for v_row in
    select * from public.backup_codes where user_id = v_uid and used_at is null
  loop
    if v_row.code_hash = extensions.crypt(v_clean, v_row.code_hash) then
      update public.backup_codes
         set used_at = now()
       where user_id = v_uid and code_hash = v_row.code_hash;

      -- Свалянето на фактора е това, което пуска човека вътре: сесията му вече
      -- е минала паролата, а без регистриран фактор от нея не се иска втора
      -- степен. Приложението после настоява да се настрои наново.
      delete from auth.mfa_factors where user_id = v_uid;

      insert into public.security_events (user_id, kind)
      values (v_uid, 'backup_code_used');
      return true;
    end if;
  end loop;

  return false;
end;
$$;

revoke all on function public.use_backup_code(text) from public, anon;
grant execute on function public.use_backup_code(text) to authenticated;

-- ──────────────────────────────────────────────────────── квоти ──
--
-- Без таван един профил може да качи толкова, колкото сметката издържи.
-- Границата се пази от базата, защото проверка в браузъра е молба, не правило.
create or replace function public.storage_bytes_used(p_uid uuid default auth.uid())
returns bigint
language sql
security definer
stable
set search_path = public, storage
as $$
  select coalesce(sum((metadata->>'size')::bigint), 0)
    from storage.objects
   where bucket_id = 'library'
     and (storage.foldername(name))[1] = p_uid::text;
$$;

revoke all on function public.storage_bytes_used(uuid) from public, anon;
grant execute on function public.storage_bytes_used(uuid) to authenticated;

/**
 * Таванът на един профил. Смени числото тук и важи веднага, без деплой.
 *
 * Първият множител е bigint нарочно: `2 * 1024 * 1024 * 1024` се смята като
 * 32-битово цяло и се препълва с точно единица, преди изобщо да стигне до
 * превръщането — а функция, която гърми, спира всяко качване, защото правилото
 * по-долу я вика.
 */
create or replace function public.storage_quota_bytes()
returns bigint
language sql
immutable
as $$ select 2::bigint * 1024 * 1024 * 1024; $$;  -- 2 GB

grant execute on function public.storage_quota_bytes() to authenticated, anon;

-- Качването се разрешава само ако профилът има място. Правилото заменя
-- предишното „own files write“ — то остава вярно, просто вече брои и обема.
drop policy if exists "own files write" on storage.objects;
create policy "own files write" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'library'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.storage_bytes_used(auth.uid()) < public.storage_quota_bytes()
  );

-- ───────────────────────────────────────────────────── проверка ──
-- И четирите реда трябва да покажат 1.
select 'security_events' as какво, count(*) as има
  from information_schema.tables where table_schema='public' and table_name='security_events'
union all
select 'backup_codes', count(*)
  from information_schema.tables where table_schema='public' and table_name='backup_codes'
union all
select 'rate_limits', count(*)
  from information_schema.tables where table_schema='public' and table_name='rate_limits'
union all
select 'тригер за влизане', count(*)
  from pg_trigger where tgname = 'plauvia_log_signin';
