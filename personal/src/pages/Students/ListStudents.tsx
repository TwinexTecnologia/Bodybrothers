import { useEffect, useState } from 'react'
import { listStudentsByPersonal, toggleStudentActive, getStudentsWeeklyFrequency, type StudentRecord } from '../../store/students'
import { listPlans, type PlanRecord } from '../../store/plans'
import { listActiveWorkouts, type WorkoutRecord } from '../../store/workouts'
import { listAllAnamnesis, listResponsesByPersonal, type AnamnesisModel, type AnamnesisResponse } from '../../store/anamnesis'
import { listAllDietsByPersonal, type DietRecord } from '../../store/diets'
import { listRecentPayments, type DebitRecord } from '../../store/financial'
import { supabase } from '../../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { MessageSquare, BarChart2, ClipboardList } from 'lucide-react'
import StudentFeedbackModal from '../../components/StudentFeedbackModal'
import StudentAnamnesisModal from '../../components/StudentAnamnesisModal'

// Helper de Status Financeiro (Baseado em Validade Real)
const getFinancialStatus = (student: StudentRecord, plan: PlanRecord | undefined, payments: DebitRecord[]) => {
    if (!plan || !student.planStartDate) return { status: 'none', label: '—', color: '#9ca3af', bg: 'transparent', daysDiff: null }
    
    // 1. Pega último pagamento
    const myPayments = payments.filter(p => p.payerId === student.id).sort((a, b) => {
        const dateA = new Date(a.paidAt || a.dueDate || 0).getTime()
        const dateB = new Date(b.paidAt || b.dueDate || 0).getTime()
        return dateB - dateA
    })
    const lastPayment = myPayments[0]
    const now = new Date()

    // 2. Se nunca pagou
    if (!lastPayment) {
        const start = new Date(student.planStartDate)
        const diffTime = now.getTime() - start.getTime()
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
        
        // Se começou há menos de 5 dias, considera Pendente (Amarelo)
        if (diffDays <= 5) return { status: 'pending', label: 'NOVO', color: '#f59e0b', bg: '#fef3c7', daysDiff: diffDays }
        // Se já passou, Atrasado (Vermelho)
        return { status: 'overdue', label: 'ATRASADO', color: '#ef4444', bg: '#fee2e2', daysDiff: diffDays }
    }

    // 3. Calcula validade
    let validityDays = 30
    switch (plan.frequency) {
        case 'weekly': validityDays = 7; break
        case 'monthly': validityDays = 30; break
        case 'bimonthly': validityDays = 60; break
        case 'quarterly': validityDays = 90; break
        case 'semiannual': validityDays = 180; break
        case 'annual': validityDays = 365; break
    }

    const refDate = new Date(lastPayment.paidAt || lastPayment.dueDate || 0)
    const validUntil = new Date(refDate)
    validUntil.setDate(validUntil.getDate() + validityDays)

    // Dias restantes para vencer (negativo = vencido)
    const diffTime = validUntil.getTime() - now.getTime()
    const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (daysRemaining < 0) {
        // Vencido
        // Se venceu há pouco tempo (até 3 dias), mostra como pendente/atenção
        if (daysRemaining > -4) return { status: 'pending', label: 'VENCEU', color: '#f59e0b', bg: '#fef3c7', daysDiff: Math.abs(daysRemaining) }
        return { status: 'overdue', label: 'ATRASADO', color: '#ef4444', bg: '#fee2e2', daysDiff: Math.abs(daysRemaining) }
    } else {
        // Em dia
        // Se falta pouco para vencer (5 dias), avisa
        if (daysRemaining <= 5) return { status: 'warning', label: 'VENCE LOGO', color: '#f59e0b', bg: '#fffbeb', daysDiff: daysRemaining }
        return { status: 'paid', label: 'EM DIA', color: '#166534', bg: '#dcfce7', daysDiff: daysRemaining }
    }
}

