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
      if (session?.user) {
          checkStatus(session.user.id)
          updateLastLogin(session.user.id)
      } else {
          setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
      if (event === 'SIGNED_IN' && session?.user) {
          checkStatus(session.user.id)
          updateLastLogin(session.user.id)
      } else if (!session) {
          setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const checkStatus = async (userId: string) => {
      try {
          const { data, error } = await supabase
              .from('profiles')
              .select('status')
              .eq('id', userId)
              .single()
          
          if (data && data.status !== 'active') {
              console.warn('Usuário inativo. Realizando logout forçado.')
              await supabase.auth.signOut()
              setUser(null)
              alert('Sua conta foi inativada. Entre em contato com seu personal.')
          }
      } catch (err) {
          console.error('Erro ao verificar status:', err)
      } finally {
          setLoading(false)
      }
  }

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
