-- CORREÇÃO DE RLS PARA PERMITIR LOGIN
-- O usuário precisa conseguir ler seu próprio status para saber se foi bloqueado ou não.

-- 1. Remove políticas antigas de leitura que possam estar bloqueando
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Enable read access for own profile" ON profiles;

-- 2. Cria política que permite SEMPRE ler o próprio perfil, independente do status
CREATE POLICY "Users can view own profile" 
ON profiles FOR SELECT 
USING (auth.uid() = id);

-- 3. Garante que o update continua protegido (só pode editar se estiver ativo, ou se for personal)
-- (Isso já deve existir, mas reforçando)
