-- 1. Garante que o bucket 'videos' existe e é público
INSERT INTO storage.buckets (id, name, public)
VALUES ('videos', 'videos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Remove políticas antigas para evitar conflitos/erros
DROP POLICY IF EXISTS "Videos Publicos (Leitura)" ON storage.objects;
DROP POLICY IF EXISTS "Upload de Videos (Autenticado)" ON storage.objects;
DROP POLICY IF EXISTS "Gerenciar Videos (Dono)" ON storage.objects;

-- 3. Libera LEITURA para todos (Público)
CREATE POLICY "Videos Publicos (Leitura)"
ON storage.objects FOR SELECT
USING ( bucket_id = 'videos' );

-- 4. Libera UPLOAD para usuários logados
CREATE POLICY "Upload de Videos (Autenticado)"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'videos' AND auth.role() = 'authenticated' );

-- 5. Libera UPDATE/DELETE para quem fez o upload (Dono)
CREATE POLICY "Gerenciar Videos (Dono)"
ON storage.objects FOR ALL
USING ( bucket_id = 'videos' AND auth.uid() = owner );
