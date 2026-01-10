import { useState } from 'react'

type Branding = {
  primary: string
  accent: string
  sidebarBg: string
  sidebarHover: string
  buttonBg: string
  buttonText: string
  textColor: string
  brandLogoUrl: string
  brandTitle: string
}

export default function OwnerBranding() {
  const [brandTitle, setBrandTitle] = useState<string>(() => {
    try {
      const raw = localStorage.getItem('owner_branding')
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Branding>
        if (parsed.brandTitle) return parsed.brandTitle
      }
    } catch {
      void 0
    }
    return 'Owner Panel'
  })
  const [brandLogoUrl, setBrandLogoUrl] = useState<string>(() => {
    try {
      const raw = localStorage.getItem('owner_branding')
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Branding>
        if (parsed.brandLogoUrl) return parsed.brandLogoUrl
      }
    } catch {
      void 0
    }
    return ''
  })
  const [primary, setPrimary] = useState<string>(() => {
    try {
      const raw = localStorage.getItem('owner_branding')
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Branding>
        if (parsed.primary) return parsed.primary
      }
    } catch {
      void 0
    }
    const styles = getComputedStyle(document.documentElement)
    const p = styles.getPropertyValue('--owner-primary').trim()
    return p || '#3a86ff'
  })
  const [accent, setAccent] = useState<string>(() => {
    try {
      const raw = localStorage.getItem('owner_branding')
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Branding>
        if (parsed.accent) return parsed.accent
      }
    } catch {
      void 0
    }
    const styles = getComputedStyle(document.documentElement)
    const a = styles.getPropertyValue('--owner-accent').trim()
    return a || '#ffbe0b'
  })
  const [sidebarBg, setSidebarBg] = useState<string>(() => {
    const styles = getComputedStyle(document.documentElement)
    const d = styles.getPropertyValue('--owner-sidebar-bg').trim()
    try {
      const raw = localStorage.getItem('owner_branding')
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Branding>
        if (parsed.sidebarBg) return parsed.sidebarBg
      }
    } catch {
      void 0
    }
    return d || '#0b132b'
  })
  const [sidebarHover, setSidebarHover] = useState<string>(() => {
    const styles = getComputedStyle(document.documentElement)
    const d = styles.getPropertyValue('--owner-sidebar-hover').trim()
    try {
      const raw = localStorage.getItem('owner_branding')
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Branding>
        if (parsed.sidebarHover) return parsed.sidebarHover
      }
    } catch {
      void 0
    }
    return d || '#1c2541'
  })
  const [buttonBg, setButtonBg] = useState<string>(() => {
    try {
      const raw = localStorage.getItem('owner_branding')
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Branding>
        if (parsed.buttonBg) return parsed.buttonBg
      }
    } catch {
      void 0
    }
    return '#3a86ff'
  })
  const [buttonText, setButtonText] = useState<string>(() => {
    try {
      const raw = localStorage.getItem('owner_branding')
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Branding>
        if (parsed.buttonText) return parsed.buttonText
      }
    } catch {
      void 0
    }
    return '#ffffff'
  })
  const [textColor, setTextColor] = useState<string>(() => {
    const styles = getComputedStyle(document.body)
    const d = styles.getPropertyValue('--owner-text').trim()
    try {
      const raw = localStorage.getItem('owner_branding')
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Branding>
        if (parsed.textColor) return parsed.textColor
      }
    } catch {
      void 0
    }
    return d || '#1a202c'
  })
  const [msg, setMsg] = useState('')

  const onLogoFileChange = (file?: File) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result === 'string') {
        setBrandLogoUrl(result)
        setMsg('Logo carregada')
      }
    }
    reader.readAsDataURL(file)
  }

  const save = () => {
    const branding: Branding = { primary, accent, sidebarBg, sidebarHover, buttonBg, buttonText, textColor, brandLogoUrl, brandTitle }
    localStorage.setItem('owner_branding', JSON.stringify(branding))
    document.documentElement.style.setProperty('--owner-primary', primary)
    document.documentElement.style.setProperty('--owner-accent', accent)
    document.documentElement.style.setProperty('--owner-sidebar-bg', sidebarBg)
    document.documentElement.style.setProperty('--owner-sidebar-hover', sidebarHover)
    document.documentElement.style.setProperty('--owner-button-bg', buttonBg)
    document.documentElement.style.setProperty('--owner-button-text', buttonText)
    document.documentElement.style.setProperty('--owner-text', textColor)
    setMsg('Identidade visual atualizada')
    window.dispatchEvent(new Event('owner-branding-changed'))
  }

  return (
    <div style={{ maxWidth: 520 }}>
      <h1>Configurações do Owner • Identidade Visual do Owner</h1>
      <div style={{ marginTop: 12, display: 'grid', gap: 12 }}>
        <label style={{ display: 'grid', gap: 6 }}>
          Título do Painel
          <input value={brandTitle} onChange={(e) => setBrandTitle(e.target.value)} placeholder="Ex.: Bodybrothers" />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          URL da Foto/Logo
          <input value={brandLogoUrl} onChange={(e) => setBrandLogoUrl(e.target.value)} placeholder="https://.../logo.png" />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          Upload de Foto/Logo
          <input type="file" accept="image/*" onChange={(e) => onLogoFileChange(e.target.files?.[0])} />
        </label>
        {brandLogoUrl && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src={brandLogoUrl} alt="Logo" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover' }} />
            <span>Pré-visualização</span>
          </div>
        )}
        <label style={{ display: 'grid', gap: 6 }}>
          Cor dos Botões
          <input type="color" value={primary} onChange={(e) => setPrimary(e.target.value)} />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          Cor de Destaque
          <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          Texto (cor principal)
          <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          Lateral do Menu (fundo)
          <input type="color" value={sidebarBg} onChange={(e) => setSidebarBg(e.target.value)} />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          Lateral do Menu (hover)
          <input type="color" value={sidebarHover} onChange={(e) => setSidebarHover(e.target.value)} />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          Botões (texto)
          <input type="color" value={buttonText} onChange={(e) => setButtonText(e.target.value)} />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          Botões (fundo)
          <input type="color" value={buttonBg} onChange={(e) => setButtonBg(e.target.value)} />
        </label>
        {msg && <div className="login-error" style={{ color: 'green' }}>{msg}</div>}
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="login-submit" onClick={save}>Salvar</button>
        </div>
      </div>
    </div>
  )
}
