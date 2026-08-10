import { createContext } from 'react'

export type AuthContextValue = {
  isAuthenticated: boolean
  profileRole: string | null
  subscriptionStatus: string | null
  isSubscriptionRestricted: boolean
  refreshAuthState: () => Promise<void>
  login: (user: string, pass: string) => Promise<boolean>
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)
