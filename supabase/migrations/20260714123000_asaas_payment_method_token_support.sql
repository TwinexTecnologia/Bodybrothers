alter table public.personal_payment_methods
  add column if not exists provider_payment_method_token text;

create index if not exists idx_personal_payment_methods_payment_method_token
  on public.personal_payment_methods (provider_payment_method_token)
  where provider_payment_method_token is not null;

update public.personal_payment_methods
set provider_payment_method_token = coalesce(
  provider_payment_method_token,
  nullif(raw_payload->>'providerPaymentMethodToken', ''),
  nullif(raw_payload->>'paymentMethodToken', ''),
  nullif(raw_payload->>'creditCardToken', ''),
  nullif(raw_payload->'paymentMethod'->>'providerPaymentMethodToken', ''),
  nullif(raw_payload->'paymentMethod'->>'paymentMethodToken', ''),
  nullif(raw_payload->'paymentMethod'->>'creditCardToken', '')
)
where provider_payment_method_token is null;

update public.personal_payment_methods
set provider_payment_method_token = coalesce(
  provider_payment_method_token,
  nullif(p.data->'paymentMethod'->>'providerPaymentMethodToken', ''),
  nullif(p.data->'paymentMethod'->>'paymentMethodToken', ''),
  nullif(p.data->'paymentMethod'->>'creditCardToken', '')
)
from public.profiles p
where p.id = public.personal_payment_methods.personal_id
  and provider_payment_method_token is null;
