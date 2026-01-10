-- Permitir que o OWNER veja TODOS os alunos (students)
CREATE POLICY "Owner pode ver todos os alunos"
ON public.students
FOR SELECT
USING (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
    and profiles.role = 'owner'
  )
);

-- Permitir que o OWNER veja TODOS os treinos (workouts)
CREATE POLICY "Owner pode ver todos os treinos"
ON public.workouts
FOR SELECT
USING (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
    and profiles.role = 'owner'
  )
);

-- Permitir que o OWNER veja TODAS as dietas (diets)
CREATE POLICY "Owner pode ver todas as dietas"
ON public.diets
FOR SELECT
USING (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
    and profiles.role = 'owner'
  )
);

-- Permitir que o OWNER veja TODOS os pagamentos (financial_debits)
CREATE POLICY "Owner pode ver todos os pagamentos"
ON public.financial_debits
FOR SELECT
USING (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
    and profiles.role = 'owner'
  )
);
