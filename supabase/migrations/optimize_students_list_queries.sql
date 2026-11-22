create index if not exists idx_profiles_students_list_personal
on public.profiles (personal_id, role, full_name);

create index if not exists idx_protocols_students_list_lookup
on public.protocols (personal_id, type, status, student_id, created_at desc);

create index if not exists idx_debits_recent_paid_lookup
on public.debits (receiver_id, status, paid_at desc, payer_id);

create or replace view public.personal_students_list_view as
select
  p.id,
  p.personal_id,
  p.full_name,
  p.email,
  p.created_at,
  coalesce(p.data->>'status', 'ativo') as status,
  p.data->>'last_app_access_at' as last_access,
  p.data->'address' as address,
  coalesce(p.plan_id, nullif(p.data->>'planId', '')::uuid) as plan_id,
  nullif(p.data->>'planStartDate', '')::date as plan_start_date,
  case
    when jsonb_typeof(p.data->'dietIds') = 'array' then p.data->'dietIds'
    else '[]'::jsonb
  end as diet_ids,
  p.data->>'avatarUrl' as avatar_url
from public.profiles p
where p.role = 'aluno';

create or replace view public.personal_latest_anamnesis_response_summary as
select distinct on (p.personal_id, p.student_id)
  p.id,
  p.personal_id,
  p.student_id,
  p.created_at,
  nullif(p.data->>'reviewed_at', '')::timestamptz as reviewed_at,
  case
    when nullif(p.data->>'renew_in_days', '') ~ '^\d+$' then (p.data->>'renew_in_days')::integer
    else null
  end as renew_in_days
from public.protocols p
where p.type = 'anamnesis'
  and p.student_id is not null
order by p.personal_id, p.student_id, p.created_at desc;

grant select on public.personal_students_list_view to anon, authenticated, service_role;
grant select on public.personal_latest_anamnesis_response_summary to anon, authenticated, service_role;

analyze public.profiles;
analyze public.protocols;
analyze public.debits;
