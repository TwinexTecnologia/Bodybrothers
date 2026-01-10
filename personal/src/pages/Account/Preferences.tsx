import { useState } from 'react'

type Prefs = { compact: boolean; showTopbar: boolean; language: string; notificationsEmail: boolean; notificationsPush: boolean }

export default function Preferences() {
  const [compact, setCompact] = useState<boolean>(() => {
    try { const raw = localStorage.getItem('personal_prefs'); if (raw) return !!(JSON.parse(raw) as Partial<Prefs>).compact } catch { void 0 }
    return false
  })
  const [showTopbar, setShowTopbar] = useState<boolean>(() => {
    try { const raw = localStorage.getItem('personal_prefs'); if (raw) return (JSON.parse(raw) as Partial<Prefs>).showTopbar !== false } catch { void 0 }
    return true
  })
  const [language, setLanguage] = useState<string>(() => {
    try { const raw = localStorage.getItem('personal_prefs'); if (raw) return (JSON.parse(raw) as Partial<Prefs>).language || 'pt-BR' } catch { void 0 }
    return 'pt-BR'
  })
  const [notificationsEmail, setNotificationsEmail] = useState<boolean>(() => {
    try { const raw = localStorage.getItem('personal_prefs'); if (raw) return !!(JSON.parse(raw) as Partial<Prefs>).notificationsEmail } catch { void 0 }
    return true
  })
  const [notificationsPush, setNotificationsPush] = useState<boolean>(() => {
    try { const raw = localStorage.getItem('personal_prefs'); if (raw) return !!(JSON.parse(raw) as Partial<Prefs>).notificationsPush } catch { void 0 }
    return true
  })
  const [msg, setMsg] = useState('')

  const save = () => {
    const prefs: Prefs = { compact, showTopbar, language, notificationsEmail, notificationsPush }
    localStorage.setItem('personal_prefs', JSON.stringify(prefs))
    setMsg('Preferências salvas')
    window.dispatchEvent(new Event('personal-prefs-changed'))
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <h1>Minha Conta • Preferências</h1>
      <div style={{ display: 'grid', gap: 12 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={compact} onChange={(e) => setCompact(e.target.checked)} />
          Layout compacto
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={showTopbar} onChange={(e) => setShowTopbar(e.target.checked)} />
          Mostrar barra superior
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          Idioma
          <select value={language} onChange={(e) => setLanguage(e.target.value)}>
            <option value="pt-BR">Português (Brasil)</option>
            <option value="en-US">English (US)</option>
            <option value="es-ES">Español</option>
          </select>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={notificationsEmail} onChange={(e) => setNotificationsEmail(e.target.checked)} />
          Notificações por Email
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={notificationsPush} onChange={(e) => setNotificationsPush(e.target.checked)} />
          Notificações Push
        </label>
        {msg && <div style={{ color: 'green' }}>{msg}</div>}
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn" onClick={save}>Salvar</button>
        </div>
      </div>
    </div>
  )
}
