-- 1. Melhorar a função do Trigger (mais robusta contra erros)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_role text;
  v_personal_id uuid;
  v_created_by uuid;
BEGIN
  -- Define role (padrão 'aluno' se não vier nada)
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'aluno');

  -- Converte personal_id com segurança (trata string vazia como null)
  BEGIN
    v_personal_id := NULLIF(NEW.raw_user_meta_data->>'personal_id', '')::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_personal_id := NULL;
  END;

  -- Converte created_by com segurança
  BEGIN
    v_created_by := NULLIF(NEW.raw_user_meta_data->>'created_by', '')::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_created_by := NULL;
  END;

  INSERT INTO public.profiles (id, email, role, full_name, personal_id, created_by, data)
  VALUES (
    NEW.id,
    NEW.email,
    v_role,
    NEW.raw_user_meta_data->>'full_name',
    v_personal_id,
    v_created_by,
    COALESCE(NEW.raw_user_meta_data, '{}'::jsonb)
  )
  ON CONFLICT (id) DO UPDATE SET
    role = EXCLUDED.role,
    full_name = EXCLUDED.full_name;

  RETURN NEW;
END;
$$;

-- 2. Recriar o Trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 3. CORREÇÃO DE EMERGÊNCIA: Criar perfil para usuário que ficou sem
-- Substitua o email abaixo pelo email do personal que deu erro
INSERT INTO public.profiles (id, email, role, full_name, data)
SELECT 
    id, 
    email, 
    'personal', -- Força role personal
    COALESCE(raw_user_meta_data->>'full_name', 'Nome Desconhecido'),
    COALESCE(raw_user_meta_data, '{}'::jsonb)
FROM auth.users
WHERE email = 'EMAIL_DO_PERSONAL_QUE_FALHOU@exemplo.com' -- <--- COLOQUE O EMAIL AQUI
AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.users.id);
