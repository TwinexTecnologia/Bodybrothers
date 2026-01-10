-- 1. Remove políticas anteriores que podem estar bloqueando
DROP POLICY IF EXISTS "Personal can view their students" ON profiles;
DROP POLICY IF EXISTS "Personal can update their students" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile and students" ON profiles;
DROP POLICY IF EXISTS "Personal can insert students" ON profiles;

-- 2. Política de Visualização (SELECT)
-- Permite ver:
-- a) O próprio perfil
-- b) Perfis que são meus alunos (personal_id = meu id)
-- c) Perfis criados por mim (created_by = meu id) - Caso personal_id esteja null mas created_by não
CREATE POLICY "View own profile and students" ON profiles
    FOR SELECT USING (
        auth.uid() = id 
        OR 
        auth.uid() = personal_id
        OR
        auth.uid()::text = data->>'created_by' -- Fallback se personal_id falhar
    );

-- 3. Política de Inserção (INSERT)
-- Permite qualquer usuário autenticado criar perfis (necessário para criar alunos)
CREATE POLICY "Insert profiles" ON profiles
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 4. Política de Edição (UPDATE)
-- Permite editar:
-- a) O próprio perfil
-- b) Meus alunos
CREATE POLICY "Update own profile and students" ON profiles
    FOR UPDATE USING (
        auth.uid() = id 
        OR 
        auth.uid() = personal_id
    );

-- 5. Verifica se personal_id está preenchido (Diagnóstico)
-- Se esta query retornar alunos com personal_id NULL, eles não aparecerão.
-- Você pode rodar isso separadamente para checar.
-- SELECT id, full_name, personal_id FROM profiles WHERE role = 'aluno';
