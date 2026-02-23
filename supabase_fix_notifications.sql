-- CORREÇÃO DE PERMISSÕES PARA NOTIFICAÇÕES
-- O aluno precisa ter permissão para INSERIR na tabela de notificações do personal.
-- Por padrão, o RLS pode estar bloqueando inserts onde user_id != auth.uid().

-- 1. Verifica se a política já existe (opcional, pode dar erro se já existir, ignore)
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON "public"."notifications";

-- 2. Cria política permissiva para INSERT
CREATE POLICY "Enable insert for authenticated users"
ON "public"."notifications"
FOR INSERT
TO authenticated
WITH CHECK (true);

-- 3. Garante que o SELECT continue restrito (segurança)
-- (Geralmente já existe, mas bom garantir)
-- CREATE POLICY "Enable select for users based on user_id" ... (não vou mexer no select para não quebrar nada)
