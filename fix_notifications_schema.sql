-- Adiciona a coluna 'link' que está faltando na tabela notifications
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS link TEXT;

-- Garante que a coluna 'type' também exista
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'info';
