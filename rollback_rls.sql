-- DESATIVA O RLS (Segurança a nível de linha) na tabela profiles
-- Isso faz com que a tabela fique pública para usuários autenticados (comportamento padrão inicial)
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- Opcional: Se quiser manter ativado mase permissivo, use:
-- ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Enable all for authenticated" ON profiles FOR ALL USING (auth.role() = 'authenticated');
