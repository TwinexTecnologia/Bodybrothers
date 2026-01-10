import { useEffect, useMemo, useState } from 'react'
import Sidebar from './components/Sidebar'
import Layout from './components/Layout'
import AppRoutes from './routes'
import { AuthProvider } from './auth/AuthContext'
import { useLocation } from 'react-router-dom'
import { Menu } from 'lucide-react'

export default function App() {
  const location = useLocation()
  const isLogin = location.pathname.startsWith('/login')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Fecha sidebar ao mudar de rota (navegação mobile)
  useEffect(() => {
      setSidebarOpen(false)
  }, [location.pathname])

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
          {/* Overlay Mobile */}
          {sidebarOpen && (
              <div 
                  className="sidebar-overlay"
                  onClick={() => setSidebarOpen(false)}
                  style={{
                      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 999
                  }}
              />
          )}

          <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
          
          <div className="main">
            <div className="topbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button 
                      className="menu-toggle-btn"
                      onClick={() => setSidebarOpen(true)}
                      style={{ 
                          background: 'transparent', border: 'none', cursor: 'pointer', 
                          display: 'none', alignItems: 'center', justifyContent: 'center'
                      }}
                  >
                      <Menu size={24} color="#374151" />
                  </button>
                  <strong>Painel do Personal</strong>
              </div>
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
