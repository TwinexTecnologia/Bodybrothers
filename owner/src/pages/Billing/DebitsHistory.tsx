import { useMemo, useState } from 'react'
import PersonalSelector from '../../components/PersonalSelector'
import PersonalBadge from '../../components/PersonalBadge'
import type { PersonalRecord } from '../../store/personals'
import { listDebitsByPersonal, recordPayment, type PaymentMethod } from '../../store/billing'

export default function DebitsHistory() {
  const [p, setP] = useState<PersonalRecord | null>(null)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<'todos' | 'pendente' | 'pago' | 'atrasado'>('todos')
  const [refresh, setRefresh] = useState(0)
  const [payingId, setPayingId] = useState<string | null>(null)
  const [method, setMethod] = useState<PaymentMethod>('pix')
  const [note, setNote] = useState('')
  const debits = useMemo(() => (p ? listDebitsByPersonal(p.id) : []), [p, refresh])
  const filtered = useMemo(() => {
    let list = debits
    if (status !== 'todos') list = list.filter(d => d.status === status)
    const term = q.trim().toLowerCase()
    if (term) list = list.filter(d => (d.description || '').toLowerCase().includes(term))
    return list
  }, [debits, q, status])
  return (
    <div>
      <h1>Cobrança dos Personais • Histórico de Débitos</h1>
      <PersonalSelector onChange={setP} />
      <PersonalBadge personal={p} />
      {p && (
        <div className="login-card" style={{ maxWidth: 1000 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por descrição" />
            <select value={status} onChange={(e) => setStatus(e.target.value as 'todos' | 'pendente' | 'pago' | 'atrasado')}>
              <option value="todos">Todos</option>
              <option value="pendente">Pendente</option>
              <option value="atrasado">Atrasado</option>
              <option value="pago">Pago</option>
            </select>
            <div style={{ color: '#475569' }}>{filtered.length} débito(s)</div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left' }}>
                  <th>Descrição</th>
                  <th>Valor</th>
                  <th>Vencimento</th>
                  <th>Status</th>
                  <th>Criado em</th>
                  <th>Pago em</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(d => (
                  <tr key={d.id} style={{ borderTop: '1px solid var(--owner-border)' }}>
                    <td>{d.description || '-'}</td>
                    <td>R$ {d.amount.toFixed(2)}</td>
                    <td>{new Date(d.dueDate).toLocaleDateString()}</td>
                    <td>{d.status}</td>
                    <td>{new Date(d.createdAt).toLocaleString()}</td>
                    <td>{d.paidAt ? new Date(d.paidAt).toLocaleString() : '-'}</td>
                    <td>
                      {d.status !== 'pago' && payingId !== d.id && (
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
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ padding: 10, color: '#64748b' }}>Nenhum débito encontrado</td>
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
