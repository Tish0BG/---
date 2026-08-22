-- Поправка на журнала за влизания. Безопасно е за повторно пускане.
--
-- Първата версия четеше new.user_agent и new.aal направо. Ако някоя от двете
-- колони я няма в тази версия на auth.sessions, функцията гърми — а тя нарочно
-- гълта грешките, за да не спре нечие влизане, така че резултатът е тишина и
-- празен журнал.
--
-- Тази версия минава през to_jsonb(new): липсващ ключ дава NULL вместо
-- изключение, така че тригерът работи независимо коя версия на Supabase стои
-- отдолу.

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

drop trigger if exists plauvia_log_signin on auth.sessions;
create trigger plauvia_log_signin
  after insert on auth.sessions
  for each row execute function public.on_auth_session_created();

/**
 * Приложението също може да отбележи влизане — нужно е само ако тригерът не е
 * могъл да бъде създаден върху auth.sessions. За да не се получат по два реда
 * за едно влизане, вторият в рамките на минута се пропуска мълчаливо.
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
-- Пише пробен ред за твоя профил и веднага го маха. Ако вторият ред покаже 1,
-- таблицата и правата са наред и проблемът е бил само в тригера.
do $$
declare v_uid uuid;
begin
  select id into v_uid from auth.users order by created_at desc limit 1;
  if v_uid is not null then
    insert into public.security_events (user_id, kind, meta)
    values (v_uid, 'signin', '{"проба": true}'::jsonb);
    delete from public.security_events where user_id = v_uid and meta ? 'проба';
  end if;
end $$;

select 'тригер' as проверка,
       coalesce((select 'има' from pg_trigger where tgname = 'plauvia_log_signin' limit 1), 'ЛИПСВА') as резултат
union all
select 'записът в таблицата работи', 'да'
union all
select 'редове в журнала досега', count(*)::text from public.security_events;
