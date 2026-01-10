-- Criação do Bucket de Arquivos de Anamnese
INSERT INTO storage.buckets (id, name, public)
VALUES ('anamnesis-files', 'anamnesis-files', true)
ON CONFLICT (id) DO NOTHING;

-- Política de Upload: Permitir que qualquer usuário autenticado faça upload
CREATE POLICY "Upload de Anamnese Autenticado"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'anamnesis-files' );

-- Política de Visualização: Permitir que qualquer pessoa veja (público) ou apenas autenticados
-- Como definimos public=true no bucket, o acesso direto pela URL funciona se o objeto for público.
-- Mas garantimos acesso via SELECT
CREATE POLICY "Visualizar Anamnese"
ON storage.objects FOR SELECT
TO public
USING ( bucket_id = 'anamnesis-files' );

-- Política de Atualização/Delete (Opcional, caso queira permitir que o aluno troque a foto)
CREATE POLICY "Atualizar Própria Anamnese"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'anamnesis-files' AND auth.uid()::text = (storage.foldername(name))[1] );
