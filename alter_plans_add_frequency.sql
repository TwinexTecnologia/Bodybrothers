ALTER TABLE public.plans 
ADD COLUMN IF NOT EXISTS frequency text DEFAULT 'monthly';

-- Atualizar registros existentes para monthly
UPDATE public.plans SET frequency = 'monthly' WHERE frequency IS NULL;
