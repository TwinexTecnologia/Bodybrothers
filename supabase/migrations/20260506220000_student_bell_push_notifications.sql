create extension if not exists "uuid-ossp";

create table if not exists public.user_push_tokens (
  token text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  platform text not null check (platform in ('ios', 'android', 'web')),
  app_source text not null default 'student_mobile',
  last_seen_at timestamptz not null default now(),
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_push_tokens_user_id_idx
  on public.user_push_tokens (user_id);

create index if not exists user_push_tokens_active_idx
  on public.user_push_tokens (user_id, disabled_at);

alter table public.user_push_tokens enable row level security;

drop policy if exists "Users can read own push tokens" on public.user_push_tokens;
create policy "Users can read own push tokens"
  on public.user_push_tokens
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own push tokens" on public.user_push_tokens;
create policy "Users can insert own push tokens"
  on public.user_push_tokens
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own push tokens" on public.user_push_tokens;
create policy "Users can update own push tokens"
  on public.user_push_tokens
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own push tokens" on public.user_push_tokens;
create policy "Users can delete own push tokens"
  on public.user_push_tokens
  for delete
  using (auth.uid() = user_id);

create or replace function public.bump_user_push_tokens_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_push_tokens_set_updated_at on public.user_push_tokens;
create trigger user_push_tokens_set_updated_at
before update on public.user_push_tokens
for each row
execute procedure public.bump_user_push_tokens_updated_at();

create table if not exists public.push_notification_dispatches (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  notification_key text not null,
  delivery_date date not null,
  channel text not null default 'student_bell',
  payload jsonb not null default '{}'::jsonb,
  token_count integer not null default 0,
  expo_ticket_ids jsonb not null default '[]'::jsonb,
  status text not null default 'reserved' check (status in ('reserved', 'sent', 'error')),
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, notification_key, delivery_date)
);

create index if not exists push_notification_dispatches_user_id_idx
  on public.push_notification_dispatches (user_id, delivery_date desc);

alter table public.push_notification_dispatches enable row level security;

drop policy if exists "Users can read own push dispatches" on public.push_notification_dispatches;
create policy "Users can read own push dispatches"
  on public.push_notification_dispatches
  for select
  using (auth.uid() = user_id);
