-- Schedule daily invocation of Edge Function send-student-bell-pushes (Expo push).
--
-- One-time setup after applying this migration: store the project service_role key in Vault.
-- Dashboard: Project Settings → Vault, or SQL Editor:
--   select vault.create_secret('<SERVICE_ROLE_KEY>', 'student_bell_pushes_cron_service_role');
-- Use the "service_role" JWT from Settings → API (not anon).

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

create or replace function public.invoke_send_student_bell_pushes_edge_function()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  service_role text;
  request_id bigint;
begin
  select ds.decrypted_secret
  into service_role
  from vault.decrypted_secrets ds
  where ds.name = 'student_bell_pushes_cron_service_role'
  limit 1;

  if service_role is null or btrim(service_role) = '' then
    raise warning
      'Vault secret student_bell_pushes_cron_service_role is missing; skipping send-student-bell-pushes invoke';
    return null;
  end if;

  select net.http_post(
    url := 'https://cdtouwfxwuhnlzqhcagy.supabase.co/functions/v1/send-student-bell-pushes',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role,
      'apikey', service_role
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 300000
  )
  into request_id;

  return request_id;
end;
$$;

comment on function public.invoke_send_student_bell_pushes_edge_function() is
  'pg_cron helper: POST send-student-bell-pushes. Requires vault secret student_bell_pushes_cron_service_role.';

revoke all on function public.invoke_send_student_bell_pushes_edge_function() from public;
grant execute on function public.invoke_send_student_bell_pushes_edge_function() to postgres;

do $$
declare
  jid bigint;
begin
  select j.jobid into jid from cron.job j where j.jobname = 'send_student_bell_pushes_daily';
  if jid is not null then
    perform cron.unschedule(jid);
  end if;
end;
$$;

-- Daily 10:00 UTC (~07:00 BRT). Adjust expression if needed.
select cron.schedule(
  'send_student_bell_pushes_daily',
  '0 */4 * * *',
  $$select public.invoke_send_student_bell_pushes_edge_function();$$
);
