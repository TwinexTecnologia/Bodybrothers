alter table public.plans
add column if not exists billing_cycle_days integer;

update public.plans
set billing_cycle_days = case frequency
  when 'weekly' then 7
  when 'monthly' then 30
  when 'bimonthly' then 60
  when 'quarterly' then 90
  when 'semiannual' then 180
  when 'annual' then 365
  else 30
end
where billing_cycle_days is null
   or billing_cycle_days <= 0;

alter table public.plans
alter column billing_cycle_days set default 30;

alter table public.plans
alter column billing_cycle_days set not null;
