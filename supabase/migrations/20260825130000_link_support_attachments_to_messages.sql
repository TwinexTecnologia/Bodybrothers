alter table public.support_attachments
add column if not exists message_id uuid references public.support_messages(id) on delete set null;

create index if not exists support_attachments_message_idx
  on public.support_attachments (message_id, created_at asc);
