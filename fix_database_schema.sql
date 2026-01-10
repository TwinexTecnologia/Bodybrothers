-- 1. Criar as colunas que estavam faltando na tabela profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS plan_id uuid REFERENCES public.plans(id),
ADD COLUMN IF NOT EXISTS due_day integer;

-- 2. Migrar os dados que estão no JSON para as novas colunas
UPDATE public.profiles
SET 
    plan_id = (data->>'planId')::uuid,
    due_day = (data->>'dueDay')::integer
WHERE 
    plan_id IS NULL 
    AND data->>'planId' IS NOT NULL 
    AND data->>'planId' != ''
    AND (data->>'planId') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'; -- Regex para garantir UUID válido

-- 3. Agora sim, criar a política de segurança (RLS)
DROP POLICY IF EXISTS "Students view assigned plan" ON public.plans;

CREATE POLICY "Students view assigned plan" ON public.plans
FOR SELECT USING (
    id IN (
        SELECT plan_id FROM public.profiles 
        WHERE id = auth.uid()
    )
);