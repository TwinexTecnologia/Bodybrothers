alter table public.personal_subscriptions enable row level security;

drop policy if exists "Personal can read own subscriptions"
  on public.personal_subscriptions;

create policy "Personal can read own subscriptions"
  on public.personal_subscriptions
  for select
  to authenticated
  using (
    personal_id = auth.uid()
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.personal_id = public.personal_subscriptions.personal_id
    )
  );

alter table public.subscription_payments enable row level security;

drop policy if exists "Personal can read own subscription payments"
  on public.subscription_payments;

create policy "Personal can read own subscription payments"
  on public.subscription_payments
  for select
  to authenticated
  using (
    personal_id = auth.uid()
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.personal_id = public.subscription_payments.personal_id
    )
  );
