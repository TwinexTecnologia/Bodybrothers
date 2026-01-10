-- Habilita extensão para UUIDs
create extension if not exists "uuid-ossp";

-- 1. TABELA DE PERFIS (PROFILES)
create table if not exists public.profiles (
  id uuid references auth.users not null primary key,
  email text not null,
  role text not null check (role in ('owner', 'personal', 'aluno')),
  full_name text,
  personal_id uuid references public.profiles(id) on delete restrict,
  created_at timestamptz default now(),
  created_by uuid references public.profiles(id),
  last_login_at timestamptz,
  data jsonb default '{}'::jsonb
);

alter table public.profiles enable row level security;

-- 2. CONFIGURAÇÕES DO OWNER
create table if not exists public.owner_config (
  id int primary key default 1 check (id = 1),
  app_name text default 'BodyBrothers Admin',
  logo_url text,
  theme_colors jsonb default '{"primary": "#000000", "secondary": "#ffffff"}'::jsonb,
  updated_at timestamptz default now()
);

alter table public.owner_config enable row level security;

-- 3. CONFIGURAÇÕES DO PERSONAL
create table if not exists public.personal_config (
  personal_id uuid references public.profiles(id) not null primary key,
  app_name text,
  logo_url text,
  theme_colors jsonb default '{"primary": "#2563eb", "secondary": "#1e293b"}'::jsonb,
  saas_due_day int check (saas_due_day between 1 and 31),
  saas_monthly_value numeric(10, 2) default 0,
  status text check (status in ('active', 'inactive', 'blocked')) default 'active',
  updated_at timestamptz default now()
);

alter table public.personal_config enable row level security;

-- 4. PROTOCOLOS (TREINOS, DIETAS, ANAMNESES)
create table if not exists public.protocols (
  id uuid default uuid_generate_v4() primary key,
  student_id uuid references public.profiles(id) not null,
  personal_id uuid references public.profiles(id) not null,
  type text not null check (type in ('workout', 'diet', 'anamnesis', 'anamnesis_model')),
  title text,
  data jsonb not null,
  status text check (status in ('active', 'archived', 'draft')) default 'active',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  starts_at date,
  ends_at date,
  renew_in_days int
);

alter table public.protocols enable row level security;

-- 5. DÉBITOS (FINANCEIRO)
create table if not exists public.debits (
  id uuid default uuid_generate_v4() primary key,
  type text not null check (type in ('saas', 'service')),
  payer_id uuid references public.profiles(id) not null,
  receiver_id uuid references public.profiles(id) not null,
  amount numeric(10, 2) not null,
  description text,
  due_date date not null,
  paid_at timestamptz,
  status text check (status in ('pending', 'paid', 'overdue', 'canceled')) default 'pending',
  saas_ref_month date,
  created_at timestamptz default now()
);

alter table public.debits enable row level security;

-- 6. PLANOS (CONFIGURAÇÃO DE COBRANÇA)
create table if not exists public.plans (
  id uuid default uuid_generate_v4() primary key,
  personal_id uuid references public.profiles(id) not null,
  title text not null,
  price numeric(10, 2) not null,
  due_day int check (due_day between 1 and 31),
  active boolean default true,
  created_at timestamptz default now()
);

alter table public.plans enable row level security;

-- 7. CHAT (MENSAGENS)
create table if not exists public.messages (
  id uuid default uuid_generate_v4() primary key,
  sender_id uuid references public.profiles(id) not null,
  receiver_id uuid references public.profiles(id) not null,
  content text not null,
  read_at timestamptz,
  created_at timestamptz default now()
);

alter table public.messages enable row level security;

-- POLÍTICAS DE SEGURANÇA (RLS)

-- PROFILES
drop policy if exists "Owner view all profiles" on public.profiles;
create policy "Owner view all profiles" on public.profiles for select using ((select role from public.profiles where id = auth.uid()) = 'owner');

drop policy if exists "Personal view self and students" on public.profiles;
create policy "Personal view self and students" on public.profiles for select using (auth.uid() = id or personal_id = auth.uid() or id = (select personal_id from public.profiles where id = auth.uid()));

drop policy if exists "Users can update own profile basic info" on public.profiles;
create policy "Users can update own profile basic info" on public.profiles for update using (auth.uid() = id);

-- PROTOCOLS
drop policy if exists "Personal full access to own protocols" on public.protocols;
create policy "Personal full access to own protocols" on public.protocols for all using (personal_id = auth.uid());

drop policy if exists "Student read own protocols" on public.protocols;
create policy "Student read own protocols" on public.protocols for select using (student_id = auth.uid());

-- PLANS
drop policy if exists "Personal manage own plans" on public.plans;
create policy "Personal manage own plans" on public.plans for all using (personal_id = auth.uid());

drop policy if exists "Student read personal plans" on public.plans;
create policy "Student read personal plans" on public.plans for select using (
  personal_id = (select personal_id from public.profiles where id = auth.uid())
);

-- CHAT
drop policy if exists "Users can read messages sent to or by them" on public.messages;
create policy "Users can read messages sent to or by them" on public.messages for select using (auth.uid() = sender_id or auth.uid() = receiver_id);

drop policy if exists "Users can send messages" on public.messages;
create policy "Users can send messages" on public.messages for insert with check (auth.uid() = sender_id);


-- FUNÇÃO E TRIGGER PARA NOVOS USUÁRIOS
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, role, full_name, personal_id, created_by, data)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'aluno'),
    new.raw_user_meta_data->>'full_name',
    (new.raw_user_meta_data->>'personal_id')::uuid,
    (new.raw_user_meta_data->>'created_by')::uuid,
    '{}'::jsonb
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
