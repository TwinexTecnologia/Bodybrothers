-- Cria o bucket se não existir
insert into storage.buckets (id, name, public)
values ('anamnesis-photos', 'anamnesis-photos', true)
on conflict (id) do nothing;

-- Política de Upload: Alunos podem fazer upload na própria pasta
create policy "Alunos upload fotos"
on storage.objects for insert
with check (
  bucket_id = 'anamnesis-photos' and
  auth.role() = 'authenticated'
);

-- Política de Leitura: Personal e Aluno podem ver
create policy "Public Access"
on storage.objects for select
using ( bucket_id = 'anamnesis-photos' );
