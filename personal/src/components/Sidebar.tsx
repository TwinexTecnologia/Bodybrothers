import { useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  X,
  Plus,
  Dumbbell,
  Utensils,
  FilePlus2,
  Home,
  PieChart,
  TrendingUp,
  Users,
  ClipboardList,
  CreditCard,
  ListChecks,
  CirclePlay,
  Archive,
  BookOpen,
  List,
  Apple,
  FileText,
  Wallet,
  UserCircle2,
  Palette,
  SlidersHorizontal,
  Camera,
  LogOut,
  type LucideIcon,
} from 'lucide-react'

type Branding = { brandTitle?: string; brandLogoUrl?: string }

interface SidebarProps {
    isOpen?: boolean
    onClose?: () => void
}

type MenuItem = {
  label: string
  to: string
  icon: LucideIcon
  accent?: boolean
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
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

  const quickActions = useMemo<MenuItem[]>(() => ([
    { label: 'Novo Treino', to: '/protocols/workout-create', icon: Dumbbell },
    { label: 'Nova Dieta', to: '/protocols/diet-create', icon: Utensils },
    { label: 'Novo Plano', to: '/protocols/plan-create', icon: FilePlus2 },
  ]), [])

  const dashboardItems = useMemo<MenuItem[]>(() => ([
    { label: 'Dashboard', to: '/dashboard/overview', icon: Home },
    { label: 'Visão Geral', to: '/crm/dashboard', icon: PieChart },
    { label: 'CRM • Vendas', to: '/crm', icon: TrendingUp, accent: true },
  ]), [])

  const studentItems = useMemo<MenuItem[]>(() => {
    const items: MenuItem[] = [
      { label: 'Gerenciar Alunos', to: '/students/list', icon: Users },
      { label: 'Anamneses', to: '/protocols/anamnesis-pending', icon: ClipboardList },
      { label: 'Mensalidades', to: '/financial', icon: CreditCard },
    ]

    if (evolutionMode === 'standalone') {
      items.push({ label: 'Evolução Fotográfica', to: '/evolution/central', icon: Camera })
    }

    return items
  }, [evolutionMode])

  const workoutItems = useMemo<MenuItem[]>(() => ([
    { label: 'Criar Treino', to: '/protocols/workout-create', icon: Dumbbell },
    { label: 'Todos os Treinos', to: '/protocols/workouts-active', icon: ListChecks },
    { label: 'Treinos Ativos', to: '/protocols/workouts-active', icon: CirclePlay },
    { label: 'Treinos Arquivados', to: '/protocols/workouts-archived', icon: Archive },
    { label: 'Biblioteca de Exercícios', to: '/protocols/exercises', icon: BookOpen },
  ]), [])

  const dietItems = useMemo<MenuItem[]>(() => ([
    { label: 'Criar Dieta', to: '/protocols/diet-create', icon: Utensils },
    { label: 'Todas as Dietas', to: '/protocols/diets-active', icon: List },
    { label: 'Dietas Ativas', to: '/protocols/diets-active', icon: Apple },
    { label: 'Dietas Arquivadas', to: '/protocols/diets-archived', icon: Archive },
  ]), [])

  const planItems = useMemo<MenuItem[]>(() => ([
    { label: 'Criar Plano', to: '/protocols/plan-create', icon: FilePlus2 },
    { label: 'Gerenciar Planos', to: '/protocols/plans', icon: FileText },
  ]), [])

  const financeItems = useMemo<MenuItem[]>(() => ([
    { label: 'Financeiro', to: '/financial', icon: Wallet },
  ]), [])

  const settingsItems = useMemo<MenuItem[]>(() => {
    const items: MenuItem[] = [
      { label: 'Perfil do Personal', to: '/account/profile', icon: UserCircle2 },
      { label: 'Identidade Visual', to: '/account/branding', icon: Palette },
      { label: 'Preferências', to: '/account/preferences', icon: SlidersHorizontal },
    ]

    if (evolutionMode === 'standalone') {
      items.push({ label: 'Configurar Evolução', to: '/account/profile', icon: Camera })
    }

    return items
  }, [evolutionMode])

  const renderMenuItem = (item: MenuItem, compact = false) => {
    const Icon = item.icon

    return (
      <NavLink
        key={`${item.to}-${item.label}`}
        to={item.to}
        className={({ isActive }) =>
          `sidebar-link ${compact ? 'sidebar-link-compact' : ''} ${isActive ? 'active' : ''} ${item.accent ? 'accent-link' : ''}`
        }
        onClick={onClose}
      >
        <Icon size={compact ? 15 : 17} strokeWidth={2} />
        <span>{item.label}</span>
      </NavLink>
    )
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
      <div className="sidebar-quick-card">
        <div className="sidebar-quick-card-title">
          <div className="sidebar-quick-card-badge">
            <Plus size={14} />
          </div>
          <span>Novo</span>
        </div>
        <div className="sidebar-quick-actions">
          {quickActions.map(item => renderMenuItem(item, true))}
        </div>
      </div>
      <nav className="menu">
        {canAccess('dashboard') && (
          <div className="sidebar-group">
            <div className="sidebar-group-title">Dashboard</div>
            <div className="sidebar-group-links">
              {dashboardItems.map(item => renderMenuItem(item))}
            </div>
          </div>
        )}

        {canAccess('students') && (
          <div className="sidebar-group">
            <div className="sidebar-group-title">Alunos</div>
            <div className="sidebar-group-links">
              {studentItems.map(item => renderMenuItem(item))}
            </div>
          </div>
        )}

        {canAccess('protocols') && (
          <>
            <div className="sidebar-group">
              <div className="sidebar-group-title">Treinos</div>
              <div className="sidebar-group-links">
                {workoutItems.map(item => renderMenuItem(item))}
              </div>
            </div>

            <div className="sidebar-group">
              <div className="sidebar-group-title">Dietas</div>
              <div className="sidebar-group-links">
                {dietItems.map(item => renderMenuItem(item))}
              </div>
            </div>

            <div className="sidebar-group">
              <div className="sidebar-group-title">Planos</div>
              <div className="sidebar-group-links">
                {planItems.map(item => renderMenuItem(item))}
              </div>
            </div>
          </>
        )}

        {canAccess('finance') && (
          <div className="sidebar-group">
            <div className="sidebar-group-title">Financeiro</div>
            <div className="sidebar-group-links">
              {financeItems.map(item => renderMenuItem(item))}
            </div>
          </div>
        )}

        {canAccess('account') && (
          <div className="sidebar-group">
            <div className="sidebar-group-title">Configurações</div>
            <div className="sidebar-group-links">
              {settingsItems.map(item => renderMenuItem(item))}
            </div>
          </div>
        )}

        <div className="sidebar-group sidebar-group-system">
          <div className="sidebar-group-title">Sistema</div>
          <div className="sidebar-group-links">
            <NavLink to="/logout" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} onClick={onClose}>
              <LogOut size={17} strokeWidth={2} />
              <span>Sair</span>
            </NavLink>
          </div>
        </div>
      </nav>
    </aside>
  )
}
