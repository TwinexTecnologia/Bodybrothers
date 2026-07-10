create extension if not exists pgcrypto;

alter table public.personal_subscriptions
  add column if not exists provider_customer_id text,
  add column if not exists provider_subscription_id text;

create table if not exists public.personal_payment_methods (
  id uuid primary key default gen_random_uuid(),
  personal_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null,
  provider_customer_id text not null,
  provider_card_id text not null,
  payment_method_id text,
  issuer_id text,
  brand text,
  last_four text,
  first_payment_provider_payment_id text,
  provider_subscription_id text,
  status text not null default 'active' check (status in ('active', 'inactive', 'deleted')),
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (personal_id)
);

create index if not exists idx_personal_payment_methods_provider_customer_card
  on public.personal_payment_methods (provider_customer_id, provider_card_id);

alter table public.personal_payment_methods enable row level security;

drop policy if exists "Personal can read own payment methods"
  on public.personal_payment_methods;

create policy "Personal can read own payment methods"
  on public.personal_payment_methods
  for select
  to authenticated
  using (
    personal_id = auth.uid()
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.personal_id = public.personal_payment_methods.personal_id
    )
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'owner'
    )
  );

insert into public.personal_payment_methods (
  personal_id,
  provider,
  provider_customer_id,
  provider_card_id,
  payment_method_id,
  issuer_id,
  brand,
  last_four,
  first_payment_provider_payment_id,
  provider_subscription_id,
  status,
  raw_payload,
  updated_at
)
select
  p.id as personal_id,
  coalesce(p.data->'paymentMethod'->>'provider', 'mercadopago') as provider,
  p.data->'paymentMethod'->>'providerCustomerId' as provider_customer_id,
  p.data->'paymentMethod'->>'providerCardId' as provider_card_id,
  nullif(p.data->'paymentMethod'->>'paymentMethodId', '') as payment_method_id,
  nullif(p.data->'paymentMethod'->>'issuerId', '') as issuer_id,
  nullif(p.data->'paymentMethod'->>'brand', '') as brand,
  nullif(p.data->'paymentMethod'->>'lastFour', '') as last_four,
  nullif(p.data->'paymentMethod'->>'firstPaymentProviderPaymentId', '') as first_payment_provider_payment_id,
  nullif(p.data->'paymentMethod'->>'providerSubscriptionId', '') as provider_subscription_id,
  'active' as status,
  jsonb_build_object(
    'source', 'profiles.data.paymentMethod',
    'paymentMethod', p.data->'paymentMethod'
  ) as raw_payload,
  coalesce(
    nullif(p.data->'paymentMethod'->>'updatedAt', '')::timestamptz,
    now()
  ) as updated_at
from public.profiles p
where jsonb_typeof(p.data->'paymentMethod') = 'object'
  and coalesce(p.data->'paymentMethod'->>'providerCustomerId', '') <> ''
  and coalesce(p.data->'paymentMethod'->>'providerCardId', '') <> ''
on conflict (personal_id) do update
set
  provider = excluded.provider,
  provider_customer_id = excluded.provider_customer_id,
  provider_card_id = excluded.provider_card_id,
  payment_method_id = excluded.payment_method_id,
  issuer_id = excluded.issuer_id,
  brand = excluded.brand,
  last_four = excluded.last_four,
  first_payment_provider_payment_id = excluded.first_payment_provider_payment_id,
  provider_subscription_id = excluded.provider_subscription_id,
  status = excluded.status,
  raw_payload = excluded.raw_payload,
  updated_at = excluded.updated_at;

update public.personal_subscriptions ps
set
  provider_customer_id = coalesce(ps.provider_customer_id, ppm.provider_customer_id),
  provider_subscription_id = coalesce(ps.provider_subscription_id, ppm.provider_subscription_id)
from public.personal_payment_methods ppm
where ppm.personal_id = ps.personal_id;
