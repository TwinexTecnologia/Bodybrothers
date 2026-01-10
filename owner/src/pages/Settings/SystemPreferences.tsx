import { useState } from 'react'

type Prefs = {
  compact: boolean
  showTopbar: boolean
}

export default function SystemPreferences() {
  const [compact, setCompact] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem('owner_prefs')
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Prefs>
        return !!parsed.compact
      }
    } catch {
      void 0
    }
    return false
  })
  const [showTopbar, setShowTopbar] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem('owner_prefs')
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Prefs>
        return parsed.showTopbar !== false
      }
    } catch {
      void 0
    }
    return true
  })
  const [msg, setMsg] = useState('')

  const save = () => {
    const prefs: Prefs = { compact, showTopbar }
    localStorage.setItem('owner_prefs', JSON.stringify(prefs))
    setMsg('Preferências salvas')
    window.dispatchEvent(new Event('owner-prefs-changed'))
  }

  return (
    <div style={{ maxWidth: 520 }}>
      <h1>Configurações do Owner • Preferências do Sistema</h1>
      <div style={{ marginTop: 12, display: 'grid', gap: 12 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={compact} onChange={(e) => setCompact(e.target.checked)} />
          Layout compacto
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={showTopbar} onChange={(e) => setShowTopbar(e.target.checked)} />
          Mostrar barra superior
        </label>
        {msg && <div className="login-error" style={{ color: 'green' }}>{msg}</div>}
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="login-submit" onClick={save}>Salvar</button>
        </div>
      </div>
    </div>
  )
}
