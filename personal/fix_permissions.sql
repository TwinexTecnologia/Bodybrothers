-- 1. Permissões da Tabela (Já fizemos, mas garante)
alter table public.personal_config enable row level security;

drop policy if exists "Personal manage own config" on public.personal_config;
create policy "Personal manage own config"
on public.personal_config for all
using (personal_id = auth.uid())
with check (personal_id = auth.uid());


-- 2. CRIAÇÃO DO BUCKET 'logos'
-- Insere o bucket se não existir
insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do nothing;

-- 3. PERMISSÕES DO STORAGE (RLS)
-- Permite que qualquer usuário autenticado faça upload no bucket 'logos'
create policy "Authenticated users can upload logos"
on storage.objects for insert
with check (
  bucket_id = 'logos' and
  auth.role() = 'authenticated'
);

-- Permite que usuários atualizem seus próprios arquivos (opcional, mas bom)
create policy "Users can update own logos"
on storage.objects for update
using (
  bucket_id = 'logos' and
  auth.uid() = owner
);

-- Permite leitura pública dos logos (para o PDF acessar)
create policy "Public logos are viewable"
on storage.objects for select
using ( bucket_id = 'logos' );
