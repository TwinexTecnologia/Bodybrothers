import { useEffect, useMemo, useState } from 'react'
import Sidebar from './components/Sidebar'
import Layout from './components/Layout'
import AppRoutes from './routes'
import { AuthProvider } from './auth/AuthContext'
import { useLocation } from 'react-router-dom'
import NotificationBellV2 from './components/NotificationBellV2'

export default function App() {
  const location = useLocation()
  const isLogin = location.pathname.startsWith('/login')
  const [prefs, setPrefs] = useState<{ compact: boolean; showTopbar: boolean }>(() => {
    try {
      const raw = localStorage.getItem('personal_prefs')
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
        const raw = localStorage.getItem('personal_prefs')
        if (!raw) return
        const parsed = JSON.parse(raw) as Partial<{ compact: boolean; showTopbar: boolean }>
        setPrefs({ compact: !!parsed.compact, showTopbar: parsed.showTopbar !== false })
      } catch { void 0 }
    }
    window.addEventListener('personal-prefs-changed', onPrefsChanged)
    return () => window.removeEventListener('personal-prefs-changed', onPrefsChanged)
  }, [])
  return (
    <AuthProvider>
      {isLogin ? (
        <AppRoutes />
      ) : (
        <Layout>
          <Sidebar />
          <div className="main">
            <div className="topbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong>Painel do Personal</strong>
              {/* <NotificationBellV2 /> */}
            </div>
            <div className="content" style={contentStyle}>
              <AppRoutes />
            </div>
          </div>
        </Layout>
      )}
    </AuthProvider>
  )
}
