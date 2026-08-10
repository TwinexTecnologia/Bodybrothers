alter table public.personal_subscriptions
  add column if not exists provider_payment_profile_id text;

alter table public.personal_payment_methods
  add column if not exists provider_payment_profile_id text;

alter table public.personal_payment_methods
  alter column provider_card_id drop not null;

create index if not exists idx_personal_payment_methods_payment_profile
  on public.personal_payment_methods (provider_payment_profile_id)
  where provider_payment_profile_id is not null;

update public.personal_payment_methods
set provider_payment_profile_id = coalesce(
  provider_payment_profile_id,
  nullif(raw_payload->>'providerPaymentProfileId', ''),
  nullif(raw_payload->>'paymentProfileId', ''),
  nullif(raw_payload->>'payment_profile_id', ''),
  nullif(raw_payload->'automatic_payments'->>'payment_profile_id', ''),
  nullif(raw_payload->'automatic_payments'->>'paymentProfileId', ''),
  nullif(raw_payload->'payment_profile'->>'id', ''),
  nullif(raw_payload->'paymentProfile'->>'id', '')
)
where provider_payment_profile_id is null;

update public.personal_payment_methods
set provider_payment_profile_id = coalesce(
  provider_payment_profile_id,
  nullif(p.data->'paymentMethod'->>'providerPaymentProfileId', ''),
  nullif(p.data->'paymentMethod'->>'paymentProfileId', '')
)
from public.profiles p
where p.id = public.personal_payment_methods.personal_id
  and provider_payment_profile_id is null;

update public.personal_subscriptions ps
set provider_payment_profile_id = coalesce(
  ps.provider_payment_profile_id,
  ppm.provider_payment_profile_id,
  nullif(ppm.raw_payload->>'providerPaymentProfileId', ''),
  nullif(ppm.raw_payload->>'paymentProfileId', ''),
  nullif(ppm.raw_payload->>'payment_profile_id', ''),
  nullif(ppm.raw_payload->'automatic_payments'->>'payment_profile_id', ''),
  nullif(ppm.raw_payload->'automatic_payments'->>'paymentProfileId', '')
)
from public.personal_payment_methods ppm
where ppm.personal_id = ps.personal_id
  and ps.provider_payment_profile_id is null;

update public.personal_subscriptions ps
set provider_payment_profile_id = coalesce(
  ps.provider_payment_profile_id,
  nullif(p.data->'paymentMethod'->>'providerPaymentProfileId', ''),
  nullif(p.data->'paymentMethod'->>'paymentProfileId', '')
)
from public.profiles p
where p.id = ps.personal_id
  and ps.provider_payment_profile_id is null;
