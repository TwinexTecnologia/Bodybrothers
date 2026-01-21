import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { isStudentOverdue, generateExpectedCharges } from '../../lib/finance_utils'
import type { StudentRecord } from '../../store/students'
import type { PlanRecord } from '../../store/plans'
import type { DebitRecord } from '../../store/financial'

export default function Overview() {
  const navigate = useNavigate()
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
    loading: true
  })

  useEffect(() => {
    async function loadStats() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // 1. Carrega TUDO em paralelo para ser rápido
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
            // Alunos
            supabase.from('profiles').select('*').eq('personal_id', user.id).eq('role', 'aluno'),
            // Planos
            supabase.from('plans').select('*').eq('personal_id', user.id),
            // Pagamentos (Todos os pagos)
            supabase.from('debits').select('*').eq('receiver_id', user.id).eq('status', 'paid'),
            // Anamneses (Todas as respostas)
            supabase.from('protocols').select('*').eq('personal_id', user.id).eq('type', 'anamnesis'),
            // Modelos
            supabase.from('protocols').select('*').eq('personal_id', user.id).eq('type', 'anamnesis_model'),
            // Contadores
            supabase.from('protocols').select('*', { count: 'exact', head: true }).eq('personal_id', user.id).eq('type', 'diet').eq('status', 'active'),
            supabase.from('protocols').select('*', { count: 'exact', head: true }).eq('personal_id', user.id).eq('type', 'diet').neq('status', 'active'),
            supabase.from('protocols').select('*', { count: 'exact', head: true }).eq('personal_id', user.id).eq('type', 'workout').eq('status', 'active'),
            supabase.from('protocols').select('*', { count: 'exact', head: true }).eq('personal_id', user.id).eq('type', 'workout').neq('status', 'active')
        ])

        // Processa Alunos
        const studentsRaw = studentsRes.data || []
        // Mapeia para StudentRecord parcial necessário para as utils
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
            // ... outros campos se necessário
        })) as any

        const totalStudents = students.length
        const activeStudentsList = students.filter(s => s.status !== 'inativo')
        const activeStudents = activeStudentsList.length
        const inactiveStudents = totalStudents - activeStudents

        // Processa Planos
        const plans = (plansRes.data || []) as PlanRecord[]

        // CALCULO DE RECEITA MENSAL RECORRENTE (MRR)
        // Baseado em alunos ativos e seus planos
        let monthlyRevenue = 0
        
        activeStudentsList.forEach(student => {
            if (!student.planId) return
            const plan = plans.find(p => p.id === student.planId)
            if (!plan) return
            
            const price = Number(plan.price) || 0
            
            // Normaliza para valor mensal
            switch (plan.frequency) {
                case 'weekly':
                    monthlyRevenue += price * 4
                    break
                case 'monthly':
                    monthlyRevenue += price
                    break
                case 'bimonthly': // Bimestral
                    monthlyRevenue += price / 2
                    break
                case 'quarterly': // Trimestral
                    monthlyRevenue += price / 3
                    break
                case 'semiannual': // Semestral
                    monthlyRevenue += price / 6
                    break
                case 'annual': // Anual
                    monthlyRevenue += price / 12
                    break
                default:
                    monthlyRevenue += price // Fallback (assume mensal)
            }
        })

        // Processa Pagamentos
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

        // CALCULO FINANCEIRO (Quem deve REALMENTE)
        let pendingFinanceCount = 0
        const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
        const endOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString()
        const now = new Date()

        activeStudentsList.forEach(student => {
            // Ignora quem não tem plano vinculado ou data de inicio
            if (!student.planId || !student.planStartDate) return
            
            const plan = plans.find(p => p.id === student.planId)
            // Se o plano não existe mais, ignora
            if (!plan) return

            // Filtra pagamentos deste aluno
            const studentPayments = allPayments.filter(p => p.payerId === student.id)
            
            // Verifica inadimplência APENAS DO MÊS ATUAL
            // Motivo: O usuário não possui histórico lançado, então olhar para trás gera falsos positivos.
            // O Dashboard deve refletir o que está na tela "Financeiro" (Mês Atual).
            
            const currentMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
            const currentMonthEnd = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)
            
            // Gera cobranças apenas dentro deste mês
            const dueDates = generateExpectedCharges(student, plan, currentMonthEnd)
            const thisMonthDueDates = dueDates.filter(d => d >= currentMonthStart && d <= currentMonthEnd)
            
            let isOverdue = false
            // const now = new Date() // Já declarado acima
            
            for (const due of thisMonthDueDates) {
                // Se a data de vencimento já passou (Ontem ou antes)
                const dueLimit = new Date(due)
                dueLimit.setHours(23, 59, 59)
                
                if (now > dueLimit) {
                    // É um atraso POTENCIAL. Verifica se foi pago.
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
            
            if (isOverdue) {
                pendingFinanceCount++
            }
        })

        // CALCULO ANAMNESES (Quem está vencido ou nunca respondeu)
        let pendingAnamnesisCount = 0
        const allAnamnesis = anamnesisRes.data || []
        const allModels = modelsRes.data || []
        // const now = new Date() // Já declarado acima

        activeStudentsList.forEach(student => {
            // Regra:
            // O usuário solicitou: "só para quem tem anamnese vinculada"
            // Ou seja, ignorar modelos globais (biblioteca). Apenas modelos onde student_id == student.id
            
            const hasLinkedModel = allModels.some(m => m.student_id === student.id)
            
            if (!hasLinkedModel) return // Pula este aluno se não tiver anamnese vinculada

            // Pega respostas deste aluno
            const studentResponses = allAnamnesis.filter(a => a.student_id === student.id)
            
            if (studentResponses.length === 0) {
                 // Tem modelo vinculado mas nunca respondeu.
                 // Pela sua instrução: "esses casos que nunca respondeu nao entra pq nao tem anamnese acoplada neles"
                 // Isso implica que, se nunca respondeu, não consideramos "vencida" ou pendente.
                 // Apenas ignoramos.
            } else {
                // Tem respostas, pega a mais recente
                // Ordena por created_at desc
                studentResponses.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                const last = studentResponses[0]
                
                // Verifica validade
                const renewDays = last.renew_in_days || 90 // Default 90 se não definido?
                if (renewDays) {
                    const created = new Date(last.created_at)
                    const expireDate = new Date(created.getTime() + (renewDays * 24 * 60 * 60 * 1000))
                    
                    // Zera hora para comparar apenas data (Início do dia)
                    // Se vence hoje (0 dias), JÁ DEVE CONTAR como vencida para o personal renovar.
                    expireDate.setHours(0, 0, 0, 0)
                    
                    // Se a data de expiração (hoje 00:00) for menor ou igual a agora (hoje 10:00), conta.
                    // Mas a lógica (expireDate < now) já faz isso se now tiver hora.
                    // Para garantir: Se expireDate <= now (comparando datas puras), conta.
                    
                    const nowZero = new Date(now)
                    nowZero.setHours(0,0,0,0)
                    
                    if (expireDate <= nowZero) {
                        pendingAnamnesisCount++
                    }
                }
            }
            // Se nunca respondeu (length === 0), NÃO conta como vencida/pendente.
            // O sistema só avisa renovação.
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
          <h3 style={labelStyle}>Faturamento Mensal Est.</h3>
          <div style={{ ...valueStyle, color: '#0ea5e9' }}>
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.monthlyRevenue)}
          </div>
          <div style={subValueStyle}>
             Baseado nos planos ativos
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
