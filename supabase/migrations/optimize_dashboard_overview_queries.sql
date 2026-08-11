create index if not exists idx_profiles_personal_role_active_status
on public.profiles (personal_id, role, (coalesce(data->>'status', 'ativo')));

create index if not exists idx_protocols_anamnesis_review_queue
on public.protocols (personal_id, student_id, created_at desc)
where type = 'anamnesis'
  and nullif(data->>'reviewed_at', '') is null;

create or replace view public.personal_active_students_dashboard as
select
  p.id,
  p.personal_id,
  p.created_at,
  coalesce(p.plan_id, nullif(p.data->>'planId', '')::uuid) as plan_id,
  nullif(p.data->>'planStartDate', '')::date as plan_start_date
from public.profiles p
where p.role = 'aluno'
  and coalesce(p.data->>'status', 'ativo') <> 'inativo';

create or replace view public.personal_active_anamnesis_review_queue as
select
  p.id,
  p.personal_id,
  p.student_id,
  p.created_at
from public.protocols p
join public.profiles s
  on s.id = p.student_id
 and s.personal_id = p.personal_id
where p.type = 'anamnesis'
  and p.student_id is not null
  and nullif(p.data->>'reviewed_at', '') is null
  and s.role = 'aluno'
  and coalesce(s.data->>'status', 'ativo') <> 'inativo';

grant select on public.personal_active_students_dashboard to anon, authenticated, service_role;
grant select on public.personal_active_anamnesis_review_queue to anon, authenticated, service_role;

analyze public.profiles;
analyze public.protocols;
