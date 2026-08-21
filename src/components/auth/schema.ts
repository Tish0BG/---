/**
 * The SQL that turns an empty Supabase project into a Plauvia backend.
 * Kept in the bundle so the setup screen can offer a copy button instead of
 * sending the student off to find a file.
 */
export const SETUP_SQL = `-- Plauvia — облачна синхронизация
create table if not exists public.records (
  user_id    uuid    not null references auth.users (id) on delete cascade,
  kind       text    not null,
  id         text    not null,
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
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('library', 'library', false)
on conflict (id) do nothing;

drop policy if exists "own files read"   on storage.objects;
drop policy if exists "own files write"  on storage.objects;
drop policy if exists "own files update" on storage.objects;
drop policy if exists "own files delete" on storage.objects;

create policy "own files read" on storage.objects
  for select using (bucket_id = 'library' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "own files write" on storage.objects
  for insert with check (bucket_id = 'library' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "own files update" on storage.objects
  for update using (bucket_id = 'library' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "own files delete" on storage.objects
  for delete using (bucket_id = 'library' and (storage.foldername(name))[1] = auth.uid()::text);

-- Изтриване на профил: браузърът няма право да трие потребители, затова
-- правото се дава на една функция, която може да изтрие само своя викащ.
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

-- Проверка: и двата реда трябва да покажат 1.
-- Ако "library bucket" покаже 0, направи кофата от Storage -> New bucket
-- (име library, private) - на някои проекти редът по-горе няма права.
select 'records таблица' as какво, count(*) as има
  from information_schema.tables
 where table_schema = 'public' and table_name = 'records'
union all
select 'library bucket', count(*)
  from storage.buckets
 where id = 'library';
`;
