create index if not exists idx_profiles_personal_role_active_status
on public.profiles (personal_id, role, (coalesce(data->>'status', 'ativo')));

create index if not exists idx_protocols_anamnesis_review_queue
on public.protocols (personal_id, student_id, created_at desc)
where type = 'anamnesis'
  and nullif(data->>'reviewed_at', '') is null;

create or replace view public.personal_active_students as
select
  p.id,
  p.personal_id,
  p.full_name
from public.profiles p
where p.role = 'aluno'
  and coalesce(p.data->>'status', 'ativo') <> 'inativo';

grant select on public.personal_active_students to anon, authenticated, service_role;

analyze public.profiles;
analyze public.protocols;
