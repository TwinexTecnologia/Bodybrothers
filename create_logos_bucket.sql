-- 1. Cria o bucket 'logos' se não existir
INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Remove políticas antigas para evitar conflitos
DROP POLICY IF EXISTS "Logos Publicos (Leitura)" ON storage.objects;
DROP POLICY IF EXISTS "Upload de Logos (Owner/Auth)" ON storage.objects;
DROP POLICY IF EXISTS "Gerenciar Logos (Dono)" ON storage.objects;

-- 3. Libera LEITURA para todos (Público)
CREATE POLICY "Logos Publicos (Leitura)"
ON storage.objects FOR SELECT
USING ( bucket_id = 'logos' );

-- 4. Libera UPLOAD para usuários autenticados (Owner e Personais)
CREATE POLICY "Upload de Logos (Owner/Auth)"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'logos' AND auth.role() = 'authenticated' );

-- 5. Libera UPDATE/DELETE para quem fez o upload
CREATE POLICY "Gerenciar Logos (Dono)"
ON storage.objects FOR ALL
USING ( bucket_id = 'logos' AND auth.uid() = owner );
