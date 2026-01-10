import { useMemo, useState } from 'react'
import PersonalSelector from '../../components/PersonalSelector'
import PersonalBadge from '../../components/PersonalBadge'
import type { PersonalRecord } from '../../store/personals'
import { listPendencesByPersonal, recordPayment, type PaymentMethod } from '../../store/billing'

export default function Pendences() {
  const [p, setP] = useState<PersonalRecord | null>(null)
  const [refresh, setRefresh] = useState(0)
  const [payingId, setPayingId] = useState<string | null>(null)
  const [method, setMethod] = useState<PaymentMethod>('pix')
  const [note, setNote] = useState('')
  const debits = useMemo(() => (p ? listPendencesByPersonal(p.id) : []), [p, refresh])
  return (
    <div>
      <h1>Cobrança dos Personais • Pendências</h1>
      <PersonalSelector onChange={setP} />
      <PersonalBadge personal={p} />
      {p && (
        <div className="login-card" style={{ maxWidth: 1000 }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left' }}>
                  <th>Descrição</th>
                  <th>Valor</th>
                  <th>Vencimento</th>
                  <th>Status</th>
                  <th>Dias em atraso</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {debits.map(d => {
                  const due = new Date(d.dueDate)
                  const now = new Date(); now.setHours(0,0,0,0)
                  const diffMs = now.getTime() - due.getTime()
                  const days = d.status === 'atrasado' ? Math.max(0, Math.floor(diffMs / (1000*60*60*24))) : 0
                  return (
                    <tr key={d.id} style={{ borderTop: '1px solid var(--owner-border)' }}>
                      <td>{d.description || '-'}</td>
                      <td>R$ {d.amount.toFixed(2)}</td>
                      <td>{due.toLocaleDateString()}</td>
                      <td>{d.status}</td>
                      <td>{days}</td>
                      <td>
                        {payingId !== d.id && (
                          <button className="login-submit" onClick={() => { setPayingId(d.id); setMethod('pix'); setNote('') }} style={{ background: 'var(--owner-accent)', color: '#000' }}>Registrar Pagamento</button>
                        )}
                        {payingId === d.id && (
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
                              <option value="pix">PIX</option>
                              <option value="cartao">Cartão</option>
                              <option value="dinheiro">Dinheiro</option>
                            </select>
                            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Observações" />
                            <button className="login-submit" onClick={() => { recordPayment(d.id, method, note); setPayingId(null); setRefresh(r => r + 1) }} style={{ background: '#22c55e' }}>Confirmar</button>
                            <button className="login-submit" onClick={() => setPayingId(null)} style={{ background: '#e2e8f0', color: '#000' }}>Cancelar</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {debits.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: 10, color: '#64748b' }}>Sem pendências</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
