import { createContext } from 'react'

export type AuthContextValue = {
  isAuthenticated: boolean
  login: (user: string, pass: string) => Promise<boolean>
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)
