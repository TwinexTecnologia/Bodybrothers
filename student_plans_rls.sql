-- Política para permitir que alunos vejam os planos vinculados a eles
-- (Assumindo que o aluno sabe o ID do plano através do seu perfil)

DROP POLICY IF EXISTS "Students view assigned plan" ON public.plans;

CREATE POLICY "Students view assigned plan" ON public.plans
FOR SELECT USING (
    id IN (
        SELECT plan_id FROM public.profiles 
        WHERE id = auth.uid()
    )
    OR
    id IN (
        -- Fallback para compatibilidade com JSON, embora não seja performático em RLS
        SELECT (data->>'planId')::uuid FROM public.profiles 
        WHERE id = auth.uid()
    )
);
