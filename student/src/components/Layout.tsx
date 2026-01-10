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
    <div className="app-shell" style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      
      {/* Top Right Actions */}
      <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, display: 'flex', gap: 16, alignItems: 'center' }}>
          <NotificationBell />
          
          <button 
            className="mobile-toggle"
            onClick={() => setMobileOpen(!mobileOpen)}
            style={{ 
                background: 'transparent', border: 'none', padding: 8, cursor: 'pointer',
                color: '#64748b'
            }}
          >
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
      </div>

      <PaymentAlert />
      <AnamnesisAlert />

      {/* Sidebar */}
      <aside 
        style={{ 
            width: 260, 
            background: 'var(--sidebar-bg)', 
            color: 'var(--sidebar-text)',
            display: 'flex', flexDirection: 'column',
            borderRight: '1px solid #e2e8f0',
            position: 'fixed', top: 0, bottom: 0, left: 0,
            zIndex: 1000,
            transition: 'transform 0.3s ease',
            // No mobile, transform translate se fechado. No desktop sempre visível.
            // Vou simplificar assumindo desktop-first aqui como pedido "estilo personal"
        }}
      >
        <div style={{ padding: 24, display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#fff', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid rgba(255,255,255,0.2)' }}>
                {brandLogo ? (
                    <img 
                        src={brandLogo} 
                        alt="Avatar"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                        onError={(e) => {
                            console.log('Erro ao carregar imagem:', brandLogo);
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
        </div>

        <nav style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {menuItems.map(item => {
                const isActive = location.pathname === item.path
                return (
                    <NavLink 
                        key={item.path} 
                        to={item.path}
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
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
                <LogOut size={20} />
                Sair
            </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main style={{ 
          marginLeft: 260, // Largura da sidebar
          flex: 1, 
          padding: 32,
          maxWidth: 1200,
          width: '100%'
      }}>
        {children || <Outlet />}
      </main>

    </div>
  )
}
