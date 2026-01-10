import { useEffect, useContext, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { AuthContext } from './context'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setAuth] = useState<boolean>(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      checkRole(session)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      checkRole(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  const checkRole = async (session: any) => {
    if (!session?.user) {
      setAuth(false)
      setLoading(false)
      return
    }

    // Verifica se é owner buscando no banco
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', session.user.id)
            .single()

        // Se der erro ou role não for 'owner', nega acesso
        if (error || data?.role !== 'owner') {
            console.warn('Acesso negado: Usuário não é owner', data?.role)
            await supabase.auth.signOut()
            setAuth(false)
        } else {
            setAuth(true)
        }
    } catch (err) {
        console.error('Erro ao verificar role', err)
        await supabase.auth.signOut()
        setAuth(false)
    } finally {
        setLoading(false)
    }
  }

  const login = async (user: string, pass: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: user,
      password: pass
    })
    
    if (error) {
      console.error(error)
      return false
    }
    
    // Verificação extra pós-login
    if (data.session) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', data.session.user.id)
            .single()
            
        if (profile?.role !== 'owner') {
            await supabase.auth.signOut()
            return false // Retorna falso se não for owner
        }
    }

    return true
  }

  const logout = async () => {
    await supabase.auth.signOut()
    setAuth(false)
  }

  const value = useMemo(() => ({ isAuthenticated, login, logout }), [isAuthenticated])

  if (loading) return null

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const ctx = useContext(AuthContext)
  const isAuthenticated = !!ctx?.isAuthenticated
  if (!isAuthenticated) return null
  return children
}
