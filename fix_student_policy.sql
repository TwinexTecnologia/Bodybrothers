-- Garante que o aluno possa ver o perfil do seu personal
DROP POLICY IF EXISTS "Student view personal profile" ON public.profiles;

CREATE POLICY "Student view personal profile"
ON public.profiles
FOR SELECT
USING (
  -- Permite ver se o ID alvo é o personal_id do usuário atual
  id IN (
      SELECT personal_id 
      FROM public.profiles 
      WHERE id = auth.uid()
  )
);
