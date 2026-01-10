import { useEffect } from 'react'

function setSynced(email: string, payload: { id?: string; password: string }) {
  try {
    const raw = localStorage.getItem('personal_synced_users')
    const map = raw ? (JSON.parse(raw) as Record<string, { id?: string; password: string }>) : {}
    map[email.trim().toLowerCase()] = payload
    localStorage.setItem('personal_synced_users', JSON.stringify(map))
  } catch {
    void 0
  }
}

export default function SyncCredentials() {
  useEffect(() => {
    const url = new URL(window.location.href)
    const email = url.searchParams.get('email')
    const password = url.searchParams.get('password')
    const id = url.searchParams.get('id') || undefined
    if (email && password) {
      setSynced(email, { id, password })
      setTimeout(() => window.close(), 800)
    }
  }, [])
  return (
    <div style={{ display: 'grid', placeItems: 'center', height: '100vh' }}>
      <div style={{ padding: 20, borderRadius: 12, background: '#fff', boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }}>
        <strong>Sincronizando credenciais...</strong>
      </div>
    </div>
  )
}
