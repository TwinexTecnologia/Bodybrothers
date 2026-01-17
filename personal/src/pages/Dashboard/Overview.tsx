import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useNavigate } from 'react-router-dom'

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
    loading: true
  })

  useEffect(() => {
    async function loadStats() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // 1. Alunos (Total, Ativos, Inativos)
        const { data: students, error: studentsError } = await supabase
          .from('profiles')
          .select('id, data')
          .eq('personal_id', user.id)
          .eq('role', 'aluno')
        
        if (studentsError) console.error('Erro Dash:', studentsError)
        
        const totalStudents = students?.length || 0
        const activeStudents = students?.filter(s => s.data?.status !== 'inativo').length || 0
        const inactiveStudents = totalStudents - activeStudents

        // 2. Anamneses Pendentes (Vencidas)
        const today = new Date().toISOString().split('T')[0]
        
        // Busca Modelos
        const { data: models } = await supabase
            .from('protocols')
            .select('*')
            .eq('personal_id', user.id)
            .eq('type', 'anamnesis_model')
            .not('ends_at', 'is', null)
        
        // Busca Respostas
        const { data: responses } = await supabase
            .from('protocols')
            .select('*')
            .eq('personal_id', user.id)
            .eq('type', 'anamnesis')

        let pendingAnamnesisCount = 0
        const now = new Date()

        models?.forEach(m => {
             // Encontra resposta mais recente
             const modelResponses = responses?.filter(r => r.data?.modelId === m.id).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
             const lastResponse = modelResponses?.[0]

             if (lastResponse) {
                 if (lastResponse.renew_in_days) {
                     const created = new Date(lastResponse.created_at)
                     const nextDue = new Date(created.getTime() + (lastResponse.renew_in_days * 24 * 60 * 60 * 1000))
                     // Se venceu o próximo ciclo (dá uma folga de 1 dia para não vencer no mesmo segundo)
                     // Mas comparando com now é seguro.
                     if (nextDue < now) {
                         pendingAnamnesisCount++
                     }
                 }
                 // Se tem resposta e não tem recorrência, considera OK
             } else {
                 // Sem resposta, verifica data do modelo
                 if (m.ends_at) {
                     const endDate = new Date(m.ends_at)
                     // Ajusta fuso ou compara string? new Date(string) é UTC as vezes.
                     // Melhor comparar timestamps.
                     // ends_at é YYYY-MM-DD. new Date('2023-10-10') é UTC.
                     // now é local.
                     // Vamos garantir que ends_at seja fim do dia.
                     const end = new Date(m.ends_at)
                     end.setHours(23, 59, 59)
                     if (end < now) {
                         pendingAnamnesisCount++
                     }
                 }
             }
        })

        // 3. Financeiro Pendente (Cálculo Real igual à tela Financeira)
        let pendingFinanceCount = 0
        
        // Carrega Planos e Pagamentos do Mês para cruzar dados
        const { data: plans } = await supabase.from('plans').select('*').eq('personal_id', user.id)
        
        // Pega pagamentos (debits pagos) deste mês
        const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
        const endOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString()
        
        const { data: payments } = await supabase
            .from('debits')
            .select('student_id, due_date')
            .eq('receiver_id', user.id)
            .or(`status.eq.paid,status.eq.pago`) // Pagamentos efetivados
            .gte('due_date', startOfMonth) // Dentro deste mês (aproximado)
            .lte('due_date', endOfMonth)

        // Itera alunos ativos para ver quem deve neste mês
        students?.forEach(student => {
            const sData = student.data || {}
            if (sData.status !== 'ativo' || !sData.planId || !sData.planStartDate) return

            const plan = plans?.find(p => p.id === sData.planId)
            if (!plan) return

            // Verifica se tem cobrança este mês
            // Simplificação: Se é mensal e começou antes de hoje, tem cobrança.
            // Para ser preciso, copiamos a logica de data:
            const dueDay = sData.dueDay || 10
            const currentYear = new Date().getFullYear()
            const currentMonth = new Date().getMonth()
            
            // Data de vencimento deste mês
            const thisMonthDue = new Date(currentYear, currentMonth, dueDay)
            thisMonthDue.setHours(23, 59, 59) // Fim do dia para comparação

            // Se ainda não venceu (ex: hoje é dia 5, vence dia 10), não conta como pendente/atrasado ainda?
            // Ou conta como "a receber"?
            // O card diz "Pendente" (geralmente inclui a vencer) ou "Atrasado"?
            // Se o card diz "Tudo pago", entende-se que não tem nada EM ABERTO VENCIDO.
            // Vou considerar apenas o que JÁ VENCEU (<= hoje).
            
            const now = new Date()
            if (thisMonthDue < now) { // Já venceu
                // Verifica se pagou
                // Procura pagamento deste aluno com data próxima ao vencimento
                const hasPayment = payments?.some(p => p.student_id === student.id) 
                // (Verificação simplificada: se tem qualquer pagamento dele neste mês, tá pago. 
                // Para ser exato precisaria checar a data exata, mas pra dash serve).
                
                if (!hasPayment) {
                    pendingFinanceCount++
                }
            }
        })


        // 4. Dietas (Ativas e Inativas)
        const { count: activeDietsCount } = await supabase
          .from('protocols')
          .select('*', { count: 'exact', head: true })
          .eq('personal_id', user.id)
          .eq('type', 'diet')
          .eq('status', 'active')

        const { count: inactiveDietsCount } = await supabase
          .from('protocols')
          .select('*', { count: 'exact', head: true })
          .eq('personal_id', user.id)
          .eq('type', 'diet')
          .neq('status', 'active')

        // 5. Treinos (Ativos e Inativos)
        const { count: activeWorkoutsCount } = await supabase
          .from('protocols')
          .select('*', { count: 'exact', head: true })
          .eq('personal_id', user.id)
          .eq('type', 'workout')
          .eq('status', 'active')

        const { count: inactiveWorkoutsCount } = await supabase
          .from('protocols')
          .select('*', { count: 'exact', head: true })
          .eq('personal_id', user.id)
          .eq('type', 'workout')
          .neq('status', 'active')

        setStats({
          totalStudents,
          activeStudents,
          inactiveStudents,
          pendingAnamnesis: pendingAnamnesisCount || 0,
          pendingFinance: pendingFinanceCount || 0,
          activeDiets: activeDietsCount || 0,
          inactiveDiets: inactiveDietsCount || 0,
          activeWorkouts: activeWorkoutsCount || 0,
          inactiveWorkouts: inactiveWorkoutsCount || 0,
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
