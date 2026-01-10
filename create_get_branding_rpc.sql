-- Função segura para o aluno pegar o branding do seu personal
CREATE OR REPLACE FUNCTION public.get_my_personal_branding()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER -- Roda com permissões de superusuário (bypassa RLS)
SET search_path = public
AS $$
DECLARE
  v_personal_id uuid;
  v_branding jsonb;
BEGIN
  -- 1. Pega o personal_id do usuário atual
  SELECT personal_id INTO v_personal_id
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_personal_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- 2. Pega o branding do personal
  SELECT data->'branding' INTO v_branding
  FROM public.profiles
  WHERE id = v_personal_id;

  RETURN v_branding;
END;
$$;
