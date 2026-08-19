-- Capsule — Supabase schema
-- Run this in your Supabase project's SQL editor (Dashboard → SQL Editor → New query).
-- Row-level security ensures every user can only ever read/write their own data.

create table if not exists public.entries (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  type text not null check (type in ('journal', 'recall')),
  recall_of uuid,
  date timestamptz not null,
  text text not null,
  metrics jsonb,
  recall_comparison jsonb,
  photo_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.entries enable row level security;

create policy "users manage own entries"
  on public.entries for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists entries_user_date on public.entries (user_id, date);

create table if not exists public.activity_log (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  date timestamptz not null,
  kind text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.activity_log enable row level security;

create policy "users manage own activity"
  on public.activity_log for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Private photo storage. Each user's photos live under a folder named
-- with their user id; policies key off that first path segment.
insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;

create policy "users read own photos"
  on storage.objects for select
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "users upload own photos"
  on storage.objects for insert
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "users update own photos"
  on storage.objects for update
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "users delete own photos"
  on storage.objects for delete
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- Deletion audit trail.
--
-- Deliberately has NO foreign key to auth.users: a cascade would erase the
-- very record that proves the deletion happened. It stores a one-way hash
-- rather than the user id, so it can confirm "this account was deleted"
-- without retaining an identifier pointing back at a real person.
create table if not exists public.deletion_audit (
  id bigserial primary key,
  user_hash text not null,
  deleted_at timestamptz not null default now(),
  photos_removed integer not null default 0
);

-- RLS on with NO policy: denies every browser-side role outright. Only the
-- Edge Function's service_role key (which bypasses RLS) can write here, and
-- nothing can read it through the public API at all.
alter table public.deletion_audit enable row level security;

create index if not exists deletion_audit_hash on public.deletion_audit (user_hash);