const getAnamnesisStatus = (studentId: string, allAnamneses: AnamnesisModel[], allResponses: AnamnesisResponse[]) => {
    const studentAnamneses = allAnamneses.filter(a => a.studentId === studentId)
    
    if (studentAnamneses.length === 0) return { status: 'pending', label: 'Pendente', color: '#9ca3af', fontWeight: 400 }

    try {
        // Pega o modelo mais recente (para saber a validade padrão se precisar)
        const sorted = studentAnamneses.sort((a, b) => {
            const da = a.validUntil ? new Date(a.validUntil).getTime() : Infinity
            const db = b.validUntil ? new Date(b.validUntil).getTime() : Infinity
            return da - db
        })
        const nearest = sorted[0]
        
        // CORREÇÃO: Busca a última resposta do aluno INDEPENDENTE DO MODELO ATIVO
        const studentResponses = allResponses
            .filter(r => r.studentId === studentId)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            
        const lastResponse = studentResponses[0]

        // LÓGICA HÍBRIDA: Manual (Check) vs Automática (Mensal)
        if (lastResponse) {
                const data = lastResponse.data || lastResponse.content || {}
                
                // CASO 1: Personal revisou e definiu dias manualmente (renew_in_days existe)
                if (data.renew_in_days && data.reviewed_at) {
                    const reviewDate = new Date(data.reviewed_at)
                    reviewDate.setHours(0, 0, 0, 0)
                    
                    const daysToAdd = parseInt(data.renew_in_days)
                    
                    const dueDate = new Date(reviewDate)
                    dueDate.setDate(dueDate.getDate() + daysToAdd)
                    dueDate.setHours(23, 59, 59, 999) 
                    
                    const now = new Date()
                    now.setHours(0, 0, 0, 0)
                    
                    const daysLeft = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) - 1 
                    
                    if (daysLeft < 0) return { status: 'overdue', label: `🔴 Vencida (${Math.abs(daysLeft)}d)`, color: '#ef4444', fontWeight: 600 }
                    if (daysLeft === 0) return { status: 'warning', label: `🟡 Vence Hoje`, color: '#f59e0b', fontWeight: 600 }
                    return { status: 'ok', label: `✅ ${daysLeft} dias`, color: '#10b981', fontWeight: 600 }
                }

                // CASO 2: Lógica Automática (Projeção Mensal baseada na data original DO MODELO ATIVO)
                if (nearest && nearest.validUntil) {
                    const validDate = new Date(nearest.validUntil)
                    if (!isNaN(validDate.getTime())) {
                        const now = new Date()
                        now.setHours(0, 0, 0, 0)
                        
                        const validLocal = new Date(validDate.getUTCFullYear(), validDate.getUTCMonth(), validDate.getUTCDate())
                        validLocal.setHours(0, 0, 0, 0)

                        let nextDueDate = new Date(validLocal)
                        const today = new Date()
                        today.setHours(0,0,0,0)
                        
                        while (nextDueDate < today) {
                            nextDueDate.setMonth(nextDueDate.getMonth() + 1)
                        }
                        const daysLeft = Math.ceil((nextDueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
                        return { status: 'ok', label: `✅ ${daysLeft} dias`, color: '#10b981', fontWeight: 600 }
                    }
                }
        }
        
        // Sem resposta ainda
        if (nearest && nearest.validUntil) {
            const validDate = new Date(nearest.validUntil)
            if (!isNaN(validDate.getTime())) {
                const now = new Date()
                now.setHours(0, 0, 0, 0)
                const validLocal = new Date(validDate.getUTCFullYear(), validDate.getUTCMonth(), validDate.getUTCDate())
                validLocal.setHours(0, 0, 0, 0)
                let daysLeft = Math.ceil((validLocal.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

                if (daysLeft < 0) {
                     return { status: 'overdue', label: `🔴 Vencida (${Math.abs(daysLeft)}d)`, color: '#ef4444', fontWeight: 600 }
                }
                return { status: 'ok', label: `✅ ${daysLeft} dias`, color: '#10b981', fontWeight: 600 }
            }
        }
        
        return { status: 'none', label: 'Sem validade', color: '#6b7280', fontWeight: 400 }

    } catch (err) {
        return { status: 'error', label: 'Erro Data', color: '#ef4444', fontWeight: 400 }
    }
}

export default function ListStudents() {
  const navigate = useNavigate()
  const [students, setStudents] = useState<StudentRecord[]>([])
  const [plans, setPlans] = useState<PlanRecord[]>([])
  const [workouts, setWorkouts] = useState<WorkoutRecord[]>([])
  const [diets, setDiets] = useState<DietRecord[]>([])
  const [anamneses, setAnamneses] = useState<AnamnesisModel[]>([])
  const [responses, setResponses] = useState<AnamnesisResponse[]>([])
  const [payments, setPayments] = useState<DebitRecord[]>([])
  const [frequencies, setFrequencies] = useState<Record<string, number>>({})
  const [selectedStudentForFeedback, setSelectedStudentForFeedback] = useState<StudentRecord | null>(null)
  const [selectedStudentForAnamnesis, setSelectedStudentForAnamnesis] = useState<StudentRecord | null>(null)
  
  const [query, setQuery] = useState('')
  const [financialFilter, setFinancialFilter] = useState('all')
  const [planFilter, setPlanFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [anamnesisFilter, setAnamnesisFilter] = useState('all')
  const [loading, setLoading] = useState(true)

  async function loadData() {
    setLoading(true)
    
    // Timeout de segurança
    const timer = setTimeout(() => {
        setLoading(false)
        console.warn('Timeout forçado no carregamento de alunos.')
    }, 8000)

    try {
      console.log('Iniciando carga de alunos...')
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        // 1. Carrega Alunos PRIMEIRO
        const s = await listStudentsByPersonal(user.id)
        console.log('Alunos carregados:', s.length)
        setStudents(s)
        
        // Carrega frequências
        if (s.length > 0) {
            getStudentsWeeklyFrequency(s.map(x => x.id)).then(f => setFrequencies(f))
        }

        clearTimeout(timer) // Cancela timeout se deu certo
        setLoading(false) // Libera a tela

        // 2. Carrega detalhes em segundo plano
        Promise.all([
            listPlans(user.id),
            listActiveWorkouts(user.id),
            listAllAnamnesis(user.id),
            listResponsesByPersonal(user.id),
            listAllDietsByPersonal(user.id),
            listRecentPayments(user.id)
        ]).then(([p, w, a, r, d, pay]) => {
            console.log('Detalhes carregados em background')
            setPlans(p)
            setWorkouts(w)
            setAnamneses(a)
            setResponses(r)
            setDiets(d)
            setPayments(pay)
        }).catch(err => console.error('Erro carregando detalhes:', err))
      } else {
          clearTimeout(timer)
          setLoading(false)
      }
    } catch (error) {
      console.error(error)
      clearTimeout(timer)
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleToggle = async (s: StudentRecord) => {
      const ok = await toggleStudentActive(s.id, s.status === 'ativo' ? 'inativo' : 'ativo')
      if (ok) {
          setStudents(prev => prev.map(x => x.id === s.id ? { ...x, status: x.status === 'ativo' ? 'inativo' : 'ativo' } : x))
      }
  }

  const filtered = students.filter(s => {
    const q = query.toLowerCase()
    const addr = s.address ? `${s.address.street} ${s.address.number || ''} ${s.address.neighborhood || ''} ${s.address.city || ''} ${s.address.state || ''} ${s.address.cep || ''} ${s.address.complement || ''}`.toLowerCase() : ''
    const matchesQuery = s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q) || addr.includes(q)
    
    if (!matchesQuery) return false

    // Status Aluno
    if (statusFilter !== 'all' && s.status !== statusFilter) return false
    
    // Plano
    if (planFilter !== 'all' && s.planId !== planFilter) return false
    
    // Financeiro
    const plan = plans.find(p => p.id === s.planId)
    const finStatus = getFinancialStatus(s, plan, payments).status
    if (financialFilter !== 'all' && finStatus !== financialFilter) return false

    // Anamnese
    if (anamnesisFilter !== 'all') {
        const anamStatus = getAnamnesisStatus(s.id, anamneses, responses).status
        // 'ok': ok, warning
        // 'pending': pending, overdue, error, none
        if (anamnesisFilter === 'ok') {
            if (anamStatus !== 'ok' && anamStatus !== 'warning') return false
        } else if (anamnesisFilter === 'pending') {
            if (anamStatus !== 'pending' && anamStatus !== 'overdue' && anamStatus !== 'error' && anamStatus !== 'none') return false
        } else if (anamnesisFilter === 'overdue') {
            if (anamStatus !== 'overdue') return false
        }
    }
    
    return true
  }).sort((a, b) => a.name.localeCompare(b.name))

  const inputStyle = {
      padding: '10px 14px',
      borderRadius: 8,
      border: '1px solid #e2e8f0',
      backgroundColor: '#fff',
      fontSize: '0.9rem',
      color: '#334155',
      boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
      outline: 'none',
      minWidth: 160
  }

  // Debug State
  const [debugData, setDebugData] = useState<any>(null)
  const [simulateDays, setSimulateDays] = useState('30')
  const [savingDebug, setSavingDebug] = useState(false)

  const toggleDebug = (studentId: string) => {
      const studentAnamneses = anamneses.filter(a => a.studentId === studentId)
      const sorted = studentAnamneses.sort((a, b) => {
          const da = a.validUntil ? new Date(a.validUntil).getTime() : Infinity
          const db = b.validUntil ? new Date(b.validUntil).getTime() : Infinity
          return da - db
      })
      const nearest = sorted[0]
      
      let debugInfo = { msg: 'Sem anamnese', studentId }
      
      if (nearest && nearest.validUntil) {
          const modelResponses = responses.filter(r => r.modelId === nearest.id).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          const lastResponse = modelResponses[0]
          
          if (lastResponse) {
              const data = lastResponse.data || lastResponse.content || {}
              debugInfo = {
                  ...debugInfo,
                  msg: 'Dados encontrados',
                  responseId: lastResponse.id,
                  createdAt: lastResponse.createdAt,
                  reviewedAt: data.reviewed_at,
                  renewInDays: data.renew_in_days,
                  raw_data: data
              }
          } else {
              debugInfo = { ...debugInfo, msg: 'Sem resposta vinculada ao modelo' }
          }
      } else {
         // Tenta achar qualquer resposta do aluno
         const anyResponse = responses.filter(r => r.studentId === studentId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
         if(anyResponse) {
             debugInfo = { ...debugInfo, msg: 'Tem resposta mas sem modelo ativo', responseId: anyResponse.id }
         }
      }
      setDebugData(debugInfo)
  }

  const handleSimulateCheck = async () => {
      if (!debugData || !debugData.responseId) return
      setSavingDebug(true)
      try {
          const newData = {
              ...debugData.raw_data,
              reviewed_at: new Date().toISOString(),
              renew_in_days: simulateDays
          }
          
          const { error } = await supabase
            .from('protocols')
            .update({ data: newData })
            .eq('id', debugData.responseId)

          if (error) throw error
          
          alert(`Salvo com sucesso! ${simulateDays} dias.`)
          window.location.reload() // Recarrega para ver a mudança
      } catch (err) {
          alert('Erro ao salvar: ' + JSON.stringify(err))
      } finally {
          setSavingDebug(false)
      }
  }

  return (
    <div>
      {/* Indicador de Versão e Debug */}
      <div style={{background: '#8b5cf6', color: '#fff', padding: 8, fontSize: 12, marginBottom: 10, borderRadius: 4}}>
         <div style={{fontWeight: 'bold', textAlign: 'center'}}>✅ v3.3 - Debug + Simulador de Check</div>
         {debugData && (
             <div style={{marginTop: 8, background: 'rgba(0,0,0,0.2)', padding: 8, borderRadius: 4, fontFamily: 'monospace', whiteSpace: 'pre-wrap'}}>
                 {JSON.stringify(debugData, null, 2)}
                 
                 {debugData.responseId && (
                     <div style={{marginTop: 10, borderTop: '1px solid rgba(255,255,255,0.3)', paddingTop: 10}}>
                        <div style={{fontWeight: 'bold', marginBottom: 5}}>⚡ Simulador de Check (Force Update)</div>
                        <div style={{display: 'flex', gap: 5}}>
                            <input 
                                type="number" 
                                value={simulateDays} 
                                onChange={e => setSimulateDays(e.target.value)}
                                style={{color: '#000', padding: 4, width: 80, borderRadius: 2}}
                            />
                            <button 
                                onClick={handleSimulateCheck}
                                disabled={savingDebug}
                                style={{background: '#10b981', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: 2, cursor: 'pointer'}}
                            >
                                {savingDebug ? 'Salvando...' : 'Salvar no Banco'}
                            </button>
                        </div>
                     </div>
                 )}

                 <button onClick={() => setDebugData(null)} style={{display: 'block', marginTop: 10, background: '#fff', color: '#000', border: 'none', padding: '2px 6px', borderRadius: 2, cursor: 'pointer'}}>Fechar Debug</button>
             </div>
         )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: '1.8rem', color: '#0f172a' }}>Gerenciar Alunos</h1>
        <button className="btn" style={{ background: '#10b981', padding: '10px 20px', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 8 }} onClick={() => navigate('/students/create')}>
            <span>+</span> Novo Aluno
        </button>
      </div>

      <div style={{ 
          marginBottom: 24, 
          display: 'flex', 
          gap: 12, 
          flexWrap: 'wrap', 
          alignItems: 'center',
          background: '#f8fafc',
          padding: 16,
          borderRadius: 12,
          border: '1px solid #f1f5f9'
      }}>
        <div style={{ flex: 1, minWidth: 250 }}>
            <input 
                placeholder="Buscar por nome ou email..." 
                value={query} 
                onChange={(e) => setQuery(e.target.value)} 
                style={{ ...inputStyle, width: '100%' }} 
            />
        </div>
        
        <select 
            value={planFilter} 
            onChange={e => setPlanFilter(e.target.value)}
            style={inputStyle}
        >
            <option value="all">Todos Planos</option>
            {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>

        <select 
            value={statusFilter} 
            onChange={e => setStatusFilter(e.target.value)}
            style={inputStyle}
        >
            <option value="all">Todos Status</option>
            <option value="ativo">Ativo</option>
            <option value="inativo">Inativo</option>
        </select>

        <select 
            value={anamnesisFilter} 
            onChange={e => setAnamnesisFilter(e.target.value)}
            style={inputStyle}
        >
            <option value="all">Todas Anamneses</option>
            <option value="ok">Em Dia</option>
            <option value="pending">Pendentes/Vencidas</option>
            <option value="overdue">Vencidas (Apenas)</option>
        </select>

        <select 
            value={financialFilter} 
            onChange={e => setFinancialFilter(e.target.value)}
            style={inputStyle}
        >
            <option value="all">Todos Financeiro</option>
            <option value="paid">Pagos</option>
            <option value="pending">Pendentes</option>
            <option value="overdue">Atrasados</option>
        </select>

        <button 
            className="btn" 
            onClick={loadData}
            style={{ 
                background: '#3b82f6', 
                padding: '10px 16px', 
                borderRadius: 8,
                fontSize: '0.9rem',
                height: 42
            }}
        >
            Atualizar
        </button>
      </div>
      
      {loading ? <div>Carregando...</div> : (
        <div className="table-responsive" style={{ overflowX: 'auto' }}>
            <div style={{ display: 'grid', gap: 6, minWidth: 750 }}>
                <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '1.4fr 1.5fr 0.5fr 0.9fr 0.9fr 0.7fr 130px', 
                    gap: 6, fontWeight: 600, padding: '8px 10px', fontSize: '0.7rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' 
                }}>
                    <div>Aluno</div>
                    <div>Protocolos</div>
                    <div style={{textAlign:'center'}}>Freq.</div>
                    <div>Anamnese</div>
                    <div>Financeiro</div>
                    <div>Acesso</div>
                    <div style={{ textAlign: 'right' }}>Ações</div>
                </div>
                
                {filtered.map((s) => {
                // Planos
                const plan = plans.find(p => p.id === s.planId)
                const finStatus = getFinancialStatus(s, plan, payments)
                
                // Treinos Ativos
                const studentWorkouts = workouts.filter(w => w.studentId === s.id && w.status === 'ativo')
                const workoutsStr = studentWorkouts.length > 0 
                    ? studentWorkouts.map(w => w.name).join(', ') 
                    : 'Sem treinos'

                // Frequência
                const freq = frequencies[s.id] || 0
                
                // Dietas
                const studentPersonalDiets = diets.filter(d => d.studentId === s.id && d.status === 'ativa')
                const linkedDiets = diets.filter(d => (s.dietIds || []).includes(d.id))
                const allStudentDiets = [...studentPersonalDiets, ...linkedDiets]
                const uniqueDiets = Array.from(new Set(allStudentDiets.map(d => d.id))).map(id => allStudentDiets.find(d => d.id === id)!)
                const dietsStr = uniqueDiets.length > 0
                    ? uniqueDiets.map(d => d.name).join(', ')
                    : 'Sem dietas'

                // Anamnese
                const anamData = getAnamnesisStatus(s.id, anamneses, responses)
                
                const isInactive = s.status === 'inativo'

                return (
                    <div key={s.id} style={{ 
                        display: 'grid', 
                        gridTemplateColumns: '1.4fr 1.5fr 0.5fr 0.9fr 0.9fr 0.7fr 130px', 
                        gap: 6, alignItems: 'center', 
                        border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 10px', 
                        opacity: isInactive ? 0.7 : 1, 
                        background: isInactive ? '#f8fafc' : '#fff',
                        transition: 'all 0.2s',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                        fontSize: '0.75rem'
                    }}>
                    
                    {/* 1. Aluno */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#f1f5f9', overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0, border: '1px solid #e2e8f0' }}>
                            {s.avatarUrl ? (
                                <img src={s.avatarUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.parentElement!.innerText = '👤' }} />
                            ) : (
                                <span style={{ fontSize: '0.9rem' }}>👤</span>
                            )}
                        </div>
                        <div style={{ minWidth: 0 }}>
                            <div 
                                style={{ fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.8rem', cursor: 'help' }} 
                                title="Clique para ver debug da Anamnese"
                                onClick={() => toggleDebug(s.id)}
                            >
                                {s.name}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={s.email}>{s.email}</div>
                            <div style={{ marginTop: 1 }}>
                                <span style={{ 
                                    fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase',
                                    padding: '0px 4px', borderRadius: 3,
                                    background: isInactive ? '#e2e8f0' : '#dcfce7',
                                    color: isInactive ? '#64748b' : '#166534'
                                }}>
                                    {s.status}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* 2. Protocolos */}
                    <div style={{ fontSize: '0.75rem', color: '#334155', display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
                            <span style={{ fontSize: '0.85rem', marginTop: -1 }}>💪</span> 
                            <span style={{ color: workoutsStr === 'Sem treinos' ? '#94a3b8' : 'inherit', lineHeight: 1.1 }}>{workoutsStr}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
                            <span style={{ fontSize: '0.85rem', marginTop: -1 }}>🥗</span>
                            <span style={{ color: dietsStr === 'Sem dietas' ? '#94a3b8' : 'inherit', lineHeight: 1.1 }}>{dietsStr}</span>
                        </div>
                    </div>

                    {/* 3. Frequência */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                         <span style={{ fontSize: '0.9rem', fontWeight: 700, color: freq > 0 ? '#10b981' : '#94a3b8' }}>{freq}x</span>
                         <span style={{ fontSize: '0.6rem', color: '#94a3b8' }}>/sem</span>
                    </div>

                    {/* 4. Anamnese */}
                    <div>
                         <span style={{ 
                            color: anamData.color, fontWeight: 600, fontSize: '0.75rem',
                            display: 'inline-flex', alignItems: 'center', gap: 4, lineHeight: 1.1
                         }}>
                            {anamData.label}
                         </span>
                    </div>

                    {/* 5. Financeiro */}
                    <div style={{ fontSize: '0.75rem' }}>
                        <div style={{ fontWeight: 600, color: '#1e293b' }}>{plan ? plan.name : <span style={{color:'#94a3b8'}}>Sem plano</span>}</div>
                        <div style={{ marginTop: 2, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1 }}>
                            <span style={{ 
                                background: finStatus.bg, color: finStatus.color, 
                                padding: '0px 4px', borderRadius: 3, fontSize: '0.65rem', fontWeight: 700 
                            }}>
                                {finStatus.label}
                            </span>
                            {finStatus.daysDiff !== null && (finStatus.status === 'paid' || finStatus.status === 'warning') && (
                                <span style={{ fontSize: '0.6rem', color: '#64748b' }}>Vence em {finStatus.daysDiff} dias</span>
                            )}
                            {finStatus.daysDiff !== null && finStatus.status === 'overdue' && (
                                <span style={{ fontSize: '0.6rem', color: '#ef4444' }}>Vencido há {finStatus.daysDiff} dias</span>
                            )}
                        </div>
                    </div>

                    {/* 6. Acesso */}
                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                        {s.lastAccess ? (
                            <div>
                                <div>{new Date(s.lastAccess).toLocaleDateString('pt-BR')}</div>
                                <div style={{ fontSize: '0.6rem', opacity: 0.8 }}>{new Date(s.lastAccess).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</div>
                            </div>
                        ) : 'Nunca'}
                    </div>

                    {/* 7. Ações */}
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                        <button 
                            className="btn" 
                            title="Ver Feedbacks"
                            style={{ padding: '5px', fontSize: '0.9em', background: '#f59e0b', color: '#fff', borderRadius: 6, border: 'none', cursor: 'pointer' }}
                            onClick={() => setSelectedStudentForFeedback(s)}
                        >
                            <MessageSquare size={13} />
                        </button>
                        <button 
                            className="btn" 
                            title="Ver Anamneses"
                            style={{ padding: '5px', fontSize: '0.9em', background: '#3b82f6', color: '#fff', borderRadius: 6, border: 'none', cursor: 'pointer' }}
                            onClick={() => setSelectedStudentForAnamnesis(s)}
                        >
                            <ClipboardList size={13} />
                        </button>
                        <button 
                            title="Editar / Gerenciar"
                            onClick={() => navigate(`/students/edit?id=${s.id}`)}
                            style={{ 
                                padding: '5px 8px', borderRadius: 6, 
                                background: 'var(--personal-accent)', color: '#fff', border: 'none',
                                fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer',
                                display: 'flex', alignItems: 'center'
                            }}
                        >
                            Gerenciar
                        </button>
                    </div>
                    </div>
                )
                })}
                {filtered.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: '#64748b' }}>Nenhum aluno encontrado.</div>}
            </div>
      </div>
      )}

      {selectedStudentForFeedback && (
          <StudentFeedbackModal 
            studentId={selectedStudentForFeedback.id}
            studentName={selectedStudentForFeedback.name}
            onClose={() => setSelectedStudentForFeedback(null)}
          />
      )}

      {selectedStudentForAnamnesis && (
          <StudentAnamnesisModal 
            studentId={selectedStudentForAnamnesis.id}
            studentName={selectedStudentForAnamnesis.name}
            onClose={() => setSelectedStudentForAnamnesis(null)}
          />
      )}
    </div>
  )
}