import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { AuthContext } from './context'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setAuth] = useState<boolean>(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Verifica sessão atual
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuth(!!session)
      setLoading(false)
    })

    // Escuta mudanças de auth (login, logout, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuth(!!session)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

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
    await supabase.auth.signOut()
    localStorage.removeItem('personal_branding') // Limpa branding ao sair
    localStorage.removeItem('personal_prefs')    // Limpa preferências ao sair (opcional, mas recomendado)
    setAuth(false)
  }

  const value = useMemo(() => ({ isAuthenticated, login, logout }), [isAuthenticated])

  if (loading) return null // Ou um spinner simples

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
