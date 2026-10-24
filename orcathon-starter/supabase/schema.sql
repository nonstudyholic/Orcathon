-- Run this once in Supabase: SQL Editor -> New query -> Run.

create table if not exists public.items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 200),
  description text,
  category    text not null default 'general',
  status      text not null default 'todo',
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists items_user_created_idx
  on public.items (user_id, created_at desc);

-- Row Level Security: every user can only touch their own rows.
alter table public.items enable row level security;

drop policy if exists "items_select_own" on public.items;
drop policy if exists "items_insert_own" on public.items;
drop policy if exists "items_update_own" on public.items;
drop policy if exists "items_delete_own" on public.items;

create policy "items_select_own" on public.items
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "items_insert_own" on public.items
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "items_update_own" on public.items
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "items_delete_own" on public.items
  for delete to authenticated
  using ((select auth.uid()) = user_id);
