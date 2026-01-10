import { useMemo, useState } from 'react'
import PersonalSelector from '../../components/PersonalSelector'
import PersonalBadge from '../../components/PersonalBadge'
import type { PersonalRecord } from '../../store/personals'
import { listPaymentsByPersonal } from '../../store/billing'

export default function PaymentsReceived() {
  const [p, setP] = useState<PersonalRecord | null>(null)
  const payments = useMemo(() => (p ? listPaymentsByPersonal(p.id) : []), [p])
  const total = useMemo(() => payments.reduce((sum, x) => sum + x.amount, 0), [payments])
  return (
    <div>
      <h1>Cobrança dos Personais • Pagamentos Recebidos</h1>
      <PersonalSelector onChange={setP} />
      <PersonalBadge personal={p} />
      {p && (
        <div className="login-card" style={{ maxWidth: 900 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ color: '#475569' }}>Total recebido: R$ {total.toFixed(2)}</div>
            <div style={{ color: '#475569' }}>{payments.length} pagamento(s)</div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left' }}>
                  <th>Descrição</th>
                  <th>Valor</th>
                  <th>Vencimento</th>
                  <th>Criado em</th>
                  <th>Pago em</th>
                  <th>Forma</th>
                </tr>
              </thead>
              <tbody>
                {payments.map(d => (
                  <tr key={d.id} style={{ borderTop: '1px solid var(--owner-border)' }}>
                    <td>{d.description || '-'}</td>
                    <td>R$ {d.amount.toFixed(2)}</td>
                    <td>{new Date(d.dueDate).toLocaleDateString()}</td>
                    <td>{new Date(d.createdAt).toLocaleString()}</td>
                    <td>{d.paidAt ? new Date(d.paidAt).toLocaleString() : '-'}</td>
                    <td>{d.paymentMethod || '-'}</td>
                </tr>
                ))}
                {payments.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ padding: 10, color: '#64748b' }}>Nenhum pagamento encontrado</td>
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
