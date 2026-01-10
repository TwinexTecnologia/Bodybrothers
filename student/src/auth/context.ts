import { createContext } from 'react'
import type { User } from '@supabase/supabase-js'

export type AuthContextType = {
  user: User | null
  loading: boolean
  isAuthenticated: boolean
  login: (email: string, pass: string) => Promise<boolean>
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isAuthenticated: false,
  login: async () => false
})
