create index if not exists idx_profiles_personal_role
on public.profiles (personal_id, role);

create index if not exists idx_plans_personal
on public.plans (personal_id);

create index if not exists idx_debits_receiver_status_payer
on public.debits (receiver_id, status, payer_id);

create index if not exists idx_protocols_personal_type
on public.protocols (personal_id, type);

create index if not exists idx_protocols_personal_type_status
on public.protocols (personal_id, type, status);

create index if not exists idx_protocols_personal_type_student
on public.protocols (personal_id, type, student_id);
