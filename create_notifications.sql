CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL, -- Quem recebe a notificação (Personal)
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    read BOOLEAN DEFAULT FALSE,
    type TEXT DEFAULT 'info', -- 'feedback', 'payment', etc
    link TEXT, -- Link para redirecionar
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Usuário vê apenas suas notificações
CREATE POLICY "Users can view own notifications" ON notifications
    FOR SELECT USING (auth.uid() = user_id);

-- Usuário pode marcar como lida (update)
CREATE POLICY "Users can update own notifications" ON notifications
    FOR UPDATE USING (auth.uid() = user_id);

-- Qualquer um pode criar notificação (para enviar feedback)
-- Importante: authenticated users podem inserir.
CREATE POLICY "Anyone can insert notifications" ON notifications
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');
