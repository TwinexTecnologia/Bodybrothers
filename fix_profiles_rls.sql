-- Habilita RLS na tabela profiles (se não estiver)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Remove políticas antigas conflitantes (opcional, mas bom para garantir)
DROP POLICY IF EXISTS "Personal can view their students" ON profiles;
DROP POLICY IF EXISTS "Personal can update their students" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;

-- 1. Usuário vê seu próprio perfil
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

-- 2. Personal vê seus alunos (onde personal_id = seu id)
CREATE POLICY "Personal can view their students" ON profiles
    FOR SELECT USING (auth.uid() = personal_id);

-- 3. Personal pode atualizar seus alunos (editar dados)
CREATE POLICY "Personal can update their students" ON profiles
    FOR UPDATE USING (auth.uid() = personal_id);

-- 4. Personal pode inserir alunos (geralmente feito via trigger, mas se for manual ajuda)
CREATE POLICY "Personal can insert students" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = personal_id OR auth.uid() = id); 
    -- Nota: Na inserção, auth.uid() geralmente é o criador, mas se usarmos cliente anonimo para criar user, o profile é criado pelo trigger ou pelo cliente anonimo.
    -- Se for trigger `security definer`, passa por cima do RLS.
    -- Se for `upsert` manual no front como estamos fazendo, precisa de permissão.

-- Garantir que o Personal possa ver a si mesmo (caso personal_id seja null para ele)
-- Já coberto pela regra 1.

-- Política para Admin/Owner (se houver role 'admin' ou similar, ou se for superuser - superuser ignora RLS)
-- Mas vamos assumir que o 'personal' é o nível mais alto aqui.
