-- Permite que o Owner insira, edite e delete QUALQUER perfil
DROP POLICY IF EXISTS "Owner manage all profiles" ON public.profiles;

CREATE POLICY "Owner manage all profiles"
ON public.profiles
FOR ALL
USING (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
    and profiles.role = 'owner'
  )
);
