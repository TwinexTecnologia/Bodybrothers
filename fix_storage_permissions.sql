-- Habilita RLS (se não estiver)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Remove políticas antigas para evitar conflito/duplicidade
DROP POLICY IF EXISTS "Upload de Anamnese Autenticado" ON storage.objects;
DROP POLICY IF EXISTS "Permitir Upload para Autenticados" ON storage.objects;
DROP POLICY IF EXISTS "Visualizar Anamnese" ON storage.objects;
DROP POLICY IF EXISTS "Permitir Visualização Publica" ON storage.objects;

-- 1. Política de UPLOAD (INSERT)
-- Permite que qualquer usuário logado faça upload de arquivos na pasta anamnesis-files
CREATE POLICY "Permitir Upload Anamnese"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'anamnesis-files' );

-- 2. Política de VISUALIZAÇÃO (SELECT)
-- Permite que qualquer pessoa veja os arquivos (necessário para mostrar a foto no app)
CREATE POLICY "Permitir Ver Anamnese"
ON storage.objects FOR SELECT
TO public
USING ( bucket_id = 'anamnesis-files' );

-- 3. (Opcional) Política de UPDATE/DELETE
-- Permite que o usuário delete/atualize apenas seus próprios arquivos
CREATE POLICY "Gerenciar Próprios Arquivos"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'anamnesis-files' AND auth.uid()::text = (storage.foldername(name))[1] );
