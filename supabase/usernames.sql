-- Plauvia — потребителски имена (по избор, добавя се без да пипа нищо старо)
--
-- Профилът работи и без тази таблица: приложението проверява формата, пази
-- името локално и просто не може да гарантира, че е уникално. Пусни този файл
-- в Supabase → SQL Editor, когато искаш имената да са наистина уникални —
-- което е задължително, преди публични профили да съществуват.
--
-- Безопасно е да се пуска повторно.

create table if not exists public.usernames (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  -- уникален индекс без оглед на регистъра; приложението и без това праща
  -- само малки букви, но базата не бива да разчита на това
  username   text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists usernames_unique_idx on public.usernames (lower(username));

alter table public.usernames enable row level security;

-- Всеки влязъл потребител може да провери дали едно име е свободно — иначе
-- формата не може да каже „заето“, преди да опита да го запише. Вижда се само
-- кой е собственикът, нищо друго.
drop policy if exists "usernames are readable" on public.usernames;
create policy "usernames are readable" on public.usernames
  for select
  to authenticated
  using (true);

-- Но пише само своя ред.
drop policy if exists "own username insert" on public.usernames;
create policy "own username insert" on public.usernames
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "own username update" on public.usernames;
create policy "own username update" on public.usernames
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own username delete" on public.usernames;
create policy "own username delete" on public.usernames
  for delete to authenticated using (auth.uid() = user_id);

-- Изтриването на профил трябва да отнесе и името. `on delete cascade` по-горе
-- се грижи за това, но функцията чисти изрично, за да не зависи от реда.
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
  delete from public.usernames where user_id = auth.uid();
  delete from public.records   where user_id = auth.uid();
  delete from auth.users       where id = auth.uid();
end;
$$;

revoke all on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;

-- Проверка: трябва да покаже 1.
select count(*) as "usernames таблица"
  from information_schema.tables
 where table_schema = 'public' and table_name = 'usernames';
