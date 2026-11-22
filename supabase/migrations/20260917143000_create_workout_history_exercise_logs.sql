create table if not exists public.workout_history_exercise_logs (
  id uuid primary key default gen_random_uuid(),
  workout_history_id uuid not null references public.workout_history(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  workout_id uuid references public.protocols(id) on delete set null,
  exercise_index integer not null,
  exercise_name text not null,
  exercise_group text,
  set_index integer not null,
  set_type text not null default 'working',
  set_label text not null,
  target_reps text,
  prescribed_load text,
  performed_reps integer,
  load numeric(10,2),
  completed boolean not null default false,
  performed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (workout_history_id, exercise_index, set_index)
);

alter table public.workout_history_exercise_logs enable row level security;

drop policy if exists "Student view own workout set logs" on public.workout_history_exercise_logs;
create policy "Student view own workout set logs"
on public.workout_history_exercise_logs
for select
using (auth.uid() = student_id);

drop policy if exists "Student insert own workout set logs" on public.workout_history_exercise_logs;
create policy "Student insert own workout set logs"
on public.workout_history_exercise_logs
for insert
with check (auth.uid() = student_id);

drop policy if exists "Student update own workout set logs" on public.workout_history_exercise_logs;
create policy "Student update own workout set logs"
on public.workout_history_exercise_logs
for update
using (auth.uid() = student_id)
with check (auth.uid() = student_id);

drop policy if exists "Student delete own workout set logs" on public.workout_history_exercise_logs;
create policy "Student delete own workout set logs"
on public.workout_history_exercise_logs
for delete
using (auth.uid() = student_id);

drop policy if exists "Personal view linked student workout set logs" on public.workout_history_exercise_logs;
create policy "Personal view linked student workout set logs"
on public.workout_history_exercise_logs
for select
using (
  student_id in (
    select p.id
    from public.profiles p
    where p.personal_id = auth.uid()
  )
);
