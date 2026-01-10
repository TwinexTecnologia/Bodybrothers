-- 1. Permite leitura pública da tabela personal_config (contém apenas branding público)
ALTER TABLE public.personal_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read personal config" ON public.personal_config;

CREATE POLICY "Public read personal config"
ON public.personal_config FOR SELECT
USING ( true );

-- 2. Recria a função RPC para garantir que está correta
CREATE OR REPLACE FUNCTION public.get_my_personal_branding()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_personal_id uuid;
  v_branding jsonb;
  v_config_app_name text;
  v_config_logo_url text;
BEGIN
  -- Pega ID do personal
  SELECT personal_id INTO v_personal_id
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_personal_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Tenta pegar do profile.data.branding
  SELECT data->'branding' INTO v_branding
  FROM public.profiles
  WHERE id = v_personal_id;

  IF v_branding IS NOT NULL THEN
    RETURN v_branding;
  END IF;

  -- Se não achou, tenta pegar da tabela personal_config
  SELECT app_name, logo_url INTO v_config_app_name, v_config_logo_url
  FROM public.personal_config
  WHERE personal_id = v_personal_id;

  IF v_config_app_name IS NOT NULL OR v_config_logo_url IS NOT NULL THEN
    RETURN jsonb_build_object(
      'brandName', v_config_app_name,
      'logoUrl', v_config_logo_url
    );
  END IF;

  RETURN NULL;
END;
$$;
