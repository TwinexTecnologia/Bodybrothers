import Sidebar from './components/Sidebar'
import Layout from './components/Layout'
import AppRoutes from './routes'
import { AuthProvider } from './auth/AuthContext'
import { useLocation } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'

export default function App() {
  const location = useLocation()
  const isLogin = location.pathname.startsWith('/login')
  const [prefs, setPrefs] = useState<{ compact: boolean; showTopbar: boolean }>(() => {
    try {
      const raw = localStorage.getItem('owner_prefs')
      if (!raw) return { compact: false, showTopbar: true }
      const parsed = JSON.parse(raw) as Partial<{ compact: boolean; showTopbar: boolean }>
      return { compact: !!parsed.compact, showTopbar: parsed.showTopbar !== false }
    } catch {
      void 0
      return { compact: false, showTopbar: true }
    }
  })
  const contentStyle = useMemo(() => ({ padding: prefs.compact ? 8 : 20 }), [prefs])
  useEffect(() => {
    const onPrefsChanged = () => {
      try {
        const raw = localStorage.getItem('owner_prefs')
        if (!raw) return
        const parsed = JSON.parse(raw) as Partial<{ compact: boolean; showTopbar: boolean }>
        setPrefs({ compact: !!parsed.compact, showTopbar: parsed.showTopbar !== false })
      } catch {
        void 0
      }
    }
    window.addEventListener('owner-prefs-changed', onPrefsChanged)
    return () => window.removeEventListener('owner-prefs-changed', onPrefsChanged)
  }, [])
  return (
    <AuthProvider>
      {isLogin ? (
        <AppRoutes />
      ) : (
        <Layout>
          <Sidebar />
          <div className="main">
            {prefs.showTopbar && (
              <div className="topbar">
                <strong>Painel do Owner</strong>
              </div>
            )}
            <div className="content" style={contentStyle}>
              <AppRoutes />
            </div>
          </div>
        </Layout>
      )}
    </AuthProvider>
  )
}
