-- Диагностика на журнала за влизания. Само чете — нищо не променя.
-- Пусни целия файл и прати резултата.

-- 1. Съществува ли тригерът?
select 'тригер' as проверка,
       coalesce((select tgenabled::text from pg_trigger where tgname = 'plauvia_log_signin'), 'ЛИПСВА') as резултат

union all
-- 2. Съществува ли функцията?
select 'функция',
       coalesce((select 'има' from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                  where n.nspname = 'public' and p.proname = 'on_auth_session_created' limit 1), 'ЛИПСВА')

union all
-- 3. Кои колони има auth.sessions? Тригерът чете user_agent и aal — ако някоя
--    я няма, функцията гърми тихо и нито един ред не се записва.
select 'колони в auth.sessions',
       string_agg(column_name, ', ' order by column_name)
  from information_schema.columns
 where table_schema = 'auth' and table_name = 'sessions'

union all
-- 4. Има ли изобщо записани събития?
select 'редове в security_events', count(*)::text from public.security_events

union all
-- 5. Има ли активни сесии — тоест влизал ли е някой изобщо?
select 'редове в auth.sessions', count(*)::text from auth.sessions

union all
-- 6. Кой е собственик на auth.sessions — ако не е ролята, с която пускаш SQL,
--    създаването на тригера може да е било отказано.
select 'собственик на auth.sessions',
       (select pg_get_userbyid(relowner) from pg_class where oid = 'auth.sessions'::regclass)

union all
select 'текуща роля', current_user;
