import { useState, useEffect } from 'react'
import { useNavigate, useLocation, NavLink, Outlet } from 'react-router-dom'
import { Dumbbell, Utensils, Wallet, LogOut, Home, Menu, X, ClipboardList, User, Camera } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/useAuth'
import PaymentAlert from './PaymentAlert'
import AnamnesisAlert from './AnamnesisAlert'
import NotificationBell from './NotificationBell'

export default function Layout({ children }: { children?: React.ReactNode }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  
  const [mobileOpen, setMobileOpen] = useState(false)
  const [brandTitle, setBrandTitle] = useState('Área do Aluno')
  const [brandLogo, setBrandLogo] = useState('')

  useEffect(() => {
    if (user) {
        loadBranding()
    }
  }, [user])

  async function loadBranding() {
      if (!user) return

      // Busca dados do próprio aluno
      const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, data')
          .eq('id', user.id)
          .single()
      
      if (profile) {
          setBrandTitle(profile.full_name || 'Área do Aluno')
          // Tenta pegar avatarUrl, se não tiver, tenta logoUrl (compatibilidade)
          setBrandLogo(profile.data?.avatarUrl || profile.data?.branding?.logoUrl || '')
      }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const menuItems = [
    { label: 'Visão Geral', icon: <Home size={20} />, path: '/dashboard' },
    { label: 'Meus Treinos', icon: <Dumbbell size={20} />, path: '/workouts' },
    { label: 'Minha Dieta', icon: <Utensils size={20} />, path: '/diets' },
    { label: 'Anamneses', icon: <ClipboardList size={20} />, path: '/anamnesis' },
    { label: 'Evolução Fotográfica', icon: <Camera size={20} />, path: '/evolution' },
    { label: 'Financeiro', icon: <Wallet size={20} />, path: '/financial' },
    { label: 'Minha Conta', icon: <User size={20} />, path: '/account/profile' },
  ]

  return (
    <div className="app-shell">
      
      {/* Mobile Topbar */}
      <div className="mobile-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button 
                onClick={() => setMobileOpen(true)}
                style={{ background: 'transparent', border: 'none', padding: 4, cursor: 'pointer' }}
              >
                  <Menu size={24} color="#111827" />
              </button>
              <span style={{ fontWeight: 600, fontSize: '1.1rem', color: '#111827' }}>
                  BodyBrothers
              </span>
          </div>
          <NotificationBell />
      </div>

      {/* Overlay Mobile */}
      {mobileOpen && (
          <div 
            className="sidebar-overlay"
            onClick={() => setMobileOpen(false)}
          />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
        <div style={{ padding: 24, display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#fff', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid rgba(255,255,255,0.2)' }}>
                {brandLogo ? (
                    <img 
                        src={brandLogo} 
                        alt="Avatar"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                        onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.parentElement!.innerText = '👤';
                        }}
                    />
                ) : (
                    <span style={{fontSize: '1.2rem'}}>👤</span>
                )}
            </div>
            <span style={{ fontWeight: 600, fontSize: '1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {brandTitle}
            </span>
            {/* Fechar Mobile */}
            <button 
                className="mobile-close-btn"
                onClick={() => setMobileOpen(false)}
                style={{ 
                    marginLeft: 'auto', background: 'transparent', border: 'none', 
                    color: '#fff', cursor: 'pointer', display: 'none' // CSS controla display no mobile
                }}
            >
                <X size={24} />
            </button>
        </div>

        <nav style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {menuItems.map(item => {
                const isActive = location.pathname === item.path
                return (
                    <NavLink 
                        key={item.path} 
                        to={item.path}
                        onClick={() => setMobileOpen(false)} // Fecha ao clicar
                        style={{
                            display: 'flex', alignItems: 'center', gap: 12,
                            padding: '12px 16px', borderRadius: 8,
                            textDecoration: 'none',
                            color: isActive ? 'var(--sidebar-active-text)' : 'var(--sidebar-text)',
                            background: isActive ? 'var(--sidebar-active-bg)' : 'transparent',
                            transition: 'all 0.2s',
                            fontWeight: isActive ? 600 : 400
                        }}
                    >
                        {item.icon}
                        {item.label}
                    </NavLink>
                )
            })}
        </nav>

        <div style={{ padding: 16, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <button 
                onClick={handleLogout}
                style={{ 
                    width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 16px', borderRadius: 8,
                    background: 'transparent', border: 'none',
                    color: '#ef4444', cursor: 'pointer',
                    transition: 'background 0.2s',
                    textAlign: 'left'
                }}
            >
                <LogOut size={20} />
                Sair
            </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        <PaymentAlert />
        <AnamnesisAlert />
        
        {/* Desktop Notification (escondido no mobile pois já está na topbar) */}
        <div style={{ position: 'absolute', top: 20, right: 20, display: 'none' }} className="desktop-notification">
             <NotificationBell />
        </div>
        
        {children || <Outlet />}
      </main>

      <style>{`
        @media (min-width: 769px) {
            .desktop-notification { display: block !important; }
        }
        @media (max-width: 768px) {
            .mobile-close-btn { display: block !important; }
        }
      `}</style>
    </div>
  )
}
