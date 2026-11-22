create index if not exists idx_protocols_anamnesis_personal_student_created_desc
on public.protocols (personal_id, student_id, created_at desc)
where type = 'anamnesis';

create or replace view public.anamnesis_latest_responses as
select distinct on (p.personal_id, p.student_id)
  p.id,
  p.personal_id,
  p.student_id,
  p.created_at,
  p.renew_in_days,
  p.data,
  nullif(p.data->>'modelId', '') as model_id,
  nullif(p.data->>'reviewed_at', '')::timestamptz as reviewed_at
from public.protocols p
where p.type = 'anamnesis'
  and p.student_id is not null
order by p.personal_id, p.student_id, p.created_at desc, p.id desc;

create or replace view public.anamnesis_review_queue as
select
  p.id,
  p.personal_id,
  p.student_id,
  p.created_at,
  p.renew_in_days,
  p.data,
  nullif(p.data->>'modelId', '') as model_id,
  nullif(p.data->>'reviewed_at', '')::timestamptz as reviewed_at
from public.protocols p
where p.type = 'anamnesis'
  and p.student_id is not null
  and nullif(p.data->>'reviewed_at', '') is null;

grant select on public.anamnesis_latest_responses to anon, authenticated, service_role;
grant select on public.anamnesis_review_queue to anon, authenticated, service_role;

analyze public.protocols;
analyze public.profiles;
