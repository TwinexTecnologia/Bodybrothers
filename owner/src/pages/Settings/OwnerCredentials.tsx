import { useState } from 'react'
import { clearOwnerCredentials, getOwnerCredentials, isEnvManaged, setOwnerCredentials } from '../../auth/constants'

export default function OwnerCredentials() {
  const initial = getOwnerCredentials()
  const [user, setUser] = useState(initial.user)
  const [pass, setPass] = useState(initial.pass)
  const [msg, setMsg] = useState('')
  const envManaged = isEnvManaged()

  const save = () => {
    if (!user || !pass) {
      setMsg('Preencha usuário e senha')
      return
    }
    setOwnerCredentials({ user, pass })
    setMsg('Credenciais atualizadas')
  }

  const resetRandom = () => {
    clearOwnerCredentials()
    const c = getOwnerCredentials()
    setUser(c.user)
    setPass(c.pass)
    setMsg('Credenciais aleatórias geradas')
  }

  return (
    <div style={{ maxWidth: 520 }}>
      <h1>Configurações do Owner • Resetar Login e Senha</h1>
      {envManaged && (
        <div className="login-dev-hint" style={{ marginTop: 12 }}>
          Credenciais são gerenciadas por variáveis de ambiente e não podem ser alteradas aqui.
        </div>
      )}
      <div className="login-form" style={{ marginTop: 12 }}>
        <label>
          Usuário
          <input value={user} onChange={(e) => setUser(e.target.value)} placeholder="Novo usuário" />
        </label>
        <label>
          Senha
          <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="Nova senha" />
        </label>
        {msg && <div className="login-error" style={{ color: 'green' }}>{msg}</div>}
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="login-submit" onClick={save} disabled={envManaged}>Salvar</button>
          <button className="login-submit" onClick={resetRandom} disabled={envManaged} style={{ background: 'var(--owner-accent)', color: '#000' }}>Gerar aleatório</button>
        </div>
        
      </div>
    </div>
  )
}
