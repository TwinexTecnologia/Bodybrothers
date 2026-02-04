import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { X } from 'lucide-react'

type Branding = { brandTitle?: string; brandLogoUrl?: string }

interface SidebarProps {
    isOpen?: boolean
    onClose?: () => void
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const [open, setOpen] = useState<Record<string, boolean>>({
    dashboard: true,
    students: true,
    protocols: true,
    chat: true,
    finance: true,
    account: true,
  })
  const [branding, setBranding] = useState<Branding>(() => {
    try {
      const raw = localStorage.getItem('personal_branding')
      if (raw) return JSON.parse(raw) as Branding
    } catch {
      void 0
    }
    return { brandTitle: 'Personal Panel' }
  })
  
  const [perms, setPerms] = useState<Record<string, boolean> | null>(null)
  const [evolutionMode, setEvolutionMode] = useState<string>('anamnesis') // anamnesis | standalone

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) {
            supabase.from('profiles').select('data').eq('id', user.id).single()
                .then(({ data }) => {
                    const profileData = data?.data || {}
                    
                    // 1. Carregar Permissões
                    if (profileData.permissions) setPerms(profileData.permissions)
                    else setPerms({}) 
                    
                    // 2. Carregar Modo de Evolução
                    if (profileData.config?.evolutionMode) {
                        setEvolutionMode(profileData.config.evolutionMode)
                    }

                    // 3. Carregar Branding e atualizar LocalStorage para limpar cache antigo
                    if (profileData.branding) {
                        const newBranding = {
                            brandTitle: profileData.branding.brandName || 'Personal Panel',
                            brandLogoUrl: profileData.branding.logoUrl || ''
                        }
                        setBranding(newBranding)
                        localStorage.setItem('personal_branding', JSON.stringify(newBranding))
                    } else {
                        // Se não tiver branding, limpa o antigo para não mostrar lixo de outro user
                        const defaultBranding = { brandTitle: 'Personal Panel', brandLogoUrl: '' }
                        setBranding(defaultBranding)
                        localStorage.setItem('personal_branding', JSON.stringify(defaultBranding))
                    }
                })
        }
    })
  }, [])

  const canAccess = (key: string) => {
      if (!perms || Object.keys(perms).length === 0) return true
      return perms[key] !== false
  }

  useEffect(() => {
    const onBrandingChanged = () => {
      try {
        const raw = localStorage.getItem('personal_branding')
        if (!raw) return
        setBranding(JSON.parse(raw) as Branding)
      } catch {
        void 0
      }
    }
    window.addEventListener('personal-branding-changed', onBrandingChanged)
    return () => window.removeEventListener('personal-branding-changed', onBrandingChanged)
  }, [])

  return (
    <aside className={`sidebar ${isOpen ? 'mobile-open' : ''}`}>
      <div className="sidebar-header">
        {branding.brandLogoUrl ? (
          <img src={branding.brandLogoUrl} alt="Logo" className="brand-logo" />
        ) : (
          <div className="brand-mark" />
        )}
        <span className="brand-title">{branding.brandTitle || 'Personal Panel'}</span>
        
        {/* Botão de Fechar Mobile */}
        <button 
            onClick={onClose}
            className="mobile-close-btn"
            style={{ 
                background: 'transparent', border: 'none', color: '#fff', 
                marginLeft: 'auto', cursor: 'pointer', display: 'none' // display none por padrão, CSS ativa no mobile
            }}
        >
            <X size={24} />
        </button>
      </div>
      <nav className="menu">
        {canAccess('dashboard') && (
        <div className="menu-section">
          <button className="menu-button" onClick={() => setOpen({ ...open, dashboard: !open.dashboard })}>
            <span>Dashboard</span>
            <span>{open.dashboard ? '▾' : '▸'}</span>
          </button>
          {open.dashboard && (
            <div className="submenu">
              <NavLink to="/dashboard/overview">Visão Geral</NavLink>
              <NavLink to="/crm" style={{ color: '#8b5cf6' }}>CRM • Vendas</NavLink>
            </div>
          )}
        </div>
        )}

        {canAccess('students') && (
        <div className="menu-section">
          <button className="menu-button" onClick={() => setOpen({ ...open, students: !open.students })}>
            <span>Alunos</span>
            <span>{open.students ? '▾' : '▸'}</span>
          </button>
          {open.students && (
            <div className="submenu">
              <NavLink to="/students/list">Gerenciar Alunos</NavLink>
              {evolutionMode === 'standalone' && (
                  <NavLink to="/evolution/central" style={{ color: '#0ea5e9' }}>📸 Evolução Fotográfica</NavLink>
              )}
            </div>
          )}
        </div>
        )}

        {canAccess('protocols') && (
        <div className="menu-section">
          <button className="menu-button" onClick={() => setOpen({ ...open, protocols: !open.protocols })}>
            <span>Protocolos</span>
            <span>{open.protocols ? '▾' : '▸'}</span>
          </button>
          {open.protocols && (
            <div className="submenu">
              <NavLink to="/protocols/workout-create">Criar Treino</NavLink>
              <NavLink to="/protocols/workouts-active">Treinos Ativos</NavLink>
              <NavLink to="/protocols/workouts-archived">Treinos Inativos/Arquivados</NavLink>
              <NavLink to="/protocols/exercises">Biblioteca de Exercícios</NavLink>
              <NavLink to="/protocols/diet-create">Criar Dieta</NavLink>
              <NavLink to="/protocols/diets-active">Dietas Ativas</NavLink>
              <NavLink to="/protocols/diets-archived">Dietas Arquivadas</NavLink>
              <NavLink to="/protocols/anamnesis-models">Anamnese (Modelos)</NavLink>
              <NavLink to="/protocols/plan-create">Criar Plano</NavLink>
              <NavLink to="/protocols/plans">Planos</NavLink>
            </div>
          )}
        </div>
        )}

        {/* Chat Section Commented Out
        {canAccess('chat') && (
        <div className="menu-section">
          <button className="menu-button" onClick={() => setOpen({ ...open, chat: !open.chat })}>
            <span>Chat</span>
            <span>{open.chat ? '▾' : '▸'}</span>
          </button>
          {open.chat && (
            <div className="submenu">
              <NavLink to="/chat/conversations">Chats com Alunos</NavLink>
              <NavLink to="/chat/history">Histórico de Conversas</NavLink>
            </div>
          )}
        </div>
        )}
        */}

        {canAccess('finance') && (
        <div className="menu-section">
          <button className="menu-button" onClick={() => setOpen({ ...open, finance: !open.finance })}>
            <span>Financeiro do Aluno</span>
            <span>{open.finance ? '▾' : '▸'}</span>
          </button>
          {open.finance && (
            <div className="submenu">
              <NavLink to="/financial">Mensalidades</NavLink>
            </div>
          )}
        </div>
        )}

        {canAccess('account') && (
        <div className="menu-section">
          <button className="menu-button" onClick={() => setOpen({ ...open, account: !open.account })}>
            <span>Minha Conta</span>
            <span>{open.account ? '▾' : '▸'}</span>
          </button>
          {open.account && (
            <div className="submenu">
              <NavLink to="/account/profile">Perfil do Personal</NavLink>
              <NavLink to="/account/branding">Identidade Visual</NavLink>
              <NavLink to="/account/preferences">Preferências</NavLink>
            </div>
          )}
        </div>
        )}

        <div className="menu-section">
          <div className="submenu">
            <NavLink to="/logout">Sair</NavLink>
          </div>
        </div>
      </nav>
    </aside>
  )
}
