-- Atualizar ou Criar Owner
INSERT INTO public.profiles (id, email, full_name, role)
VALUES 
    ('2f4e293e-e4d3-47c4-b4eb-4aa942454138', 'leleex.com.br@gmail.com', 'alex christos simonis', 'owner')
ON CONFLICT (id) DO UPDATE 
    SET role = 'owner',
        email = 'leleex.com.br@gmail.com',
        full_name = 'alex christos simonis';

-- Confirmação
SELECT * FROM public.profiles WHERE id = '2f4e293e-e4d3-47c4-b4eb-4aa942454138';
