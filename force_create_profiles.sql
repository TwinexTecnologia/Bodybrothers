-- ESSE SCRIPT CONSERTA QUALQUER USUÁRIO QUE FICOU SEM PERFIL

-- 1. Insere perfis para usuários que existem no Auth mas não na tabela Profiles
INSERT INTO public.profiles (id, email, role, full_name, data)
SELECT 
    au.id, 
    au.email, 
    -- Tenta pegar a role que foi enviada no cadastro. 
    -- Se não tiver (null), assume 'personal' (já que você está criando personais)
    COALESCE(au.raw_user_meta_data->>'role', 'personal'), 
    COALESCE(au.raw_user_meta_data->>'full_name', 'Usuário Recuperado'),
    COALESCE(au.raw_user_meta_data, '{}'::jsonb)
FROM auth.users au
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = au.id);

-- 2. Mostra os usuários que acabaram de ser corrigidos/criados
SELECT * FROM public.profiles 
WHERE created_at > (NOW() - INTERVAL '5 minutes');
