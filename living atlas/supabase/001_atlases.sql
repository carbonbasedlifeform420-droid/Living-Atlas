-- Run in Supabase SQL Editor. The first release stores each user's atlas as a JSON document.
-- RLS restricts all operations to the authenticated owner.
create table if not exists public.atlases (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  document jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.atlases enable row level security;
revoke all on public.atlases from anon;
grant select, insert, update, delete on public.atlases to authenticated;
drop policy if exists "atlas owner select" on public.atlases;
drop policy if exists "atlas owner insert" on public.atlases;
drop policy if exists "atlas owner update" on public.atlases;
drop policy if exists "atlas owner delete" on public.atlases;
create policy "atlas owner select" on public.atlases for select to authenticated using ((select auth.uid()) = owner_id);
create policy "atlas owner insert" on public.atlases for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "atlas owner update" on public.atlases for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "atlas owner delete" on public.atlases for delete to authenticated using ((select auth.uid()) = owner_id);
