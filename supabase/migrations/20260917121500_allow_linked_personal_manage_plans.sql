drop policy if exists "Personal manage own plans" on public.plans;

create policy "Personal read and manage linked plans"
on public.plans
for select
to authenticated
using (
  personal_id = auth.uid()
  or personal_id = (
    select p.personal_id
    from public.profiles as p
    where p.id = auth.uid()
  )
);

create policy "Personal insert linked plans"
on public.plans
for insert
to authenticated
with check (
  personal_id = auth.uid()
  or personal_id = (
    select p.personal_id
    from public.profiles as p
    where p.id = auth.uid()
  )
);

create policy "Personal update linked plans"
on public.plans
for update
to authenticated
using (
  personal_id = auth.uid()
  or personal_id = (
    select p.personal_id
    from public.profiles as p
    where p.id = auth.uid()
  )
)
with check (
  personal_id = auth.uid()
  or personal_id = (
    select p.personal_id
    from public.profiles as p
    where p.id = auth.uid()
  )
);

create policy "Personal delete linked plans"
on public.plans
for delete
to authenticated
using (
  personal_id = auth.uid()
  or personal_id = (
    select p.personal_id
    from public.profiles as p
    where p.id = auth.uid()
  )
);
