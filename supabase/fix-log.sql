-- Поправка на журнала за влизания. Безопасно е за повторно пускане.
--
-- Диагностиката показа: тригерът съществува и е включен, auth.sessions има 8
-- реда, а журналът — нула. Разликата е в ролята. Таблицата auth.sessions е на
-- supabase_auth_admin, а тригерът се изпълнява в контекста на този, който
-- прави вписването — тоест GoTrue, работещ като supabase_auth_admin. Ако тази
-- роля няма право да ползва схемата public или да изпълни функцията, тригерът
-- пада тихо, защото функцията нарочно гълта грешките, за да не спре нечие
-- влизане.
--
-- Тук се дават точно тези права, и нищо повече.

-- 1. Функцията да не зависи от това кои колони има auth.sessions.
create or replace function public.on_auth_session_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v jsonb := to_jsonb(new);
begin
  insert into public.security_events (user_id, kind, user_agent, meta)
  values (
    (v->>'user_id')::uuid,
    'signin',
    v->>'user_agent',
    jsonb_strip_nulls(jsonb_build_object('aal', v->>'aal', 'ip', v->>'ip'))
  );
  return new;
exception when others then
  -- Журналът никога не бива да попречи на човек да влезе в профила си.
  return new;
end;
$$;

alter function public.on_auth_session_created() owner to postgres;

-- 2. Ролята, която вписва сесиите, трябва да може да стигне до функцията.
--    Само това — не ѝ се дава достъп до таблицата, защото функцията е
--    security definer и пише с правата на своя собственик.
grant usage on schema public to supabase_auth_admin;
grant execute on function public.on_auth_session_created() to supabase_auth_admin;

drop trigger if exists plauvia_log_signin on auth.sessions;
create trigger plauvia_log_signin
  after insert on auth.sessions
  for each row execute function public.on_auth_session_created();

-- 3. Приложението също може да отбележи влизане — резервен вариант, ако горното
--    пак не сработи. Второ „влизане“ в рамките на минута се пропуска, за да не
--    се получат по два реда, когато и тригерът работи.
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
  if p_kind not in (
    'signin', 'password_changed', 'mfa_enabled', 'mfa_disabled',
    'backup_code_used', 'backup_codes_generated', 'email_changed',
    'sessions_revoked', 'account_deleted'
  ) then
    raise exception 'unknown event kind';
  end if;

  if p_kind = 'signin' and exists (
    select 1 from public.security_events
     where user_id = auth.uid() and kind = 'signin' and at > now() - interval '1 minute'
  ) then
    return;
  end if;

  insert into public.security_events (user_id, kind, meta)
  values (auth.uid(), p_kind, p_meta);
end;
$$;

revoke all on function public.log_security_event(text, jsonb) from public, anon;
grant execute on function public.log_security_event(text, jsonb) to authenticated;

-- ─────────────────────────────────────────────────────── проверка ──
select 'тригер включен' as проверка,
       coalesce((select case tgenabled when 'O' then 'да' else 'не: ' || tgenabled end
                   from pg_trigger where tgname = 'plauvia_log_signin'), 'ЛИПСВА') as резултат
union all
select 'supabase_auth_admin може да я изпълни',
       case when has_function_privilege('supabase_auth_admin',
              'public.on_auth_session_created()', 'execute') then 'да' else 'НЕ' end
union all
select 'supabase_auth_admin вижда схемата public',
       case when has_schema_privilege('supabase_auth_admin', 'public', 'usage') then 'да' else 'НЕ' end
union all
select 'има колона user_agent',
       case when exists (select 1 from information_schema.columns
                          where table_schema='auth' and table_name='sessions' and column_name='user_agent')
            then 'да' else 'не (не пречи)' end
union all
select 'последна сесия', coalesce(max(created_at)::text, 'няма') from auth.sessions
union all
select 'редове в журнала', count(*)::text from public.security_events;
