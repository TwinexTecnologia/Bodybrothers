import { useState } from 'react'
import PersonalSelector from '../../components/PersonalSelector'
import PersonalBadge from '../../components/PersonalBadge'
import type { PersonalRecord } from '../../store/personals'
import { addDebit } from '../../store/billing'

export default function DebitCreate() {
  const [p, setP] = useState<PersonalRecord | null>(null)
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState<Record<string, string>>({})

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!p) return
    const eobj: Record<string, string> = {}
    const value = parseFloat(amount.replace(',', '.'))
    if (isNaN(value) || value <= 0) eobj.amount = 'Informe um valor válido (> 0).'
    if (!dueDate) eobj.dueDate = 'Informe o vencimento.'
    else {
      const d = new Date(dueDate)
      const today = new Date(); today.setHours(0,0,0,0)
      if (d < today) eobj.dueDate = 'Vencimento não pode ser no passado.'
    }
    setErr(eobj)
    if (Object.keys(eobj).length) return
    addDebit({ personalId: p.id, amount: value, description: description || undefined, dueDate })
    setMsg('Débito lançado com sucesso.')
    setAmount('')
    setDescription('')
    setDueDate('')
    setErr({})
  }
  return (
    <div>
      <h1>Cobrança dos Personais • Lançar Débito</h1>
      <PersonalSelector onChange={setP} />
      <PersonalBadge personal={p} />
      {p && (
        <div className="login-card" style={{ maxWidth: 700 }}>
          <form className="login-form" onSubmit={submit}>
            <label>
              Valor
              <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Ex: 199.90" />
              {err.amount && <div className="login-error">{err.amount}</div>}
            </label>
            <label>
              Vencimento
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              {err.dueDate && <div className="login-error">{err.dueDate}</div>}
            </label>
            <label>
              Descrição (opcional)
              <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex: Mensalidade" />
            </label>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" className="login-submit">Lançar Débito</button>
            </div>
            {msg && <div style={{ marginTop: 10, color: 'green', fontWeight: 600 }}>{msg}</div>}
          </form>
        </div>
      )}
    </div>
  )
}
