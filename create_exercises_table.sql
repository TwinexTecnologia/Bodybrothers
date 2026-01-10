-- Tabela de Exercícios da Biblioteca do Personal
CREATE TABLE IF NOT EXISTS exercises (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    personal_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    muscle_group TEXT, -- Ex: Peito, Costas, Pernas
    video_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilita RLS
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;

-- Políticas de Segurança
-- Personal pode ver apenas seus exercícios
CREATE POLICY "Personal view own exercises" ON exercises
    FOR SELECT USING (auth.uid() = personal_id);

-- Personal pode inserir seus exercícios
CREATE POLICY "Personal insert own exercises" ON exercises
    FOR INSERT WITH CHECK (auth.uid() = personal_id);

-- Personal pode atualizar seus exercícios
CREATE POLICY "Personal update own exercises" ON exercises
    FOR UPDATE USING (auth.uid() = personal_id);

-- Personal pode deletar seus exercícios
CREATE POLICY "Personal delete own exercises" ON exercises
    FOR DELETE USING (auth.uid() = personal_id);

-- Índices para performance
CREATE INDEX IF NOT EXISTS exercises_personal_id_idx ON exercises(personal_id);
