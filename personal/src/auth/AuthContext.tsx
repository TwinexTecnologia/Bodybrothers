import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { AuthContext } from './context'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setAuth] = useState<boolean>(false)
  const [profileRole, setProfileRole] = useState<string | null>(null)
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Verifica sessão atual
    supabase.auth.getSession().then(({ data: { session } }) => {
      void refreshAuthState(session)
    })

    // Escuta mudanças de auth (login, logout, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void refreshAuthState(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function refreshAuthState(sessionOverride?: Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session']) {
    try {
      const session = sessionOverride ?? (await supabase.auth.getSession()).data.session
      setAuth(!!session)

      if (!session?.user) {
        setProfileRole(null)
        setSubscriptionStatus(null)
        return
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, data')
        .eq('id', session.user.id)
        .single<{ role: string | null; data?: { saas?: Record<string, unknown> } | null }>()

      if (profileError) throw profileError

      const role = profile?.role || null
      setProfileRole(role)

      if (role !== 'personal') {
        setSubscriptionStatus(null)
        return
      }

      const { data: subscriptionData, error: subscriptionError } = await supabase
        .from('personal_subscriptions')
        .select('status')
        .eq('personal_id', session.user.id)
        .maybeSingle<{ status: string | null }>()

      if (subscriptionError) {
        console.error('Erro ao carregar personal_subscriptions no auth:', subscriptionError)
      }

      const fallbackStatus = getLegacySubscriptionStatus(profile?.data)
      setSubscriptionStatus(subscriptionData?.status || fallbackStatus)
    } catch (error) {
      console.error('Erro ao sincronizar autenticação:', error)
      setProfileRole(null)
      setSubscriptionStatus(null)
    } finally {
      setLoading(false)
    }
  }

  const login = async (email: string, pass: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: pass,
    })
    
    if (error) {
      console.error('Login error:', error.message)
      return false
    }
    return true
  }

  const logout = async () => {
    await supabase.auth.signOut({ scope: 'local' })
    localStorage.removeItem('personal_branding') // Limpa branding ao sair
    localStorage.removeItem('personal_prefs')    // Limpa preferências ao sair (opcional, mas recomendado)
    setAuth(false)
    setProfileRole(null)
    setSubscriptionStatus(null)
  }

  const value = useMemo(() => ({
    isAuthenticated,
    profileRole,
    subscriptionStatus,
    isSubscriptionRestricted: profileRole === 'personal' && ['past_due', 'blocked'].includes(subscriptionStatus || ''),
    refreshAuthState,
    login,
    logout,
  }), [isAuthenticated, profileRole, subscriptionStatus])

  if (loading) return null // Ou um spinner simples

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

function getLegacySubscriptionStatus(profileData: { saas?: Record<string, unknown> } | null | undefined) {
  const value = profileData?.saas?.subscriptionStatus
  return typeof value === 'string' ? value : null
}
