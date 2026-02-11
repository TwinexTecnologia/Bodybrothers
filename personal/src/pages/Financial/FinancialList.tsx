import React, { Component, type ReactNode } from 'react'
import { useEffect, useState } from 'react'

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: any) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20, color: 'red', background: '#fee2e2', borderRadius: 8 }}>
          <h3>Algo deu errado na lista financeira.</h3>
          <pre>{this.state.error?.message}</pre>
        </div>
      )
    }
    return this.props.children
  }
}

import { listStudentsByPersonal, type StudentRecord } from '../../store/students'
import { listPlans, type PlanRecord } from '../../store/plans'
import { listMonthPayments, registerPayment, undoPayment, listPaymentHistory, type DebitRecord } from '../../store/financial'
import { supabase } from '../../lib/supabase'
import Modal from '../../components/Modal'

export default function FinancialList() {
    return (
        <ErrorBoundary>
            <FinancialListContent />
        </ErrorBoundary>
    )
}

function FinancialListContent() {
  const [tab, setTab] = useState<'monthly' | 'history'>('monthly')
  const [students, setStudents] = useState<StudentRecord[]>([])
  const [plans, setPlans] = useState<PlanRecord[]>([])
  const [payments, setPayments] = useState<DebitRecord[]>([])
  
  const [currentDate, setCurrentDate] = useState(new Date())
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('') 
  const [selectedStudentId, setSelectedStudentId] = useState('') 
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [historySearch, setHistorySearch] = useState('') 

  // History State
  const [historyFilter, setHistoryFilter] = useState({ 
      year: new Date().getFullYear(), 
      month: -1, 
      studentId: '' 
  })
  const [historyData, setHistoryData] = useState<DebitRecord[]>([])

  // Modal State - Confirmar Pagamento
  const [confirmModal, setConfirmModal] = useState<{
      show: boolean,
      student?: StudentRecord,
      plan?: PlanRecord,
      dueDate?: Date
  }>({ show: false })

  // Modal State - Desfazer Pagamento
  const [undoModal, setUndoModal] = useState<{
      show: boolean,
      paymentId?: string,
      studentName?: string
  }>({ show: false })

  async function loadData() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
        const [s, p, pay] = await Promise.all([
            listStudentsByPersonal(user.id),
            listPlans(user.id),
            listMonthPayments(user.id, currentDate)
        ])
        setStudents(s)
        setPlans(p)
        setPayments(pay)
    }
    setLoading(false)
  }

  async function loadHistory() {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
          const list = await listPaymentHistory(user.id, historyFilter)
          setHistoryData(list)
      }
      setLoading(false)
  }

  useEffect(() => {
    if (tab === 'monthly') loadData()
    else loadHistory()
  }, [currentDate, tab, historyFilter])

  const requestPay = (student: StudentRecord, plan: PlanRecord, dueDate: Date) => {
      setConfirmModal({ show: true, student, plan, dueDate })
  }

  const confirmPay = async () => {
      if (!confirmModal.student || !confirmModal.plan || !confirmModal.dueDate) return
      
      const { student, plan, dueDate } = confirmModal
      setProcessing(student.id)
      setConfirmModal({ show: false })

      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
          const ok = await registerPayment({
              personalId: user.id,
              studentId: student.id,
              amount: plan.price,
              dueDate: dueDate.toISOString().split('T')[0],
              refDate: currentDate,
              description: `Mensalidade - ${plan.name}`
          })
          if (ok) {
              await loadData()
          } else {
              alert('Erro ao registrar pagamento')
          }
      }
      setProcessing(null)
  }

  const handleUndo = (paymentId: string, studentName: string) => {
      setUndoModal({ show: true, paymentId, studentName })
  }

  const confirmUndo = async () => {
      if (!undoModal.paymentId) return
      setLoading(true)
      const ok = await undoPayment(undoModal.paymentId)
      setUndoModal({ show: false })
      if (ok) {
          await loadData()
      } else {
          alert('Erro ao cancelar pagamento')
      }
      setLoading(false)
  }

  const changeMonth = (delta: number) => {
      const next = new Date(currentDate)
      next.setMonth(next.getMonth() + delta)
      setCurrentDate(next)
  }

  const activeList = students
      .filter(s => s.status === 'ativo' && s.planId)
      .filter(s => selectedStudentId ? s.id === selectedStudentId : true)
  
  // Função OTIMIZADA para gerar as cobranças do mês visualizado (Sem Loop Infinito)
  const generateCharges = (student: StudentRecord, plan: PlanRecord, viewDate: Date) => {
      if (!student.planStartDate || typeof student.planStartDate !== 'string') return []

      // Parse data início de forma segura (aceita YYYY-MM-DD ou ISO)
      let dateStr = student.planStartDate
      if (dateStr.includes('T')) dateStr = dateStr.split('T')[0]
      
      const parts = dateStr.split('-').map(Number)
      if (parts.length < 3 || parts.some(isNaN)) return [] // Data inválida
      
      const [sy, sm, sd] = parts
      // IMPORTANTE: Mês no Date construtor é 0-based.
      // Se parts = [2025, 1, 1], new Date(2025, 0, 1) = 01 Jan 2025
      const start = new Date(sy, sm - 1, sd)
      start.setHours(0,0,0,0)
      
      // Validação extra se a data gerada é válida
      if (isNaN(start.getTime())) return []

      // Se o plano começou depois do mês visualizado, não tem cobrança
      // Mas cuidado com dia: se começou 31/01 e estamos vendo Jan, tem cobrança? Sim.
      // Vamos comparar Mês/Ano.
      const viewMonth = viewDate.getMonth()
      const viewYear = viewDate.getFullYear()
      
      // Primeiro dia do mês visualizado
      const viewStart = new Date(viewYear, viewMonth, 1)
      // Último dia do mês visualizado
      const viewEnd = new Date(viewYear, viewMonth + 1, 0)
      
      if (start > viewEnd) return [] // Plano começa no futuro

      const charges: Array<{ dueDate: Date, originalDate: Date }> = []
      const dueDay = student.dueDay || 10

      // Lógica Matemática para Frequências Mensais (Evita Loop)
      if (plan.frequency !== 'weekly') {
          const freqMap: Record<string, number> = {
              'monthly': 1,
              'bimonthly': 2,
              'quarterly': 3,
              'semiannual': 6,
              'annual': 12
          }
          const interval = freqMap[plan.frequency || 'monthly'] || 1
          
          // Calcula diferença de meses entre o início e a visualização
          // (AnoVis - AnoIni) * 12 + (MesVis - MesIni)
          // Ex: Start 2025-01. View 2025-01. Diff = 0.
          // Ex: Start 2025-01. View 2025-02. Diff = 1.
          const diffMonths = (viewYear - start.getFullYear()) * 12 + (viewMonth - start.getMonth())
          
          // Se a diferença for múltiplo do intervalo, tem cobrança neste mês!
          // Ex: Trimestral (3). Jan(0), Abr(3), Jul(6)... Resto 0.
          if (diffMonths >= 0 && diffMonths % interval === 0) {
              const chargeDate = new Date(viewYear, viewMonth, dueDay)
              
              // Verifica se a data de cobrança é válida (não antes do início absoluto)
              // Ex: Inicio 20/01. Due 10. Charge 10/01.
              // Se for o PRÓPRIO mês de início, permitimos cobrar dia 10 mesmo tendo começado dia 20?
              // Regra de negócio: Sim, a mensalidade do mês de entrada é devida.
              // A menos que queiram pro-rata, mas aqui é valor cheio.
              
              charges.push({ dueDate: chargeDate, originalDate: chargeDate })
          }
      } 
      else {
          // Lógica Semanal (Itera apenas dentro do mês visualizado - Max 5 iterações)
          // Acha o primeiro dia do ciclo que cai neste mês
          // Ciclo semanal baseia-se no dia da semana do start? Ou a cada 7 dias corridos?
          // 7 dias corridos é mais seguro.
          
          // Diferença em dias do inicio até o dia 1 do mês visualizado
          const oneDay = 24 * 60 * 60 * 1000
          
          // Itera do dia 1 ao fim do mês checando se bate com o ciclo
          let currentCheck = new Date(viewStart)
          // Se o mês visualizado for ANTERIOR ao start, loop não roda (start > viewEnd check acima garante)
          // Mas se o mês visualizado for O MESMO do start, devemos começar do start, não do dia 1.
          if (currentCheck < start) currentCheck = new Date(start) 
          
          // Limite de segurança para loop semanal
          let loopSafe = 0
          while (currentCheck <= viewEnd && loopSafe < 10) {
              loopSafe++
              const diffTime = currentCheck.getTime() - start.getTime()
              const diffDays = Math.floor(diffTime / oneDay)
              
              // Pequena tolerância para float errors? Math.floor deve resolver.
              
              if (diffDays >= 0 && diffDays % 7 === 0) {
                   charges.push({ dueDate: new Date(currentCheck), originalDate: new Date(currentCheck) })
                   // Otimização: Pula 7 dias
                   currentCheck.setDate(currentCheck.getDate() + 7)
              } else {
                   // Se não bateu (ex: começou do dia 1 mas ciclo é dia 2), ajusta.
                   // Mas estamos iterando dia a dia ou pulando?
                   // O ideal seria calcular o primeiro dia do ciclo no mês e pular de 7 em 7.
                   // Primeiro dia do ciclo >= currentCheck:
                   // start + N*7 >= currentCheck
                   // Mas vamos manter iteração simples dia-a-dia com salto se achar, é seguro para max 31 dias.
                   currentCheck.setDate(currentCheck.getDate() + 1)
              }
          }
      }
      
      return charges
  }

  const isValidDate = (d: any) => d instanceof Date && !isNaN(d.getTime())

  const getStatus = (s: StudentRecord, plan: PlanRecord, chargeDate: Date) => {
      // Validação de segurança
      if (!isValidDate(chargeDate)) {
          return { status: 'pending', label: 'ERRO DATA', color: '#94a3b8', bg: '#f1f5f9', date: new Date().toISOString() }
      }

      // Procura pagamento com due_date igual ao chargeDate (ignorando horas)
      try {
          const chargeDateStr = chargeDate.toISOString().split('T')[0]
          const payment = payments.find(p => p.payerId === s.id && p.dueDate === chargeDateStr)
          
          if (payment) {
              // Garante que paidAt existe, senão usa data atual
              const paidAt = payment.paidAt || new Date().toISOString()
              return { status: 'paid', label: 'PAGO', color: '#10b981', bg: '#dcfce7', date: paidAt, paymentId: payment.id }
          }

          const now = new Date()
          // Ajusta chargeDate para fim do dia para comparar atraso
          const dueEnd = new Date(chargeDate)
          dueEnd.setHours(23, 59, 59)
          
          const isPastDue = now > dueEnd

          if (isPastDue) return { status: 'overdue', label: 'ATRASADO', color: '#ef4444', bg: '#fee2e2', date: chargeDate.toISOString() }
          return { status: 'pending', label: 'PENDENTE', color: '#f59e0b', bg: '#fef3c7', date: chargeDate.toISOString() }
      } catch (e) {
          return { status: 'pending', label: 'ERRO', color: '#94a3b8', bg: '#f1f5f9', date: new Date().toISOString() }
      }
  }

  // Helper para formatar data com segurança
  const safeFormatDate = (date: Date | string | undefined | null) => {
      if (!date) return '-'
      try {
          const d = new Date(date)
          if (isNaN(d.getTime())) return '-'
          return d.toLocaleDateString('pt-BR')
      } catch {
          return '-'
      }
  }

  // Gera lista plana de cobranças para renderizar
  const chargesList = activeList.flatMap(s => {
      const plan = plans.find(p => p.id === s.planId)
      if (!plan) return []
      
      // Se o plano for gratuito (preço <= 0), não gera cobrança
      if (plan.price <= 0) return []

      const charges = generateCharges(s, plan, currentDate)
      
      return charges.map(c => {
          const { status, label, color, bg, date, paymentId } = getStatus(s, plan, c.dueDate)
          
          // Calcula a PRÓXIMA cobrança real após esta
          let nextChargeDate: Date | null = null
          
          if (plan.frequency && c.dueDate && !isNaN(c.dueDate.getTime())) {
              try {
                const d = new Date(c.dueDate)
                switch (plan.frequency) {
                    case 'weekly': d.setDate(d.getDate() + 7); break;
                    case 'bimonthly': d.setMonth(d.getMonth() + 2); break;
                    case 'quarterly': d.setMonth(d.getMonth() + 3); break;
                    case 'semiannual': d.setMonth(d.getMonth() + 6); break;
                    case 'annual': d.setFullYear(d.getFullYear() + 1); break;
                    case 'monthly': default: d.setMonth(d.getMonth() + 1); break;
                }
                if (!isNaN(d.getTime())) {
                    nextChargeDate = d
                }
              } catch (e) {
                  // Ignora erro no calculo da proxima
              }
          }

          return {
              student: s,
              plan,
              dueDate: c.dueDate,
              status, label, color, bg, date, paymentId,
              nextCharge: nextChargeDate
          }
      })
  }).filter(c => selectedStatus === 'all' || c.status === selectedStatus)
  .sort((a, b) => {
      const ta = a.dueDate.getTime()
      const tb = b.dueDate.getTime()
      if (isNaN(ta)) return 1
      if (isNaN(tb)) return -1
      return ta - tb
  })

  const summary = chargesList.reduce((acc, c) => {
      if (c.status === 'paid') acc.paid += c.plan.price
      else if (c.status === 'overdue') acc.overdue += c.plan.price
      else acc.pending += c.plan.price
      return acc
  }, { paid: 0, overdue: 0, pending: 0 })

  const totalHistory = historyData.reduce((acc, curr) => acc + curr.amount, 0)

  // Styles
  const cardStyle = {
      background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9'
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', gap: 20, alignItems: 'center', marginBottom: 32, flexWrap: 'wrap' }}>
          <h1 style={{ margin: 0, flex: 1 }}>Financeiro</h1>
          <div style={{ display: 'flex', background: '#f1f5f9', padding: 4, borderRadius: 8 }}>
              <button 
                onClick={() => setTab('monthly')}
                style={{
                    padding: '8px 20px', borderRadius: 6, border: 'none', cursor: 'pointer',
                    background: tab === 'monthly' ? '#fff' : 'transparent',
                    fontWeight: tab === 'monthly' ? 600 : 500,
                    color: tab === 'monthly' ? '#0f172a' : '#64748b',
                    boxShadow: tab === 'monthly' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    transition: 'all 0.2s'
                }}
              >
                  Mensalidades
              </button>
              <button 
                onClick={() => setTab('history')}
                style={{
                    padding: '8px 20px', borderRadius: 6, border: 'none', cursor: 'pointer',
                    background: tab === 'history' ? '#fff' : 'transparent',
                    fontWeight: tab === 'history' ? 600 : 500,
                    color: tab === 'history' ? '#0f172a' : '#64748b',
                    boxShadow: tab === 'history' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    transition: 'all 0.2s'
                }}
              >
                  Histórico
              </button>
          </div>
      </div>
      
      {tab === 'monthly' ? (
        <>
            {/* Seletor de Mês */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <button className="btn" style={{ background: '#fff', color: '#0f172a', border: '1px solid #e2e8f0', width: 40, height: 40, padding: 0, borderRadius: '50%' }} onClick={() => changeMonth(-1)}>←</button>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    <div style={{ fontWeight: 700, fontSize: '1.5em', color: '#0f172a', textTransform: 'capitalize' }}>
                        {currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                        <div style={{ width: 200 }}>
                            <select 
                                className="select" 
                                value={selectedStudentId} 
                                onChange={e => setSelectedStudentId(e.target.value)}
                                style={{ width: '100%', padding: '8px' }}
                            >
                                <option value="">Todos os Alunos</option>
                                {students
                                    .filter(s => s.status === 'ativo' && s.planId)
                                    .map(s => <option key={s.id} value={s.id}>{s.name}</option>)
                                }
                            </select>
                        </div>
                        <div style={{ width: 150 }}>
                            <select 
                                className="select" 
                                value={selectedStatus} 
                                onChange={e => setSelectedStatus(e.target.value)}
                                style={{ width: '100%', padding: '8px' }}
                            >
                                <option value="all">Todos Status</option>
                                <option value="paid">Pago</option>
                                <option value="pending">Pendente</option>
                                <option value="overdue">Atrasado</option>
                            </select>
                        </div>
                    </div>
                </div>
                <button className="btn" style={{ background: '#fff', color: '#0f172a', border: '1px solid #e2e8f0', width: 40, height: 40, padding: 0, borderRadius: '50%' }} onClick={() => changeMonth(1)}>→</button>
            </div>

            {/* Dashboard Resumo */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20, marginBottom: 32 }}>
                <div style={cardStyle}>
                    <div style={{ color: '#64748b', fontSize: '0.9em', fontWeight: 600, marginBottom: 8 }}>RECEBIDO</div>
                    <div style={{ fontSize: '1.8em', fontWeight: 700, color: '#10b981' }}>R$ {summary.paid.toFixed(2)}</div>
                </div>
                <div style={cardStyle}>
                    <div style={{ color: '#64748b', fontSize: '0.9em', fontWeight: 600, marginBottom: 8 }}>PENDENTE</div>
                    <div style={{ fontSize: '1.8em', fontWeight: 700, color: '#f59e0b' }}>R$ {summary.pending.toFixed(2)}</div>
                </div>
                <div style={cardStyle}>
                    <div style={{ color: '#64748b', fontSize: '0.9em', fontWeight: 600, marginBottom: 8 }}>ATRASADO</div>
                    <div style={{ fontSize: '1.8em', fontWeight: 700, color: '#ef4444' }}>R$ {summary.overdue.toFixed(2)}</div>
                </div>
            </div>

            {loading ? <div style={{ textAlign: 'center', padding: 40 }}>Carregando...</div> : (
                <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1.2fr 1fr', gap: 16, padding: '16px 24px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontWeight: 600, fontSize: '0.85em', color: '#64748b', letterSpacing: '0.05em' }}>
                        <div>ALUNO</div>
                        <div>PLANO</div>
                        <div>VALOR</div>
                        <div>STATUS</div>
                        <div style={{ textAlign: 'right' }}>AÇÃO</div>
                    </div>
                    
                    {chargesList.map((item, idx) => {
                        const { student: s, plan, status, label, color, bg, date, paymentId, dueDate, nextCharge } = item

                        return (
                            <div key={`${s.id}-${idx}`} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1.2fr 1fr', gap: 16, alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid #f1f5f9', fontSize: '0.95em' }}>
                                <div style={{ fontWeight: 600, color: '#0f172a' }}>{s.name}</div>
                                <div style={{ color: '#64748b' }}>{plan.name}</div>
                                <div style={{ fontWeight: 600 }}>R$ {plan.price.toFixed(2)}</div>
                                <div>
                                    <span style={{ background: bg, color: color, padding: '4px 10px', borderRadius: 20, fontSize: '0.75em', fontWeight: 700 }}>
                                        {label}
                                    </span>
                                    <div style={{ fontSize: '0.8em', color: '#94a3b8', marginTop: 4 }}>
                                        {status === 'paid' 
                                            ? `Pago ${safeFormatDate(date)}` 
                                            : `Vence ${safeFormatDate(dueDate)}`
                                        }
                                    </div>
                                    {nextCharge && (
                                        <div style={{ fontSize: '0.75em', color: '#64748b', marginTop: 2, fontStyle: 'italic' }}>
                                            Próx: {safeFormatDate(nextCharge)}
                                        </div>
                                    )}
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    {status !== 'paid' ? (
                                        <button 
                                            className="btn" 
                                            disabled={processing === s.id}
                                            onClick={() => requestPay(s, plan, dueDate)}
                                            style={{ fontSize: '0.85em', padding: '8px 16px', background: '#10b981', boxShadow: '0 2px 4px rgba(16, 185, 129, 0.2)' }}
                                        >
                                            {processing === s.id ? '...' : 'Receber'}
                                        </button>
                                    ) : (
                                        <button 
                                            className="btn"
                                            title="Desfazer pagamento"
                                            onClick={() => handleUndo(paymentId!, s.name)}
                                            style={{ fontSize: '0.85em', padding: '8px 16px', background: '#fff', border: '1px solid #e2e8f0', color: '#64748b' }}
                                        >
                                            Desfazer
                                        </button>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                    
                    {chargesList.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Nenhuma cobrança prevista para este mês.</div>}
                </div>
            )}
        </>
      ) : (
        <>
            <div style={cardStyle}>
                <div className="form-grid-3">
                    <label className="label">
                        Ano
                        <select className="select" value={historyFilter.year} onChange={e => setHistoryFilter({ ...historyFilter, year: parseInt(e.target.value) })}>
                            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </label>
                    <label className="label">
                        Mês
                        <select className="select" value={historyFilter.month} onChange={e => setHistoryFilter({ ...historyFilter, month: parseInt(e.target.value) })}>
                            <option value={-1}>Todos</option>
                            {['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'].map((m, i) => (
                                <option key={i} value={i}>{m}</option>
                            ))}
                        </select>
                    </label>
                    <label className="label">
                        Aluno
                        <select className="select" value={historyFilter.studentId} onChange={e => setHistoryFilter({ ...historyFilter, studentId: e.target.value })}>
                            <option value="">Todos</option>
                            {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </label>
                </div>
            </div>

            <div style={{ marginTop: 24, background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                <div style={{ padding: '20px 24px', background: '#ecfdf5', borderBottom: '1px solid #d1fae5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ color: '#065f46', fontWeight: 600 }}>TOTAL NO PERÍODO</div>
                    <div style={{ fontSize: '1.5em', fontWeight: 700, color: '#059669' }}>R$ {totalHistory.toFixed(2)}</div>
                </div>

                {loading ? <div style={{ padding: 40, textAlign: 'center' }}>Carregando...</div> : (
                    <div>
                        {historyData.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Nenhum registro encontrado.</div>}
                        
                        {historyData.map(d => {
                            const studentName = students.find(s => s.id === d.payerId)?.name || 'Aluno Excluído'
                            return (
                                <div key={d.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16, alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid #f1f5f9' }}>
                                    <div>
                                        <div style={{ fontWeight: 600, color: '#0f172a' }}>{studentName}</div>
                                        <div style={{ fontSize: '0.85em', color: '#64748b' }}>{d.description}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.8em', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Ref. Mês</div>
                                        <div style={{ fontWeight: 500 }}>{d.monthRef ? new Date(d.monthRef).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) : '-'}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.8em', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Pago em</div>
                                        <div style={{ fontWeight: 500 }}>{new Date(d.paidAt!).toLocaleDateString()}</div>
                                    </div>
                                    <div style={{ textAlign: 'right', fontWeight: 700, color: '#10b981', fontSize: '1.1em' }}>
                                        R$ {d.amount.toFixed(2)}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </>
      )}

      {/* Modal de Confirmação de Recebimento */}
      <Modal
        isOpen={confirmModal.show}
        onClose={() => setConfirmModal({ show: false })}
        title="Confirmar Recebimento"
        footer={
            <>
                <button className="btn" style={{ background: '#fff', border: '1px solid #e2e8f0', color: '#64748b' }} onClick={() => setConfirmModal({ show: false })}>
                    Cancelar
                </button>
                <button className="btn" style={{ background: '#10b981', boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.3)' }} onClick={confirmPay}>
                    Confirmar
                </button>
            </>
        }
      >
        {confirmModal.student && confirmModal.plan && (
            <div style={{ textAlign: 'center' }}>
                <div style={{ marginBottom: 24, lineHeight: 1.6, color: '#4b5563', fontSize: '1.05em' }}>
                    Confirmar pagamento de <strong>{confirmModal.student.name}</strong><br/>
                    referente a <strong>{currentDate.toLocaleDateString('pt-BR', { month: 'long' })}</strong>?
                </div>

                <div style={{ background: '#f0fdf4', padding: 20, borderRadius: 12, border: '1px solid #bbf7d0' }}>
                    <div style={{ fontSize: '0.9em', color: '#166534', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase' }}>Valor a receber</div>
                    <div style={{ fontSize: '2.2em', fontWeight: 800, color: '#15803d' }}>
                        R$ {confirmModal.plan.price.toFixed(2)}
                    </div>
                </div>
            </div>
        )}
      </Modal>

      {/* Modal de Desfazer Pagamento */}
      <Modal
        isOpen={undoModal.show}
        onClose={() => setUndoModal({ show: false })}
        title="Desfazer Pagamento"
        type="danger"
        footer={
            <>
                <button className="btn" style={{ background: '#fff', border: '1px solid #e2e8f0', color: '#64748b' }} onClick={() => setUndoModal({ show: false })}>
                    Cancelar
                </button>
                <button className="btn" style={{ background: '#ef4444', color: '#fff', boxShadow: '0 4px 6px -1px rgba(239, 68, 68, 0.3)' }} onClick={confirmUndo}>
                    Sim, desfazer
                </button>
            </>
        }
      >
        <div style={{ textAlign: 'center' }}>
            <p>Tem certeza que deseja cancelar o pagamento de <strong>{undoModal.studentName}</strong>?</p>
            <p style={{ fontSize: '0.9em', color: '#64748b' }}>O status voltará para <strong>Pendente</strong> e o valor será removido do total recebido.</p>
        </div>
      </Modal>
    </div>
  )
}
