-- 1. Recriar a função (para garantir)
CREATE OR REPLACE FUNCTION public.create_profile_as_admin(
  p_id uuid,
  p_email text,
  p_role text,
  p_full_name text,
  p_phone text,
  p_brand_name text,
  p_logo_url text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, full_name, data)
  VALUES (
    p_id,
    p_email,
    p_role,
    p_full_name,
    jsonb_build_object(
      'phone', p_phone,
      'branding', jsonb_build_object(
        'brandName', p_brand_name,
        'logoUrl', p_logo_url
      )
    )
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    full_name = EXCLUDED.full_name,
    data = EXCLUDED.data;
END;
$$;

-- 2. DAR PERMISSÃO para usuários autenticados (como o Owner) executarem a função
GRANT EXECUTE ON FUNCTION public.create_profile_as_admin TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_profile_as_admin TO service_role;

-- 3. FORÇAR RECARGA do Cache da API (Isso resolve o erro "schema cache")
NOTIFY pgrst, 'reload';
