import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { AuthContext } from './context'
import type { User } from '@supabase/supabase-js'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
      if (session?.user) {
          updateLastLogin(session.user.id)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
      if (event === 'SIGNED_IN' && session?.user) {
          updateLastLogin(session.user.id)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const updateLastLogin = async (userId: string) => {
      await supabase
          .from('profiles')
          .update({ last_login_at: new Date() })
          .eq('id', userId)
  }

  const login = async (email: string, pass: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: pass
    })
    
    if (error) {
        console.error('Login error:', error.message)
        // Se a senha estiver errada, retorna false para o componente exibir erro
        return false
    }
    return true
  }

  return (
    <AuthContext.Provider value={{ user, loading, isAuthenticated: !!user, login }}>
      {children}
    </AuthContext.Provider>
  )
}
