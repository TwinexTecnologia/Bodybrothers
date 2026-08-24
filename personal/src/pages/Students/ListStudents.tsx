import { useEffect, useMemo, useState } from 'react'
import { toggleStudentActive, getStudentsWeeklyFrequency, type StudentRecord } from '../../store/students'
import { listPlans, type PlanRecord } from '../../store/plans'
import { supabase } from '../../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { MessageSquare, ClipboardList } from 'lucide-react'
import StudentFeedbackModal from '../../components/StudentFeedbackModal'
import StudentAnamnesisModal from '../../components/StudentAnamnesisModal'
import { getCurrentBillingDueDate, normalizeDate } from '../../lib/planBilling'

type StudentListViewRow = {
  id: string
  personal_id: string
  full_name: string | null
  email: string | null
  created_at: string
  status: 'ativo' | 'inativo'
  last_access: string | null
  address: StudentRecord['address'] | null
  plan_id: string | null
  plan_start_date: string | null
  diet_ids: string[] | null
  avatar_url: string | null
}

type WorkoutListRow = {
  id: string
  student_id: string | null
  title: string | null
}

type DietListRow = {
  id: string
  student_id: string | null
  title: string | null
}

type AnamnesisModelRow = {
  student_id: string | null
  ends_at: string | null
}

type LatestAnamnesisResponseRow = {
  student_id: string | null
  created_at: string
  reviewed_at: string | null
  renew_in_days: number | null
}

type PaymentSummaryRow = {
  payer_id: string
  due_date: string
  paid_at: string | null
}

type FinancialStatus = {
  status: 'none' | 'paid' | 'pending' | 'warning' | 'overdue'
  label: string
  color: string
  bg: string
  daysDiff: number | null
}

type AnamnesisStatus = {
  status: 'pending' | 'ok' | 'warning' | 'overdue' | 'none' | 'error'
  label: string
  color: string
  fontWeight: number
}

function getPaymentsStartDate() {
  const date = new Date()
  date.setMonth(date.getMonth() - 12)
  return date.toISOString().split('T')[0]
}

// Helper de Status Financeiro (Baseado em Validade Real)
const getFinancialStatus = (
  student: StudentRecord,
  plan: PlanRecord | undefined,
  lastPayment?: PaymentSummaryRow
): FinancialStatus => {
    if (!plan || !student.planStartDate) return { status: 'none', label: '—', color: '#9ca3af', bg: 'transparent', daysDiff: null }
    
    // Verifica Gratuidade/Permuta
    const isFree = plan.price <= 0 || plan.name.toLowerCase().includes('permuta') || plan.name.toLowerCase().includes('gratuito')
    if (isFree) {
        return { status: 'paid', label: 'ISENTO', color: '#10b981', bg: '#dcfce7', daysDiff: null }
    }

    const today = normalizeDate(new Date())
    const dueDate = getCurrentBillingDueDate(
      student.planStartDate,
      plan,
      lastPayment ? (lastPayment.paid_at || lastPayment.due_date) : null
    )

    if (!dueDate) return { status: 'none', label: '—', color: '#9ca3af', bg: 'transparent', daysDiff: null }

    const diffMs = dueDate.getTime() - today.getTime()
    const daysRemaining = Math.round(diffMs / (1000 * 60 * 60 * 24))

    if (daysRemaining < -3) {
        return { status: 'overdue', label: 'ATRASADO', color: '#ef4444', bg: '#fee2e2', daysDiff: Math.abs(daysRemaining) }
    }

    if (daysRemaining < 0) {
        return { status: 'pending', label: 'VENCEU', color: '#f59e0b', bg: '#fef3c7', daysDiff: Math.abs(daysRemaining) }
    }

    if (!lastPayment) {
        if (daysRemaining === 0) return { status: 'pending', label: 'NOVO', color: '#f59e0b', bg: '#fef3c7', daysDiff: 0 }
        if (daysRemaining <= 5) return { status: 'warning', label: 'INICIO LOGO', color: '#f59e0b', bg: '#fffbeb', daysDiff: daysRemaining }
        return { status: 'paid', label: 'PROGRAMADO', color: '#166534', bg: '#dcfce7', daysDiff: daysRemaining }
    }

    if (daysRemaining === 0) {
        return { status: 'warning', label: 'VENCE HOJE', color: '#f59e0b', bg: '#fffbeb', daysDiff: 0 }
    }

    if (daysRemaining <= 5) {
        return { status: 'warning', label: 'VENCE LOGO', color: '#f59e0b', bg: '#fffbeb', daysDiff: daysRemaining }
    }

    return { status: 'paid', label: 'EM DIA', color: '#166534', bg: '#dcfce7', daysDiff: daysRemaining }
}

