create table if not exists public.support_threads (
  id uuid primary key default gen_random_uuid(),
  personal_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'in_progress', 'closed')),
  subject text,
  summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  closed_at timestamptz,
  closed_by uuid references public.profiles(id) on delete set null
);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.support_threads(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  sender_role text not null check (sender_role in ('personal', 'owner')),
  message text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.support_attachments (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.support_threads(id) on delete cascade,
  uploaded_by uuid references public.profiles(id) on delete set null,
  file_name text not null,
  file_path text not null,
  file_url text not null,
  mime_type text,
  size_bytes bigint,
  retained_in_summary boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists support_threads_personal_status_idx
  on public.support_threads (personal_id, status, last_message_at desc);

create index if not exists support_threads_status_last_message_idx
  on public.support_threads (status, last_message_at desc);

create index if not exists support_messages_thread_created_idx
  on public.support_messages (thread_id, created_at asc);

create index if not exists support_attachments_thread_created_idx
  on public.support_attachments (thread_id, created_at asc);

alter table public.support_threads enable row level security;
alter table public.support_messages enable row level security;
alter table public.support_attachments enable row level security;

drop policy if exists "Owner manage support threads" on public.support_threads;
create policy "Owner manage support threads"
on public.support_threads
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'owner'
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'owner'
  )
);

drop policy if exists "Personal read own support threads" on public.support_threads;
create policy "Personal read own support threads"
on public.support_threads
for select
to authenticated
using (personal_id = auth.uid());

drop policy if exists "Personal create own support threads" on public.support_threads;
create policy "Personal create own support threads"
on public.support_threads
for insert
to authenticated
with check (
  personal_id = auth.uid()
  and status in ('open', 'in_progress')
);

drop policy if exists "Personal update own support threads" on public.support_threads;
create policy "Personal update own support threads"
on public.support_threads
for update
to authenticated
using (
  personal_id = auth.uid()
  and status in ('open', 'in_progress')
)
with check (personal_id = auth.uid());

drop policy if exists "Owner manage support messages" on public.support_messages;
create policy "Owner manage support messages"
on public.support_messages
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'owner'
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'owner'
  )
);

drop policy if exists "Personal read own support messages" on public.support_messages;
create policy "Personal read own support messages"
on public.support_messages
for select
to authenticated
using (
  exists (
    select 1
    from public.support_threads t
    where t.id = thread_id
      and t.personal_id = auth.uid()
  )
);

drop policy if exists "Personal insert own support messages" on public.support_messages;
create policy "Personal insert own support messages"
on public.support_messages
for insert
to authenticated
with check (
  sender_id = auth.uid()
  and sender_role = 'personal'
  and exists (
    select 1
    from public.support_threads t
    where t.id = thread_id
      and t.personal_id = auth.uid()
      and t.status in ('open', 'in_progress')
  )
);

drop policy if exists "Owner manage support attachments" on public.support_attachments;
create policy "Owner manage support attachments"
on public.support_attachments
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'owner'
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'owner'
  )
);

drop policy if exists "Personal read own support attachments" on public.support_attachments;
create policy "Personal read own support attachments"
on public.support_attachments
for select
to authenticated
using (
  exists (
    select 1
    from public.support_threads t
    where t.id = thread_id
      and t.personal_id = auth.uid()
  )
);

drop policy if exists "Personal insert own support attachments" on public.support_attachments;
create policy "Personal insert own support attachments"
on public.support_attachments
for insert
to authenticated
with check (
  uploaded_by = auth.uid()
  and exists (
    select 1
    from public.support_threads t
    where t.id = thread_id
      and t.personal_id = auth.uid()
      and t.status in ('open', 'in_progress')
  )
);
