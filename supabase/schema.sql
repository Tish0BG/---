-- StudyDesk — облачна синхронизация
-- Пусни целия файл веднъж в Supabase → SQL Editor → New query → Run.
-- Безопасно е да се пуска повторно.

-- ─────────────────────────────────────────────────────────────── записи ──
-- Всичко (документи, бележки, карти, задачи, оценки, профил) е един ред:
-- плосък JSON с updated_at. Затова сливането на две устройства е просто
-- „по-новият запис печели“ и не иска никаква логика на сървъра.
create table if not exists public.records (
  user_id    uuid    not null references auth.users (id) on delete cascade,
  kind       text    not null,
  id         text    not null,
  -- документът, към който принадлежи редът; позволява изтриването на
  -- учебник да отнесе бележките му с една заявка
  doc_id     text,
  updated_at bigint  not null,
  deleted    boolean not null default false,
  data       jsonb,
  primary key (user_id, kind, id)
);

create index if not exists records_user_updated_idx on public.records (user_id, updated_at);
create index if not exists records_user_doc_idx     on public.records (user_id, doc_id);

alter table public.records enable row level security;

drop policy if exists "records are private" on public.records;
create policy "records are private" on public.records
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ───────────────────────────────────────────────────────────── файлове ──
-- PDF-ите и изрязаните картинки са твърде големи за таблица и живеят в
-- Storage, в папка на името на потребителя.
insert into storage.buckets (id, name, public)
values ('library', 'library', false)
on conflict (id) do nothing;

drop policy if exists "own files read"   on storage.objects;
drop policy if exists "own files write"  on storage.objects;
drop policy if exists "own files update" on storage.objects;
drop policy if exists "own files delete" on storage.objects;

create policy "own files read" on storage.objects
  for select using (
    bucket_id = 'library' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "own files write" on storage.objects
  for insert with check (
    bucket_id = 'library' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "own files update" on storage.objects
  for update using (
    bucket_id = 'library' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "own files delete" on storage.objects
  for delete using (
    bucket_id = 'library' and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ─────────────────────────────────────────── изтриване на профил ──
-- Браузърът няма право да трие потребители — това иска таен ключ, който
-- никога не бива да стига до него. Затова правото се дава на една-единствена
-- функция, която може да изтрие само този, който я вика.
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  delete from public.records where user_id = auth.uid();
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;

-- ───────────────────────────────────────────────────────── проверка ──
-- Пусни и това: и двата реда трябва да покажат 1.
-- Ако „library bucket“ покаже 0, направи кофата от Storage → New bucket
-- (име library, private) — на някои проекти редът по-горе няма права.
select 'records таблица' as какво, count(*) as има
  from information_schema.tables
 where table_schema = 'public' and table_name = 'records'
union all
select 'library bucket', count(*)
  from storage.buckets
 where id = 'library';
