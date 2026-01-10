import { useState } from 'react'
import PersonalSelector from '../../components/PersonalSelector'
import PersonalBadge from '../../components/PersonalBadge'
import { updatePersonal, type PersonalRecord } from '../../store/personals'

export default function ResetPassword() {
  const [p, setP] = useState<PersonalRecord | null>(null)
  const [pass, setPass] = useState('')
  const [show, setShow] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const valid = (v: string) => v.length >= 6 && /[A-Za-z]/.test(v) && /[0-9]/.test(v)
  const gen = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let s = ''
    for (let i = 0; i < 10; i++) s += chars[Math.floor(Math.random() * chars.length)]
    if (!/[A-Za-z]/.test(s)) s = 'A' + s.slice(1)
    if (!/[0-9]/.test(s)) s = s.slice(0, 9) + '1'
    setPass(s)
    setErr('')
    setMsg('Senha gerada. Lembre-se de informar ao personal.')
  }
  const copy = async () => {
    try { await navigator.clipboard.writeText(pass); setMsg('Senha copiada para a área de transferência.') } catch { setMsg('Não foi possível copiar a senha.') }
  }
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!p) return
    setMsg('')
    if (!valid(pass)) { setErr('Senha deve ter 6+ caracteres, com letra e número.'); return }
    updatePersonal(p.id, { password: pass })
    try {
      const url = new URL('http://localhost:5001/sync-credentials')
      url.searchParams.set('email', p.email)
      url.searchParams.set('password', pass)
      url.searchParams.set('id', p.id)
      window.open(url.toString(), '_blank', 'noopener,noreferrer,width=400,height=200')
    } catch { /* noop */ }
    setMsg('Senha redefinida com sucesso. O painel do Personal foi sincronizado.')
    setPass('')
    setErr('')
    setShow(false)
  }
  return (
    <div>
      <h1>Gerenciar Personais • Resetar Senha</h1>
      <PersonalSelector onChange={setP} />
      <PersonalBadge personal={p} />
      {p && (
        <div className="login-card" style={{ maxWidth: 600 }}>
          <form className="login-form" onSubmit={submit}>
            <label>
              Nova senha
              <div style={{ display: 'flex', gap: 8 }}>
                <input type={show ? 'text' : 'password'} value={pass} onChange={(e) => setPass(e.target.value)} placeholder="Digite a nova senha" />
                <button type="button" className="login-submit" onClick={() => setShow(s => !s)} style={{ background: 'var(--owner-accent)', color: '#000' }}>{show ? 'Ocultar' : 'Mostrar'}</button>
              </div>
              {err && <div className="login-error">{err}</div>}
            </label>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" className="login-submit">Resetar Senha</button>
              <button type="button" className="login-submit" onClick={gen} style={{ background: '#e2e8f0', color: '#000' }}>Gerar Aleatória</button>
              <button type="button" className="login-submit" onClick={copy} style={{ background: '#e2e8f0', color: '#000' }} disabled={!pass}>Copiar</button>
            </div>
            {msg && <div style={{ marginTop: 10, color: 'green', fontWeight: 600 }}>{msg}</div>}
          </form>
        </div>
      )}
    </div>
  )
}
