import { Wallet, Calendar, CheckCircle, AlertCircle, CreditCard, Clock, Download } from 'lucide-react'
import { useFinancialStatus } from '../../hooks/useFinancialStatus'
import { generateFinancePdf } from '../../lib/finance_pdf'
import { useAuth } from '../../auth/AuthContext'

const frequencyMap: Record<string, string> = {
    weekly: 'Semanal',
    monthly: 'Mensal',
    bimonthly: 'Bimestral',
    quarterly: 'Trimestral',
    semiannual: 'Semestral',
    annual: 'Anual'
}

export default function ListPendences() {
  const { user } = useAuth()
  const { loading, plan, financialInfo, chargesList, overdueCount } = useFinancialStatus()

  // Filtra lista para exibição limpa (Pendentes + Proximos)
  const displayList = chargesList.filter(c => {
      // Se estiver atrasado ou pendente (vencido), mostra sempre
      if (c.status === 'overdue') return true
      
      const today = new Date()
      today.setHours(0,0,0,0)
      
      // Se for hoje ou futuro
      if (c.date >= today) return true
      
      return false
  }).slice(0, 2) // Limita a 2 itens (Atual/Pendente + Próxima)

  const handleDownload = async () => {
      if (!plan || !user) return
      
      // Prepara dados para o PDF (Histórico Completo + Futuro Próximo)
      // Vamos pegar TUDO que está no chargesList, ordenado por data
      const allCharges = [...chargesList].sort((a, b) => b.date.getTime() - a.date.getTime())
      
      const pdfData = allCharges.map(c => ({
          description: `Mensalidade (${c.date.toLocaleDateString('pt-BR', { month: 'long' })})`,
          dueDate: c.date,
          paidAt: c.status === 'paid' ? c.payment.paidAt : null,
          status: c.status,
          amount: c.amount
      }))

      await generateFinancePdf(
          user.user_metadata.full_name || user.email || 'Aluno',
          plan.title,
          pdfData
      )
  }

  const nextCharge = chargesList.find(c => c.date >= new Date(new Date().setHours(0,0,0,0)))
  const freqLabel = plan?.frequency ? frequencyMap[plan.frequency] : 'Mensal'
  const suffix = plan?.frequency === 'weekly' ? '/sem' : plan?.frequency === 'annual' ? '/ano' : '/mês'

  if (loading) return <div style={{ padding: 24 }}>Carregando informações financeiras...</div>

  return (
    <>
      <div style={{ padding: 24, paddingBottom: 100 }}>
        <header style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
                <h1 style={{ fontSize: '1.8rem', color: '#0f172a', marginBottom: 8 }}>Financeiro</h1>
                <p style={{ color: '#64748b' }}>Detalhes do seu plano e pagamentos.</p>
            </div>
            {plan && (
                <button 
                    onClick={handleDownload}
                    className="btn-icon"
                    title="Baixar Extrato Completo"
                    style={{ 
                        background: '#f1f5f9', border: '1px solid #e2e8f0', 
                        padding: 10, borderRadius: 8, color: '#0f172a',
                        display: 'flex', alignItems: 'center', gap: 8,
                        cursor: 'pointer'
                    }}
                >
                    <Download size={20} />
                    <span style={{ fontSize: '0.9rem', fontWeight: 600, display: 'none' }} className="desktop-only">Extrato</span>
                </button>
            )}
        </header>

        {plan ? (
            <div style={{ display: 'grid', gap: 24, maxWidth: 800 }}>
                
                {/* Card do Plano Atual */}
                <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                    <div style={{ background: '#f8fafc', padding: '16px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h2 style={{ fontSize: '1.1rem', color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <CreditCard size={20} color="#64748b" /> Meu Plano
                        </h2>
                        <span style={{ background: '#dcfce7', color: '#166534', padding: '4px 12px', borderRadius: 20, fontSize: '0.85rem', fontWeight: 600 }}>
                            ATIVO
                        </span>
                    </div>
                    <div style={{ padding: 24 }}>
                        <div className="mobile-stack" style={{ marginBottom: 24 }}>
                            <div>
                                <h3 style={{ margin: '0 0 4px 0', fontSize: '1.5rem', color: '#0f172a' }}>{plan.title}</h3>
                                <p style={{ margin: 0, color: '#64748b' }}>Cobrança {freqLabel.toLowerCase()}</p>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <span style={{ fontSize: '1.8rem', fontWeight: 700, color: '#0f172a' }}>
                                    R$ {plan.price.toFixed(2)}
                                </span>
                                <span style={{ color: '#64748b', fontSize: '0.9rem' }}> {suffix}</span>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, borderTop: '1px solid #f1f5f9', paddingTop: 24 }}>
                            <div>
                                <div style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: 4 }}>Dia de Vencimento</div>
                                <div style={{ fontWeight: 600, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Calendar size={18} /> Dia {financialInfo.dueDay || plan.due_day}
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: 4 }}>Próximo Pagamento</div>
                                <div style={{ fontWeight: 600, color: '#0f172a' }}>
                                    {nextCharge ? nextCharge.date.toLocaleDateString('pt-BR') : '—'}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Status Financeiro */}
                {overdueCount > 0 ? (
                    <div style={{ background: '#fef2f2', padding: 24, borderRadius: 16, border: '1px solid #fecaca', display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{ background: '#fee2e2', padding: 12, borderRadius: '50%' }}>
                            <AlertCircle size={32} color="#ef4444" />
                        </div>
                        <div>
                            <h3 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', color: '#991b1b' }}>Pendência Identificada</h3>
                            <p style={{ margin: 0, color: '#b91c1c' }}>
                                Você possui {overdueCount} mensalidade(s) em aberto. Regularize para evitar bloqueios.
                            </p>
                        </div>
                    </div>
                ) : (
                    <div style={{ background: '#f0fdf4', padding: 24, borderRadius: 16, border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{ background: '#dcfce7', padding: 12, borderRadius: '50%' }}>
                            <CheckCircle size={32} color="#16a34a" />
                        </div>
                        <div>
                            <h3 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', color: '#166534' }}>Situação Regular</h3>
                            <p style={{ margin: 0, color: '#15803d' }}>
                                Parabéns! Suas mensalidades estão em dia.
                            </p>
                        </div>
                    </div>
                )}

                {/* Lista de Cobranças */}
                <h3 style={{ fontSize: '1.2rem', color: '#0f172a', margin: '16px 0 0 0' }}>Próximos Lançamentos</h3>
                <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                    {displayList.length === 0 ? (
                         <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>Nenhuma cobrança próxima.</div>
                    ) : (
                        displayList.map((item, i) => (
                            <div key={i} style={{ 
                                padding: '16px 24px', 
                                borderBottom: '1px solid #f1f5f9',
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                background: item.status === 'overdue' ? '#fef2f2' : item.status === 'paid' ? '#f0fdf4' : '#fff'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{ 
                                        width: 40, height: 40, borderRadius: '50%', 
                                        background: item.status === 'paid' ? '#dcfce7' : '#f1f5f9',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: item.status === 'paid' ? '#16a34a' : '#64748b'
                                    }}>
                                        {item.status === 'paid' ? <CheckCircle size={20} /> : <Clock size={20} />}
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 600, color: '#0f172a' }}>Mensalidade</div>
                                        <div style={{ fontSize: '0.85rem', color: item.status === 'overdue' ? '#ef4444' : '#64748b' }}>
                                            {item.status === 'paid' ? `Pago em ${new Date(item.payment.paidAt).toLocaleDateString('pt-BR')}` : `Vence em ${item.date.toLocaleDateString('pt-BR')}`}
                                        </div>
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontWeight: 700, color: '#0f172a' }}>R$ {item.amount.toFixed(2)}</div>
                                    <div style={{ 
                                        fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase',
                                        color: item.status === 'paid' ? '#16a34a' : item.status === 'overdue' ? '#ef4444' : '#f59e0b'
                                    }}>
                                        {item.status === 'paid' ? 'PAGO' : item.status === 'overdue' ? 'ATRASADO' : 'PENDENTE'}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

            </div>
        ) : (
            <div style={{ background: '#fff', padding: 48, borderRadius: 16, border: '1px solid #e2e8f0', textAlign: 'center' }}>
                <div style={{ background: '#f1f5f9', width: 64, height: 64, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto' }}>
                    <Wallet size={32} color="#94a3b8" />
                </div>
                <h3 style={{ color: '#0f172a', marginBottom: 8 }}>Nenhum plano vinculado</h3>
                <p style={{ color: '#64748b' }}>Entre em contato com seu personal para configurar seu plano.</p>
            </div>
        )}

      </div>
    </>
  )
}