const getAnamnesisStatus = (
  nearestValidUntil: string | null | undefined,
  latestResponse?: LatestAnamnesisResponseRow
): AnamnesisStatus => {
    if (!nearestValidUntil) return { status: 'pending', label: 'Pendente', color: '#9ca3af', fontWeight: 400 }

    try {
        // LÓGICA HÍBRIDA: Manual (Check) vs Automática (Mensal)
        if (latestResponse) {
                // CASO 1: Personal revisou e definiu dias manualmente (renew_in_days existe)
                if (latestResponse.renew_in_days && latestResponse.reviewed_at) {
                    const reviewDate = new Date(latestResponse.reviewed_at)
                    // Normaliza para dia UTC ou Local? Vamos usar Local para garantir consistência visual
                    const reviewLocal = new Date(reviewDate.getFullYear(), reviewDate.getMonth(), reviewDate.getDate())
                    
                    const daysToAdd = latestResponse.renew_in_days
                    
                    const dueDate = new Date(reviewLocal)
                    dueDate.setDate(dueDate.getDate() + daysToAdd)
                    // dueDate agora é 00:00 do dia do vencimento
                    
                    const now = new Date()
                    const nowLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate()) // 00:00 de hoje
                    
                    // Diferença em milissegundos
                    const diffTime = dueDate.getTime() - nowLocal.getTime()
                    // Diferença em dias inteiros
                    const daysLeft = Math.round(diffTime / (1000 * 60 * 60 * 24))
                    
                    if (daysLeft < 0) return { status: 'overdue', label: `🔴 Vencida (${Math.abs(daysLeft)}d)`, color: '#ef4444', fontWeight: 600 }
                    if (daysLeft === 0) return { status: 'warning', label: `🟡 Vence Hoje`, color: '#f59e0b', fontWeight: 600 }
                    return { status: 'ok', label: `✅ ${daysLeft} dias`, color: '#10b981', fontWeight: 600 }
                }

                // CASO 2: Lógica Automática (Projeção Mensal baseada na data original DO MODELO ATIVO)
                if (nearestValidUntil) {
                    const validDate = new Date(nearestValidUntil)
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
        if (nearestValidUntil) {
            const validDate = new Date(nearestValidUntil)
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
  const [workouts, setWorkouts] = useState<WorkoutListRow[]>([])
  const [diets, setDiets] = useState<DietListRow[]>([])
  const [anamneses, setAnamneses] = useState<AnamnesisModelRow[]>([])
  const [responses, setResponses] = useState<LatestAnamnesisResponseRow[]>([])
  const [payments, setPayments] = useState<PaymentSummaryRow[]>([])
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
        const { data: studentsData, error: studentsError } = await supabase
          .from('personal_students_list_view')
          .select('id, personal_id, full_name, email, created_at, status, last_access, address, plan_id, plan_start_date, diet_ids, avatar_url')
          .eq('personal_id', user.id)
          .order('full_name')

        if (studentsError) throw studentsError

        const s = ((studentsData || []) as StudentListViewRow[]).map((row) => ({
          id: row.id,
          personalId: row.personal_id,
          name: row.full_name || '',
          email: row.email || '',
          status: row.status === 'inativo' ? 'inativo' : 'ativo',
          createdAt: row.created_at,
          lastAccess: row.last_access || undefined,
          address: row.address || undefined,
          planId: row.plan_id || undefined,
          planStartDate: row.plan_start_date || undefined,
          dietIds: row.diet_ids || undefined,
          avatarUrl: row.avatar_url || undefined,
        }))
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
            supabase
              .from('protocols')
              .select('id, student_id, title')
              .eq('personal_id', user.id)
              .eq('type', 'workout')
              .eq('status', 'active')
              .not('student_id', 'is', null),
            supabase
              .from('protocols')
              .select('student_id, ends_at')
              .eq('personal_id', user.id)
              .eq('type', 'anamnesis_model')
              .not('student_id', 'is', null),
            supabase
              .from('personal_latest_anamnesis_response_summary')
              .select('student_id, created_at, reviewed_at, renew_in_days')
              .eq('personal_id', user.id),
            supabase
              .from('protocols')
              .select('id, student_id, title')
              .eq('personal_id', user.id)
              .eq('type', 'diet')
              .eq('status', 'active')
              .not('student_id', 'is', null),
            supabase
              .from('debits')
              .select('payer_id, due_date, paid_at')
              .eq('receiver_id', user.id)
              .eq('status', 'paid')
              .gte('paid_at', getPaymentsStartDate())
              .order('paid_at', { ascending: false })
        ]).then(([p, workoutsRes, anamnesesRes, responsesRes, dietsRes, paymentsRes]) => {
            console.log('Detalhes carregados em background')
            setPlans(p)
            setWorkouts(((workoutsRes.data || []) as WorkoutListRow[]))
            setAnamneses(((anamnesesRes.data || []) as AnamnesisModelRow[]))
            setResponses(((responsesRes.data || []) as LatestAnamnesisResponseRow[]))
            setDiets(((dietsRes.data || []) as DietListRow[]))
            setPayments(((paymentsRes.data || []) as PaymentSummaryRow[]))
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

  const plansById = useMemo(() => {
    return new Map(plans.map(plan => [plan.id, plan]))
  }, [plans])

  const latestPaymentByStudentId = useMemo(() => {
    const map = new Map<string, PaymentSummaryRow>()
    for (const payment of payments) {
      if (!map.has(payment.payer_id)) {
        map.set(payment.payer_id, payment)
      }
    }
    return map
  }, [payments])

  const workoutsTextByStudentId = useMemo(() => {
    const map = new Map<string, string[]>()
    workouts.forEach((workout) => {
      if (!workout.student_id) return
      const current = map.get(workout.student_id) || []
      if (workout.title) current.push(workout.title)
      map.set(workout.student_id, current)
    })
    return map
  }, [workouts])

  const personalDietNamesByStudentId = useMemo(() => {
    const map = new Map<string, string[]>()
    diets.forEach((diet) => {
      if (!diet.student_id) return
      const current = map.get(diet.student_id) || []
      if (diet.title) current.push(diet.title)
      map.set(diet.student_id, current)
    })
    return map
  }, [diets])

  const dietNameById = useMemo(() => {
    return new Map(diets.map(diet => [diet.id, diet.title || '']))
  }, [diets])

  const nearestAnamnesisValidUntilByStudentId = useMemo(() => {
    const map = new Map<string, string>()
    anamneses.forEach((anamnesis) => {
      if (!anamnesis.student_id || !anamnesis.ends_at) return
      const current = map.get(anamnesis.student_id)
      if (!current || new Date(anamnesis.ends_at).getTime() < new Date(current).getTime()) {
        map.set(anamnesis.student_id, anamnesis.ends_at)
      }
    })
    return map
  }, [anamneses])

  const latestAnamnesisResponseByStudentId = useMemo(() => {
    const map = new Map<string, LatestAnamnesisResponseRow>()
    responses.forEach((response) => {
      if (response.student_id) {
        map.set(response.student_id, response)
      }
    })
    return map
  }, [responses])

  const financialStatusByStudentId = useMemo(() => {
    const map = new Map<string, FinancialStatus>()
    students.forEach((student) => {
      map.set(
        student.id,
        getFinancialStatus(student, plansById.get(student.planId || ''), latestPaymentByStudentId.get(student.id))
      )
    })
    return map
  }, [students, plansById, latestPaymentByStudentId])

  const anamnesisStatusByStudentId = useMemo(() => {
    const map = new Map<string, AnamnesisStatus>()
    students.forEach((student) => {
      map.set(
        student.id,
        getAnamnesisStatus(
          nearestAnamnesisValidUntilByStudentId.get(student.id),
          latestAnamnesisResponseByStudentId.get(student.id)
        )
      )
    })
    return map
  }, [students, nearestAnamnesisValidUntilByStudentId, latestAnamnesisResponseByStudentId])

  const dietsTextByStudentId = useMemo(() => {
    const map = new Map<string, string>()
    students.forEach((student) => {
      const directDiets = personalDietNamesByStudentId.get(student.id) || []
      const linkedDiets = (student.dietIds || [])
        .map(id => dietNameById.get(id))
        .filter((name): name is string => !!name)

      const uniqueNames = Array.from(new Set([...directDiets, ...linkedDiets]))
      map.set(student.id, uniqueNames.length > 0 ? uniqueNames.join(', ') : 'Sem dietas')
    })
    return map
  }, [students, personalDietNamesByStudentId, dietNameById])

  const handleToggle = async (s: StudentRecord) => {
      const ok = await toggleStudentActive(s.id, s.status === 'ativo' ? 'inativo' : 'ativo')
      if (ok.success) {
          setStudents(prev => prev.map(x => x.id === s.id ? { ...x, status: x.status === 'ativo' ? 'inativo' : 'ativo' } : x))
      }
  }

  const filtered = useMemo(() => students.filter(s => {
    const q = query.toLowerCase()
    const addr = s.address ? `${s.address.street} ${s.address.number || ''} ${s.address.neighborhood || ''} ${s.address.city || ''} ${s.address.state || ''} ${s.address.cep || ''} ${s.address.complement || ''}`.toLowerCase() : ''
    const matchesQuery = s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q) || addr.includes(q)
    
    if (!matchesQuery) return false

    // Status Aluno
    if (statusFilter !== 'all' && s.status !== statusFilter) return false
    
    // Plano
    if (planFilter !== 'all' && s.planId !== planFilter) return false
    
    // Financeiro
    const finStatus = financialStatusByStudentId.get(s.id)?.status || 'none'
    if (financialFilter !== 'all' && finStatus !== financialFilter) return false

    // Anamnese
    if (anamnesisFilter !== 'all') {
        const anamStatus = anamnesisStatusByStudentId.get(s.id)?.status || 'pending'
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
  }).sort((a, b) => a.name.localeCompare(b.name)), [
    students,
    query,
    statusFilter,
    planFilter,
    financialFilter,
    anamnesisFilter,
    financialStatusByStudentId,
    anamnesisStatusByStudentId,
  ])

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

  // Debug State removido para produção
  
  return (
    <div>
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
                const plan = plansById.get(s.planId || '')
                const finStatus = financialStatusByStudentId.get(s.id) || getFinancialStatus(s, plan)
                
                // Treinos Ativos
                const workoutNames = workoutsTextByStudentId.get(s.id) || []
                const workoutsStr = workoutNames.length > 0
                    ? workoutNames.join(', ')
                    : 'Sem treinos'

                // Frequência
                const freq = frequencies[s.id] || 0
                
                // Dietas
                const dietsStr = dietsTextByStudentId.get(s.id) || 'Sem dietas'

                // Anamnese
                const anamData = anamnesisStatusByStudentId.get(s.id) || getAnamnesisStatus(null)
                
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
                            <div style={{ fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.8rem' }} title={s.name}>{s.name}</div>
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
