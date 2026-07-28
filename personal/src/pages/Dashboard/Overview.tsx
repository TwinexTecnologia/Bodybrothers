import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { countPendingAnamnesisReviews } from '../../lib/anamnesisReview'
import { useNavigate } from 'react-router-dom'
import type { StudentRecord } from '../../store/students'
import type { PlanRecord } from '../../store/plans'
import type { DebitRecord } from '../../store/financial'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from 'recharts'

function getMonthsToDistribute(frequency?: string | null) {
  switch (frequency) {
    case 'bimonthly':
      return 2
    case 'quarterly':
      return 3
    case 'semiannual':
      return 6
    case 'annual':
      return 12
    default:
      return 1
  }
}

export default function Overview() {
  const navigate = useNavigate()
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false)
  const [detailsLoading, setDetailsLoading] = useState(true)
  const [filters, setFilters] = useState({
    year: new Date().getFullYear(),
    month: 'all' // 'all' or '0', '1', ... '11'
  })

  const [rawData, setRawData] = useState({
    students: [] as StudentRecord[],
    plans: [] as PlanRecord[],
    payments: [] as DebitRecord[]
  })

  const [stats, setStats] = useState({
    totalStudents: 0,
    activeStudents: 0,
    inactiveStudents: 0,
    pendingFinance: 0,
    activeDiets: 0,
    inactiveDiets: 0,
    activeWorkouts: 0,
    inactiveWorkouts: 0,
    monthlyRevenue: 0,
    monthlyCash: 0, // Novo estado para Caixa
    loading: true,
    pendingAnamnesis: 0, // NOVO
    showAnamnesisPending: false // NOVO
  })

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleResize = () => setIsMobile(window.innerWidth < 768)
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const chartData = useMemo(() => {
    if (stats.loading) return []

    const { year, month } = filters
    const { students, plans, payments } = rawData
    const monthTotals = new Array(12).fill(0)
    const studentPlanById = new Map(students.map(student => [student.id, student.planId]))
    const planFrequencyById = new Map(plans.map(plan => [plan.id, plan.frequency]))

    payments.forEach(payment => {
      if (!payment.paidAt && !payment.dueDate) return
      if (payment.amount > 100000) return

      const baseDate = new Date(payment.dueDate || payment.paidAt!)
      const planId = studentPlanById.get(payment.payerId)
      const monthsToDistribute = getMonthsToDistribute(planId ? planFrequencyById.get(planId) : null)
      const monthlyValue = payment.amount / monthsToDistribute

      for (let i = 0; i < monthsToDistribute; i++) {
        const targetDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + i, 1)
        if (targetDate.getFullYear() === year) {
          monthTotals[targetDate.getMonth()] += monthlyValue
        }
      }
    })

    const startMonth = month === 'all' ? 0 : Number(month)
    const endMonth = month === 'all' ? 11 : Number(month)
    const nextChartData: { name: string; revenue: number }[] = []

    for (let m = startMonth; m <= endMonth; m++) {
      const monthStart = new Date(year, m, 1)
      let total = monthTotals[m]

      if (total > 500000) total = 0

      if (Math.round(total) > 0) {
        nextChartData.push({
          name: monthStart.toLocaleDateString('pt-BR', { month: 'short' }).toUpperCase(),
          revenue: Math.round(total)
        })
      }
    }

    return nextChartData
  }, [filters, rawData, stats.loading])

  useEffect(() => {
    async function loadStats() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const [
          studentsRes,
          plansRes,
          dietsActiveRes,
          dietsInactiveRes,
          workoutsActiveRes,
          workoutsInactiveRes,
          profileRes,
        ] = await Promise.all([
          supabase.from('profiles').select('id, personal_id, plan_id, data').eq('personal_id', user.id).eq('role', 'aluno'),
          supabase.from('plans').select('id, frequency').eq('personal_id', user.id),
          supabase.from('protocols').select('id', { count: 'exact', head: true }).eq('personal_id', user.id).eq('type', 'diet').eq('status', 'active'),
          supabase.from('protocols').select('id', { count: 'exact', head: true }).eq('personal_id', user.id).eq('type', 'diet').neq('status', 'active'),
          supabase.from('protocols').select('id', { count: 'exact', head: true }).eq('personal_id', user.id).eq('type', 'workout').eq('status', 'active'),
          supabase.from('protocols').select('id', { count: 'exact', head: true }).eq('personal_id', user.id).eq('type', 'workout').neq('status', 'active'),
          supabase.from('profiles').select('data').eq('id', user.id).single(),
        ])

        const studentsRaw = studentsRes.data || []
        const students: StudentRecord[] = studentsRaw.map((d: any) => ({
            id: d.id,
            personalId: d.personal_id,
            name: '',
            email: '',
            status: d.data?.status || 'ativo',
            planId: d.plan_id || d.data?.planId,
            planStartDate: d.data?.planStartDate,
        })) as any

        const totalStudents = students.length
        const activeStudentsList = students.filter(s => s.status !== 'inativo')
        const activeStudentIds = new Set(activeStudentsList.map(student => student.id))
        const activeStudentPlanById = new Map(activeStudentsList.map(student => [student.id, student.planId]))
        const activeStudents = activeStudentsList.length
        const inactiveStudents = totalStudents - activeStudents

        const showAnamnesisPending = profileRes.data?.data?.config?.anamnesisReviewRequired === true

        const plans = (plansRes.data || []) as PlanRecord[]
        const planFrequencyById = new Map(plans.map(plan => [plan.id, plan.frequency]))

        setRawData({
            students: activeStudentsList,
            plans,
            payments: []
        })

        setStats({
          totalStudents,
          activeStudents,
          inactiveStudents,
          pendingFinance: 0,
          activeDiets: dietsActiveRes.count || 0,
          inactiveDiets: dietsInactiveRes.count || 0,
          activeWorkouts: workoutsActiveRes.count || 0,
          inactiveWorkouts: workoutsInactiveRes.count || 0,
          monthlyRevenue: 0,
          monthlyCash: 0,
          loading: false,
          pendingAnamnesis: 0,
          showAnamnesisPending
        })

        setDetailsLoading(true)

        const [paymentsRes, anamnesisModelsRes, anamnesisRes] = await Promise.all([
          supabase.from('debits').select('id, payer_id, amount, due_date, paid_at').eq('receiver_id', user.id).eq('status', 'paid'),
          showAnamnesisPending
            ? supabase.from('protocols').select('id', { count: 'exact', head: true }).eq('personal_id', user.id).eq('type', 'anamnesis_model')
            : Promise.resolve({ data: null, count: 0, error: null }),
          showAnamnesisPending
            ? supabase.from('protocols').select('student_id, data, content, reviewed_at').eq('personal_id', user.id).eq('type', 'anamnesis')
            : Promise.resolve({ data: [], error: null }),
        ])

        let pendingAnamnesisCount = 0
        if (showAnamnesisPending) {
          pendingAnamnesisCount = countPendingAnamnesisReviews(
            anamnesisRes.data || [],
            activeStudentIds,
            Boolean(anamnesisModelsRes.count && anamnesisModelsRes.count > 0),
          )
        }

        const paymentsRaw = paymentsRes.data || []
        const allPayments: DebitRecord[] = paymentsRaw.map((d: any) => ({
          id: d.id,
          payerId: d.payer_id,
          receiverId: user.id,
          amount: Number(d.amount),
          dueDate: d.due_date,
          paidAt: d.paid_at,
          status: 'paid',
          monthRef: undefined
        }))
        const paymentsByStudentId = new Map<string, DebitRecord[]>()

        allPayments.forEach(payment => {
          const currentPayments = paymentsByStudentId.get(payment.payerId) || []
          currentPayments.push(payment)
          paymentsByStudentId.set(payment.payerId, currentPayments)
        })

        paymentsByStudentId.forEach(studentPayments => {
          studentPayments.sort((a, b) => {
            const dateA = new Date(a.paidAt || a.dueDate || 0).getTime()
            const dateB = new Date(b.paidAt || b.dueDate || 0).getTime()
            return dateB - dateA
          })
        })

        setRawData({
          students: activeStudentsList,
          plans,
          payments: allPayments
        })

        let monthlyRevenue = 0
        const now = new Date()
        const currentMonth = now.getMonth()
        const currentYear = now.getFullYear()
        let monthlyCash = 0

        allPayments.forEach(payment => {
          if (!payment.paidAt && !payment.dueDate) return

          if (payment.paidAt) {
            const paidDate = new Date(payment.paidAt)
            if (paidDate.getMonth() === currentMonth && paidDate.getFullYear() === currentYear) {
              monthlyCash += payment.amount
            }
          }

          const baseDate = new Date(payment.dueDate || payment.paidAt!)
          const monthsToDistribute = getMonthsToDistribute(
            planFrequencyById.get(activeStudentPlanById.get(payment.payerId) || '')
          )

          const monthlyValue = payment.amount / monthsToDistribute

          for (let i = 0; i < monthsToDistribute; i++) {
            const targetDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + i, 1)
            if (targetDate.getMonth() === currentMonth && targetDate.getFullYear() === currentYear) {
              monthlyRevenue += monthlyValue
            }
          }
        })

        let pendingFinanceCount = 0
        activeStudentsList.forEach(student => {
          if (!student.planId || !student.planStartDate) return
          const planFrequency = planFrequencyById.get(student.planId)
          if (!planFrequency) return
          const studentPayments = paymentsByStudentId.get(student.id) || []
          const lastPayment = studentPayments[0]

          if (!lastPayment) {
            const start = new Date(student.planStartDate)
            const gracePeriod = new Date(start)
            gracePeriod.setDate(gracePeriod.getDate() + 5)
            if (now > gracePeriod) {
              pendingFinanceCount++
            }
            return
          }

          const refDate = new Date(lastPayment.paidAt || lastPayment.dueDate || 0)
          let validityDays = 30

          switch (planFrequency) {
            case 'weekly': validityDays = 7; break
            case 'monthly': validityDays = 30; break
            case 'bimonthly': validityDays = 60; break
            case 'quarterly': validityDays = 90; break
            case 'semiannual': validityDays = 180; break
            case 'annual': validityDays = 365; break
          }

          const validUntil = new Date(refDate)
          validUntil.setDate(validUntil.getDate() + validityDays)
          validUntil.setDate(validUntil.getDate() + 3)

          if (now > validUntil) {
            pendingFinanceCount++
          }
        })

        setStats(prev => ({
          ...prev,
          pendingFinance: pendingFinanceCount,
          monthlyRevenue,
          monthlyCash,
          pendingAnamnesis: pendingAnamnesisCount,
        }))

      } catch (error) {
        console.error('Erro ao carregar dashboard:', error)
      } finally {
        setDetailsLoading(false)
        setStats(prev => ({ ...prev, loading: false }))
      }
    }

  }, [])

  if (stats.loading) {
    return <div style={{ padding: 20 }}>Carregando dados...</div>
  }

  const cardStyle = {
      background: '#fff',
      padding: 20,
      borderRadius: 8,
      boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
      flex: '1 1 200px'
  }

  const labelStyle = {
      margin: '0 0 10px 0',
      color: '#64748b',
      fontSize: 13,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.5px'
  }

  const valueStyle = {
      fontSize: 28,
      fontWeight: 'bold',
      color: '#0f172a'
  }

  const subValueStyle = {
      fontSize: 14,
      color: '#64748b',
      marginTop: 4
  }

  const currentMonthName = new Date().toLocaleDateString('pt-BR', { month: 'long' })
  const currentMonthLabel = currentMonthName.charAt(0).toUpperCase() + currentMonthName.slice(1)

  return (
    <div>
      <h1 style={{ marginBottom: 20 }}>Dashboard • Visão Geral</h1>
      
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
        
        {/* Bloco Alunos */}
        <div style={cardStyle}>
          <h3 style={labelStyle}>Alunos</h3>
          <div style={valueStyle}>{stats.totalStudents}</div>
          <div style={subValueStyle}>
            <span style={{ color: '#16a34a' }}>{stats.activeStudents} ativos</span> • 
            <span style={{ color: '#94a3b8' }}> {stats.inactiveStudents} inativos</span>
          </div>
        </div>

        {/* Bloco Receita Mensal Estimada (MRR) */}
        <div style={cardStyle}>
          <h3 style={labelStyle}>Financeiro ({currentMonthLabel})</h3>
          
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 2 }}>RECEBIDO (CAIXA)</div>
            <div style={{ ...valueStyle, color: '#16a34a' }}>
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.monthlyCash)}
            </div>
          </div>

          <div>
             <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 2 }}>FATURAMENTO (COMPETÊNCIA)</div>
             <div style={{ ...valueStyle, color: '#0ea5e9', fontSize: 20 }}>
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.monthlyRevenue)}
             </div>
          </div>
        </div>

        {/* Bloco Pendências */}
        <div style={cardStyle}>
          <h3 style={labelStyle}>Pendências</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              
              {/* Item Financeiro */}
              <div 
                style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    cursor: 'pointer', 
                    padding: '12px', 
                    borderRadius: 8, 
                    background: '#fff', 
                    border: '1px solid #e2e8f0',
                    borderLeft: `4px solid ${stats.pendingFinance > 0 ? '#ef4444' : '#22c55e'}`,
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                    transition: 'all 0.2s'
                }}
                onClick={() => navigate('/financial')}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
              >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ 
                          width: 36, height: 36, borderRadius: '50%', 
                          background: stats.pendingFinance > 0 ? '#fee2e2' : '#dcfce7',
                          color: stats.pendingFinance > 0 ? '#dc2626' : '#16a34a',
                          display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="12" y1="1" x2="12" y2="23"></line>
                              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                          </svg>
                      </div>
                      <div>
                          <div style={{ fontWeight: 600, fontSize: 14, color: '#334155' }}>Financeiro</div>
                          <div style={{ fontSize: 12, color: '#64748b' }}>
                              {detailsLoading ? 'Calculando...' : stats.pendingFinance === 0 ? 'Tudo pago' : `${stats.pendingFinance} pendentes`}
                          </div>
                      </div>
                  </div>
                  <div style={{ color: '#94a3b8' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="9 18 15 12 9 6"></polyline>
                      </svg>
                  </div>
              </div>

              {/* Item Anamneses (Condicional) */}
              {stats.showAnamnesisPending && (
                  <div 
                    style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        cursor: 'pointer', 
                        padding: '12px', 
                        borderRadius: 8, 
                        background: '#fff', 
                        border: '1px solid #e2e8f0',
                        borderLeft: `4px solid ${stats.pendingAnamnesis > 0 ? '#3b82f6' : '#22c55e'}`, // Azul para análise, verde se ok
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                        transition: 'all 0.2s'
                    }}
                    onClick={() => navigate('/protocols/anamnesis-pending')}
                    onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                  >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ 
                              width: 36, height: 36, borderRadius: '50%', 
                              background: stats.pendingAnamnesis > 0 ? '#eff6ff' : '#dcfce7',
                              color: stats.pendingAnamnesis > 0 ? '#3b82f6' : '#16a34a',
                              display: 'flex', alignItems: 'center', justifyContent: 'center'
                          }}>
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                  <polyline points="14 2 14 8 20 8"></polyline>
                                  <line x1="16" y1="13" x2="8" y2="13"></line>
                                  <line x1="16" y1="17" x2="8" y2="17"></line>
                                  <polyline points="10 9 9 9 8 9"></polyline>
                              </svg>
                          </div>
                          <div>
                              <div style={{ fontWeight: 600, fontSize: 14, color: '#334155' }}>Anamneses</div>
                              <div style={{ fontSize: 12, color: '#64748b' }}>
                                  {detailsLoading ? 'Calculando...' : stats.pendingAnamnesis === 0 ? 'Tudo analisado' : `${stats.pendingAnamnesis} aguardando análise`}
                              </div>
                          </div>
                      </div>
                      <div style={{ color: '#94a3b8' }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="9 18 15 12 9 6"></polyline>
                          </svg>
                      </div>
                  </div>
              )}

          </div>
        </div>

        {/* Bloco Dietas */}
        <div style={cardStyle}>
          <h3 style={labelStyle}>Dietas</h3>
          <div style={valueStyle}>{stats.activeDiets + stats.inactiveDiets}</div>
          <div style={subValueStyle}>
            <span style={{ color: '#16a34a' }}>{stats.activeDiets} ativas</span> • 
            <span style={{ color: '#94a3b8' }}> {stats.inactiveDiets} inativas</span>
          </div>
        </div>

        {/* Bloco Treinos */}
        <div style={cardStyle}>
          <h3 style={labelStyle}>Treinos</h3>
          <div style={valueStyle}>{stats.activeWorkouts + stats.inactiveWorkouts}</div>
          <div style={subValueStyle}>
            <span style={{ color: '#16a34a' }}>{stats.activeWorkouts} ativos</span> • 
            <span style={{ color: '#94a3b8' }}> {stats.inactiveWorkouts} inativos</span>
          </div>
        </div>

      </div>

      {/* Gráfico de Faturamento Mensal (MRR) */}
      <div style={{ marginTop: 40, background: '#fff', padding: isMobile ? 16 : 24, borderRadius: 8, boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
              <h2 style={{ fontSize: isMobile ? 15 : 18, color: '#334155', margin: 0, lineHeight: 1.2 }}>Projeção de Faturamento (Competência)</h2>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', width: isMobile ? '100%' : 'auto' }}>
                  <select 
                      value={filters.month} 
                      onChange={e => setFilters(prev => ({ ...prev, month: e.target.value }))}
                      style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 14, color: '#475569', flex: isMobile ? 1 : 'unset', minWidth: isMobile ? 0 : 180 }}
                  >
                      <option value="all">Todos os Meses</option>
                      <option value="0">Janeiro</option>
                      <option value="1">Fevereiro</option>
                      <option value="2">Março</option>
                      <option value="3">Abril</option>
                      <option value="4">Maio</option>
                      <option value="5">Junho</option>
                      <option value="6">Julho</option>
                      <option value="7">Agosto</option>
                      <option value="8">Setembro</option>
                      <option value="9">Outubro</option>
                      <option value="10">Novembro</option>
                      <option value="11">Dezembro</option>
                  </select>
                  <select 
                      value={filters.year} 
                      onChange={e => setFilters(prev => ({ ...prev, year: Number(e.target.value) }))}
                      style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 14, color: '#475569', width: isMobile ? 96 : 'auto' }}
                  >
                      <option value={new Date().getFullYear() - 1}>{new Date().getFullYear() - 1}</option>
                      <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>
                      <option value={new Date().getFullYear() + 1}>{new Date().getFullYear() + 1}</option>
                  </select>
              </div>
          </div>
          
          <div style={{ width: '100%', height: isMobile ? 260 : 300 }}>
              {detailsLoading ? (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: 14 }}>
                  Carregando projeção de faturamento...
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: isMobile ? 12 : 30, right: isMobile ? 8 : 30, left: isMobile ? 0 : 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis 
                            dataKey="name" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fill: '#64748b', fontSize: isMobile ? 10 : 12 }} 
                            interval={0}
                            minTickGap={isMobile ? 4 : 12}
                            dy={10}
                        />
                        <YAxis 
                            axisLine={false} 
                            tickLine={false} 
                            width={isMobile ? 50 : 70}
                            tick={{ fill: '#64748b', fontSize: isMobile ? 10 : 12 }}
                            tickFormatter={(value) => isMobile ? `R$${Math.round(value / 1000)}k` : `R$ ${value}`}
                        />
                        <Tooltip 
                            cursor={{ fill: '#f1f5f9' }}
                            contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                            formatter={(value: number) => [
                                new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value), 
                                'Receita Est.'
                            ]}
                        />
                        <Bar 
                            dataKey="revenue" 
                            fill="#0ea5e9" 
                            radius={[4, 4, 0, 0]} 
                            barSize={isMobile ? 26 : 40}
                        >
                            {!isMobile && (
                              <LabelList 
                                dataKey="revenue" 
                                position="top" 
                                formatter={(value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)}
                                style={{ fontSize: 12, fill: '#64748b' }}
                              />
                            )}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
              )}
          </div>
      </div>

      <div style={{ marginTop: 40 }}>
        <h2 style={{ fontSize: 18, marginBottom: 15 }}>Ações Rápidas</h2>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <a href="/students/create" style={{ textDecoration: 'none', background: '#2563eb', color: '#fff', padding: '10px 20px', borderRadius: 6, fontSize: 14 }}>+ Novo Aluno</a>
            <a href="/protocols/workout-create" style={{ textDecoration: 'none', background: '#fff', color: '#2563eb', border: '1px solid #2563eb', padding: '10px 20px', borderRadius: 6, fontSize: 14 }}>+ Criar Treino</a>
            <a href="/protocols/diet-create" style={{ textDecoration: 'none', background: '#fff', color: '#2563eb', border: '1px solid #2563eb', padding: '10px 20px', borderRadius: 6, fontSize: 14 }}>+ Criar Dieta</a>
        </div>
      </div>
    </div>
  )
}
