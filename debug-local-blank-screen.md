# [OPEN] Debug Session: local-blank-screen

## Sintoma
- O app `personal` sobe no Vite em `http://localhost:5001`, mas a tela aparece em branco.

## Contexto
- Projeto: `personal`
- Ambiente: local
- Data: 2026-06-29

## Hipoteses Iniciais
1. Existe um erro de runtime no navegador antes da rota renderizar.
2. O `AuthProvider` ou o fluxo inicial de sessão está prendendo a renderização em `null`.
3. Algum componente do shell principal, como `NotificationBellV2` ou `Sidebar`, está quebrando a árvore ao montar.
4. O app está carregando, mas a navegação inicial em `/` entra em redirecionamento inválido ou estado inconsistente.
5. Há erro de configuração local do Supabase/env causando falha silenciosa logo no bootstrap.

## Evidencias
- Console do navegador em `http://localhost:5001/login`:
  - `Error: supabaseUrl is required.`
  - Origem: `src/pages/Migration.tsx:5`
- O erro ocorria durante o import das rotas, antes mesmo da tela de login renderizar.
- Apos substituir o cliente secundario de `Migration.tsx` por fallback seguro igual ao cliente compartilhado, a rota `/login` voltou a renderizar normalmente.
- O login local passou a funcionar apos configurar `.env` do app `personal`.
- Nova evidencia funcional: o perfil do personal mostrava `Free` mesmo com `profiles.data.saas.plan = starter`.
- Causa confirmada no codigo: `Profile.tsx` e `AuthContext.tsx` liam apenas `personal_subscriptions`; quando essa leitura nao retornava dados, a UI fazia fallback para `free` em vez de usar `profiles.data.saas`.

## Proximo Passo
- Usuario precisa recarregar o app local e confirmar se o perfil agora mostra `Starter` e, em seguida, validar o fluxo `past_due`.
