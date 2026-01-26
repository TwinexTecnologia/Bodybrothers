import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { isStudentOverdue, generateExpectedCharges } from '../../lib/finance_utils'
import type { StudentRecord } from '../../store/students'
import type { PlanRecord } from '../../store/plans'
import type { DebitRecord } from '../../store/financial'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from 'recharts'

export default function Overview() {
  const navigate = useNavigate()
  const [filters, setFilters] = useState({
    year: new Date().getFullYear(),
    month: 'all' // 'all' or '0', '1', ... '11'
  })

  const [rawData, setRawData] = useState({
    students: [] as StudentRecord[],
    plans: [] as PlanRecord[],
    payments: [] as DebitRecord[]
  })

  const [chartData, setChartData] = useState<{ name: string, revenue: number }[]>([])

  const [stats, setStats] = useState({
    totalStudents: 0,
    activeStudents: 0,
    inactiveStudents: 0,
    pendingAnamnesis: 0,
    pendingFinance: 0,
    activeDiets: 0,
    inactiveDiets: 0,
    activeWorkouts: 0,
    inactiveWorkouts: 0,
    monthlyRevenue: 0,
    monthlyCash: 0, // Novo estado para Caixa
    loading: true
  })

  // Recalcula gráfico quando filtros ou dados mudam
  useEffect(() => {
      if (stats.loading) return

      const { year, month } = filters
      const { students, plans, payments } = rawData
      
      const newChartData = []
      
      // Inicializa acumuladores para os 12 meses do ano selecionado
      const monthTotals = new Array(12).fill(0)

      // Itera APENAS pagamentos recebidos (Caixa -> Competência)
      payments.forEach(payment => {
          if (!payment.paidAt && !payment.dueDate) return
          const baseDate = new Date(payment.dueDate || payment.paidAt!)
          
          const student = students.find(s => s.id === payment.payerId)
          let monthsToDistribute = 1
          
          if (student && student.planId) {
              const plan = plans.find(p => p.id === student.planId)
              if (plan) {
                  switch (plan.frequency) {
                      case 'weekly': monthsToDistribute = 1; break
                      case 'monthly': monthsToDistribute = 1; break
                      case 'bimonthly': monthsToDistribute = 2; break
                      case 'quarterly': monthsToDistribute = 3; break
                      case 'semiannual': monthsToDistribute = 6; break
                      case 'annual': monthsToDistribute = 12; break
                      default: monthsToDistribute = 1
                  }
              }
          }

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
      
      for (let m = startMonth; m <= endMonth; m++) {
          const monthStart = new Date(year, m, 1)
          const total = monthTotals[m]
          
          if (Math.round(total) > 0) {
              newChartData.push({
                  name: monthStart.toLocaleDateString('pt-BR', { month: 'short' }).toUpperCase(),
                  revenue: Math.round(total)
              })
          }
      }
      
      setChartData(newChartData)

  }, [filters, rawData, stats.loading])

  useEffect(() => {
    async function loadStats() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const [
            studentsRes,
            plansRes,
            paymentsRes,
            anamnesisRes,
            modelsRes,
            dietsActiveRes,
            dietsInactiveRes,
            workoutsActiveRes,
            workoutsInactiveRes
        ] = await Promise.all([
            supabase.from('profiles').select('*').eq('personal_id', user.id).eq('role', 'aluno'),
            supabase.from('plans').select('*').eq('personal_id', user.id),
            supabase.from('debits').select('*').eq('receiver_id', user.id).eq('status', 'paid'),
            supabase.from('protocols').select('*').eq('personal_id', user.id).eq('type', 'anamnesis'),
            supabase.from('protocols').select('*').eq('personal_id', user.id).eq('type', 'anamnesis_model'),
            supabase.from('protocols').select('*', { count: 'exact', head: true }).eq('personal_id', user.id).eq('type', 'diet').eq('status', 'active'),
            supabase.from('protocols').select('*', { count: 'exact', head: true }).eq('personal_id', user.id).eq('type', 'diet').neq('status', 'active'),
            supabase.from('protocols').select('*', { count: 'exact', head: true }).eq('personal_id', user.id).eq('type', 'workout').eq('status', 'active'),
            supabase.from('protocols').select('*', { count: 'exact', head: true }).eq('personal_id', user.id).eq('type', 'workout').neq('status', 'active')
        ])

        const studentsRaw = studentsRes.data || []
        const students: StudentRecord[] = studentsRaw.map((d: any) => ({
            id: d.id,
            personalId: d.personal_id,
            name: d.full_name || '',
            email: d.email || '',
            status: d.data?.status || 'ativo',
            createdAt: d.created_at,
            planId: d.plan_id || d.data?.planId,
            planStartDate: d.data?.planStartDate,
            dueDay: d.due_day || d.data?.dueDay,
            whatsapp: d.data?.whatsapp,
        })) as any

        const totalStudents = students.length
        const activeStudentsList = students.filter(s => s.status !== 'inativo')
        const activeStudents = activeStudentsList.length
        const inactiveStudents = totalStudents - activeStudents

        const plans = (plansRes.data || []) as PlanRecord[]
        
        const paymentsRaw = paymentsRes.data || []
        const allPayments: DebitRecord[] = paymentsRaw.map((d: any) => ({
            id: d.id,
            payerId: d.payer_id,
            receiverId: d.receiver_id,
            amount: Number(d.amount),
            dueDate: d.due_date,
            paidAt: d.paid_at,
            status: d.status,
            monthRef: d.saas_ref_month
        }))

        // Salva dados brutos
        setRawData({
            students: activeStudentsList,
            plans,
            payments: allPayments
        })

        // CALCULO DO CARD "Faturamento Mensal (Mês Atual)"
        // 1. Regime de Competência (monthlyRevenue)
        let monthlyRevenue = 0
        const now = new Date()
        const currentMonth = now.getMonth()
        const currentYear = now.getFullYear()

        // 2. Regime de Caixa (monthlyCash) - O que realmente entrou na conta
        let monthlyCash = 0

        allPayments.forEach(payment => {
            if (!payment.paidAt && !payment.dueDate) return
            
            // Calculo Caixa: Se pagou neste mês, soma
            if (payment.paidAt) {
                const paidDate = new Date(payment.paidAt)
                // Ajuste de fuso horário simples para garantir dia correto se necessário
                // Mas new Date(iso) costuma funcionar bem.
                if (paidDate.getMonth() === currentMonth && paidDate.getFullYear() === currentYear) {
                    monthlyCash += payment.amount
                }
            }

            // Calculo Competência (mantendo lógica anterior)
            const baseDate = new Date(payment.dueDate || payment.paidAt!)
            const student = activeStudentsList.find(s => s.id === payment.payerId)
            let monthsToDistribute = 1
            if (student && student.planId) {
                const plan = plans.find(p => p.id === student.planId)
                if (plan) {
                     switch (plan.frequency) {
                      case 'weekly': monthsToDistribute = 1; break
                      case 'monthly': monthsToDistribute = 1; break
                      case 'bimonthly': monthsToDistribute = 2; break
                      case 'quarterly': monthsToDistribute = 3; break
                      case 'semiannual': monthsToDistribute = 6; break
                      case 'annual': monthsToDistribute = 12; break
                      default: monthsToDistribute = 1
                  }
                }
            }
            
            const monthlyValue = payment.amount / monthsToDistribute
            
            for (let i = 0; i < monthsToDistribute; i++) {
                const targetDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + i, 1)
                if (targetDate.getMonth() === currentMonth && targetDate.getFullYear() === currentYear) {
                    monthlyRevenue += monthlyValue
                }
            }
        })
        
        // CALCULO FINANCEIRO (Quem deve REALMENTE)
        let pendingFinanceCount = 0
        const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
        const endOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString()
        // const now = new Date() // Já declarado

        activeStudentsList.forEach(student => {
            if (!student.planId || !student.planStartDate) return
            const plan = plans.find(p => p.id === student.planId)
            if (!plan) return
            const studentPayments = allPayments.filter(p => p.payerId === student.id)
            const currentMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
            const currentMonthEnd = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)
            const dueDates = generateExpectedCharges(student, plan, currentMonthEnd)
            const thisMonthDueDates = dueDates.filter(d => d >= currentMonthStart && d <= currentMonthEnd)
            
            let isOverdue = false
            for (const due of thisMonthDueDates) {
                const dueLimit = new Date(due)
                dueLimit.setHours(23, 59, 59)
                if (now > dueLimit) {
                    const dueStr = due.toISOString().split('T')[0]
                    const hasPayment = studentPayments.some(p => {
                         if (p.dueDate === dueStr) return true
                         if (p.monthRef) {
                             const pDate = new Date(p.monthRef)
                             return pDate.getMonth() === due.getMonth() && pDate.getFullYear() === due.getFullYear()
                         }
                         return false
                    })
                    if (!hasPayment) {
                        isOverdue = true
                        break
                    }
                }
            }
            if (isOverdue) pendingFinanceCount++
        })

        // CALCULO ANAMNESES
        let pendingAnamnesisCount = 0
        const allAnamnesis = anamnesisRes.data || []
        const allModels = modelsRes.data || []

        activeStudentsList.forEach(student => {
            const hasLinkedModel = allModels.some(m => m.student_id === student.id)
            if (!hasLinkedModel) return
            const studentResponses = allAnamnesis.filter(a => a.student_id === student.id)
            if (studentResponses.length > 0) {
                studentResponses.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                const last = studentResponses[0]
                const renewDays = last.renew_in_days || 90
                if (renewDays) {
                    const created = new Date(last.created_at)
                    const expireDate = new Date(created.getTime() + (renewDays * 24 * 60 * 60 * 1000))
                    expireDate.setHours(0, 0, 0, 0)
                    const nowZero = new Date(now)
                    nowZero.setHours(0,0,0,0)
                    if (expireDate <= nowZero) {
                        pendingAnamnesisCount++
                    }
                }
            }
        })
        
        setStats({
          totalStudents,
          activeStudents,
          inactiveStudents,
          pendingAnamnesis: pendingAnamnesisCount,
          pendingFinance: pendingFinanceCount,
          activeDiets: dietsActiveRes.count || 0,
          inactiveDiets: dietsInactiveRes.count || 0,
          activeWorkouts: workoutsActiveRes.count || 0,
          inactiveWorkouts: workoutsInactiveRes.count || 0,
          monthlyRevenue,
          monthlyCash,
          loading: false
        })

      } catch (error) {
        console.error('Erro ao carregar dashboard:', error)
        setStats(prev => ({ ...prev, loading: false }))
      }
    }

    loadStats()
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
              
              {/* Item Anamneses */}
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
                    borderLeft: `4px solid ${stats.pendingAnamnesis > 0 ? '#ef4444' : '#22c55e'}`,
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
                          background: stats.pendingAnamnesis > 0 ? '#fee2e2' : '#dcfce7',
                          color: stats.pendingAnamnesis > 0 ? '#dc2626' : '#16a34a',
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
                              {stats.pendingAnamnesis === 0 ? 'Tudo em dia' : `${stats.pendingAnamnesis} vencidas`}
                          </div>
                      </div>
                  </div>
                  <div style={{ color: '#94a3b8' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="9 18 15 12 9 6"></polyline>
                      </svg>
                  </div>
              </div>

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
                              {stats.pendingFinance === 0 ? 'Tudo pago' : `${stats.pendingFinance} pendentes`}
                          </div>
                      </div>
                  </div>
                  <div style={{ color: '#94a3b8' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="9 18 15 12 9 6"></polyline>
                      </svg>
                  </div>
              </div>

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
      <div style={{ marginTop: 40, background: '#fff', padding: 24, borderRadius: 8, boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
              <h2 style={{ fontSize: 18, color: '#334155', margin: 0 }}>Projeção de Faturamento (Competência)</h2>
              <div style={{ display: 'flex', gap: 10 }}>
                  <select 
                      value={filters.month} 
                      onChange={e => setFilters(prev => ({ ...prev, month: e.target.value }))}
                      style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 14, color: '#475569' }}
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
                      style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 14, color: '#475569' }}
                  >
                      <option value={new Date().getFullYear() - 1}>{new Date().getFullYear() - 1}</option>
                      <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>
                      <option value={new Date().getFullYear() + 1}>{new Date().getFullYear() + 1}</option>
                  </select>
              </div>
          </div>
          
          <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 30, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis 
                          dataKey="name" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fill: '#64748b', fontSize: 12 }} 
                          dy={10}
                      />
                      <YAxis 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fill: '#64748b', fontSize: 12 }}
                          tickFormatter={(value) => `R$ ${value}`}
                          domain={[0, (dataMax: number) => (dataMax * 1.2)]}
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
                          barSize={40}
                      >
                          <LabelList 
                            dataKey="revenue" 
                            position="top" 
                            formatter={(value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)}
                            style={{ fontSize: 12, fill: '#64748b' }}
                          />
                      </Bar>
                  </BarChart>
              </ResponsiveContainer>
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