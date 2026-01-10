-- Tabela para histórico de execução de treinos
CREATE TABLE IF NOT EXISTS public.workout_history (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id uuid NOT NULL REFERENCES auth.users(id),
    workout_id uuid REFERENCES public.protocols(id), -- Pode ser null se o treino for deletado depois
    workout_title text, -- Snapshot do nome do treino
    started_at timestamp with time zone DEFAULT now(),
    finished_at timestamp with time zone,
    duration_seconds integer, -- Tempo total em segundos
    notes text, -- Observações do aluno
    created_at timestamp with time zone DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.workout_history ENABLE ROW LEVEL SECURITY;

-- Políticas de Segurança

-- 1. Aluno pode ver seu próprio histórico
CREATE POLICY "Student view own history" ON public.workout_history
FOR SELECT USING (auth.uid() = student_id);

-- 2. Aluno pode inserir seu histórico
CREATE POLICY "Student insert own history" ON public.workout_history
FOR INSERT WITH CHECK (auth.uid() = student_id);

-- 3. Personal pode ver histórico dos seus alunos
-- (Essa query verifica se o student_id da linha pertence a um aluno cujo personal_id é o usuário atual)
CREATE POLICY "Personal view student history" ON public.workout_history
FOR SELECT USING (
    student_id IN (
        SELECT id FROM public.profiles WHERE personal_id = auth.uid()
    )
);
