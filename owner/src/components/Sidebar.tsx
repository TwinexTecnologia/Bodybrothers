import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'

type Branding = { brandTitle?: string; brandLogoUrl?: string }

export default function Sidebar() {
  const [open, setOpen] = useState<Record<string, boolean>>({
    dashboard: true,
    personals: true,
    billing: true,
    settings: true,
  })
  const [branding, setBranding] = useState<Branding>(() => {
    try {
      const raw = localStorage.getItem('owner_branding')
      if (raw) return JSON.parse(raw) as Branding
    } catch {
      void 0
    }
    return { brandTitle: 'Owner Panel' }
  })

  useEffect(() => {
    const onBrandingChanged = () => {
      try {
        const raw = localStorage.getItem('owner_branding')
        if (!raw) return
        setBranding(JSON.parse(raw) as Branding)
      } catch {
        void 0
      }
    }
    window.addEventListener('owner-branding-changed', onBrandingChanged)
    return () => window.removeEventListener('owner-branding-changed', onBrandingChanged)
  }, [])

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        {branding.brandLogoUrl ? (
          <img src={branding.brandLogoUrl} alt="Logo" className="brand-logo" />
        ) : (
          <div className="brand-mark" />
        )}
        <span className="brand-title">{branding.brandTitle || 'Owner Panel'}</span>
      </div>
      <nav className="menu">
        <div className="menu-section">
          <button className="menu-button" onClick={() => setOpen({ ...open, dashboard: !open.dashboard })}>
            <span>Dashboard</span>
            <span>{open.dashboard ? '▾' : '▸'}</span>
          </button>
          {open.dashboard && (
            <div className="submenu">
              <NavLink to="/dashboard/overview" className={({ isActive }) => (isActive ? 'active' : undefined)}>Visão Geral</NavLink>
            </div>
          )}
        </div>

        <div className="menu-section">
          <button className="menu-button" onClick={() => setOpen({ ...open, personals: !open.personals })}>
            <span>Gerenciar Personais</span>
            <span>{open.personals ? '▾' : '▸'}</span>
          </button>
          {open.personals && (
            <div className="submenu">
              <NavLink to="/personals/list" className={({ isActive }) => (isActive ? 'active' : undefined)}>Listar Personais</NavLink>
              <NavLink to="/personals/students" className={({ isActive }) => (isActive ? 'active' : undefined)}>Ver Alunos de um Personal</NavLink>
              <NavLink to="/personals/permissions" className={({ isActive }) => (isActive ? 'active' : undefined)}>Permissões de Acesso</NavLink>
              <NavLink to="/personals/branding" className={({ isActive }) => (isActive ? 'active' : undefined)}>Branding do Personal</NavLink>
            </div>
          )}
        </div>

        <div className="menu-section">
          <button className="menu-button" onClick={() => setOpen({ ...open, billing: !open.billing })}>
            <span>Cobrança dos Personais</span>
            <span>{open.billing ? '▾' : '▸'}</span>
          </button>
          {open.billing && (
            <div className="submenu">
              <NavLink to="/billing/by-personal" className={({ isActive }) => (isActive ? 'active' : undefined)}>Visão por Personal</NavLink>
            </div>
          )}
        </div>

        <div className="menu-section">
          <button className="menu-button" onClick={() => setOpen({ ...open, settings: !open.settings })}>
            <span>Configurações do Owner</span>
            <span>{open.settings ? '▾' : '▸'}</span>
          </button>
          {open.settings && (
            <div className="submenu">
              <NavLink to="/settings/owner-branding" className={({ isActive }) => (isActive ? 'active' : undefined)}>Identidade Visual do Owner</NavLink>
              <NavLink to="/settings/system-preferences" className={({ isActive }) => (isActive ? 'active' : undefined)}>Preferências do Sistema</NavLink>
              <NavLink to="/settings/owner-credentials" className={({ isActive }) => (isActive ? 'active' : undefined)}>Resetar Login e Senha</NavLink>
            </div>
          )}
        </div>

        <div className="menu-section">
          <div className="submenu">
            <NavLink to="/logout" className={({ isActive }) => (isActive ? 'active' : undefined)}>Sair</NavLink>
          </div>
        </div>
      </nav>
    </aside>
  )
}
