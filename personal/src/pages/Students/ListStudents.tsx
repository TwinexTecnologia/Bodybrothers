import { useEffect, useState } from 'react'
import { listStudentsByPersonal, toggleStudentActive, getStudentsWeeklyFrequency, type StudentRecord } from '../../store/students'
import { listPlans, type PlanRecord } from '../../store/plans'
import { listActiveWorkouts, type WorkoutRecord } from '../../store/workouts'
import { listAllAnamnesis, listResponsesByPersonal, type AnamnesisModel, type AnamnesisResponse } from '../../store/anamnesis'
import { listAllDietsByPersonal, type DietRecord } from '../../store/diets'
import { listMonthPayments, type DebitRecord } from '../../store/financial'
import { supabase } from '../../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { MessageSquare, BarChart2, ClipboardList } from 'lucide-react'
import StudentFeedbackModal from '../../components/StudentFeedbackModal'
import StudentAnamnesisModal from '../../components/StudentAnamnesisModal'

// Helper de Status Financeiro
const getFinancialStatus = (student: StudentRecord, plan: PlanRecord | undefined, payments: DebitRecord[]) => {
    if (!plan || !student.planStartDate) return { status: 'none', label: '—', color: '#9ca3af', bg: 'transparent', daysDiff: null }
    
    const dueDay = student.dueDay || 10
    const now = new Date()
    const dueThisMonth = new Date(now.getFullYear(), now.getMonth(), dueDay)
    dueThisMonth.setHours(23,59,59)
    
    // Formata data YYYY-MM-DD localmente (gambiarra segura para fuso)
    const offset = dueThisMonth.getTimezoneOffset()
    const localDate = new Date(dueThisMonth.getTime() - (offset*60*1000))
    const dueStr = localDate.toISOString().split('T')[0]
    
    // Procura pagamento com due_date igual (mesmo que tenha sido pago em outro dia)
    const hasPayment = payments.some(p => p.payerId === student.id && p.dueDate === dueStr)
    
    const timeDiff = dueThisMonth.getTime() - now.getTime()
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24))
    
    if (hasPayment) return { status: 'paid', label: 'PAGO', color: '#166534', bg: '#dcfce7', daysDiff: null }
    
    if (now > dueThisMonth) {
        // Atrasado
        // daysDiff será negativo (ex: -5). Invertemos para positivo para mostrar "5 dias"
        return { status: 'overdue', label: 'ATRASADO', color: '#991b1b', bg: '#fee2e2', daysDiff: Math.abs(daysDiff) }
    }
    
    // Pendente (Vence em X dias)
    return { status: 'pending', label: 'PENDENTE', color: '#b45309', bg: '#fef3c7', daysDiff: daysDiff }
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
            listMonthPayments(user.id, new Date())
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
    if (financialFilter === 'all') return true
    
    const plan = plans.find(p => p.id === s.planId)
    const finStatus = getFinancialStatus(s, plan, payments).status
    return finStatus === financialFilter
  })

  return (
    <div>
      <h1>Alunos • Gerenciar Alunos</h1>
      <div style={{ marginBottom: 10, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <input placeholder="Buscar por nome ou email" value={query} onChange={(e) => setQuery(e.target.value)} style={{ padding: '8px', borderRadius: 6, border: '1px solid #ccc', minWidth: 250 }} />
        
        <select 
            value={financialFilter} 
            onChange={e => setFinancialFilter(e.target.value)}
            style={{ padding: '8px', borderRadius: 6, border: '1px solid #ccc', minWidth: 150 }}
        >
            <option value="all">Todos Status Financ.</option>
            <option value="paid">Pagos</option>
            <option value="pending">Pendentes</option>
            <option value="overdue">Atrasados</option>
        </select>

        <button className="btn" onClick={loadData}>Atualizar</button>
        <button className="btn" style={{ background: '#10b981', marginLeft: 'auto' }} onClick={() => navigate('/students/create')}>+ Novo Aluno</button>
      </div>
      
      {loading ? <div>Carregando...</div> : (
        <div className="table-responsive">
            <div style={{ display: 'grid', gap: 8, minWidth: 1200 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 0.7fr 0.7fr 0.7fr 0.8fr 0.8fr 0.8fr 0.6fr 1.4fr', gap: 8, fontWeight: 600, padding: '6px 10px', fontSize: '0.85em', color: '#6b7280' }}>
                <div>ALUNO</div>
                <div>TREINOS</div>
                <div>FREQ.</div>
                <div>DIETAS</div>
                <div>ANAMNESE</div>
                <div>PLANO</div>
                <div>FINANCEIRO</div>
                <div>ÚLT. LOGIN</div>
                <div>STATUS</div>
                <div style={{ textAlign: 'right' }}>AÇÕES</div>
                </div>
                {filtered.map((s) => {
                // Planos
                const plan = plans.find(p => p.id === s.planId)
            const finStatus = getFinancialStatus(s, plan, payments)
            
            const planStr = plan ? (
                <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9em' }}>{plan.name}</div>
                    <div style={{ fontSize: '0.8em', color: '#166534' }}>R$ {plan.price.toFixed(2)}</div>
                </div>
            ) : <span style={{ color: '#9ca3af' }}>—</span>

            // Treinos Ativos do Aluno
            const studentWorkouts = workouts.filter(w => w.studentId === s.id && w.status === 'ativo')
            const workoutsStr = studentWorkouts.length > 0 
                ? studentWorkouts.map(w => w.name).join(', ') 
                : <span style={{ color: '#9ca3af', fontSize: '0.9em' }}>Sem treinos</span>

            // Frequência
            const freq = frequencies[s.id] || 0
            
            // Dietas Ativas do Aluno
            const studentPersonalDiets = diets.filter(d => d.studentId === s.id && d.status === 'ativa')
            const linkedDiets = diets.filter(d => (s.dietIds || []).includes(d.id))
            const allStudentDiets = [...studentPersonalDiets, ...linkedDiets]
            // Remove duplicatas
            const uniqueDiets = Array.from(new Set(allStudentDiets.map(d => d.id))).map(id => allStudentDiets.find(d => d.id === id)!)
            
            const dietsStr = uniqueDiets.length > 0
                ? uniqueDiets.map(d => d.name).join(', ')
                : <span style={{ color: '#9ca3af', fontSize: '0.9em' }}>Sem dietas</span>

            // Anamnese
            const studentAnamneses = anamneses.filter(a => a.studentId === s.id)
            let anamnesisStatus = <span style={{ color: '#9ca3af', fontSize: '0.9em' }}>Pendente</span>
            
            if (studentAnamneses.length > 0) {
                try {
                    // Pega a com menor validade (mais urgente)
                    const sorted = studentAnamneses.sort((a, b) => {
                        const da = a.validUntil ? new Date(a.validUntil).getTime() : Infinity
                        const db = b.validUntil ? new Date(b.validUntil).getTime() : Infinity
                        return da - db
                    })
                    const nearest = sorted[0]
                    
                    if (nearest.validUntil) {
                        // Verifica se já respondeu (pega a mais recente)
                        const modelResponses = responses.filter(r => r.modelId === nearest.id).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                        const lastResponse = modelResponses[0]

                        const validDate = new Date(nearest.validUntil)
                        // Verifica se data é válida
                        if (!isNaN(validDate.getTime())) {
                            let daysLeft = Math.ceil((validDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
                            
                            // Lógica de Recorrência Visual (Projeção Mensal)
                            // Se já respondeu, calculamos o próximo vencimento (próximo mês no mesmo dia)
                            if (lastResponse) {
                                let nextDueDate = new Date(nearest.validUntil!)
                                const now = new Date()
                                
                                // Se a data original já passou, projeta para o próximo mês
                                while (nextDueDate < now) {
                                    nextDueDate.setMonth(nextDueDate.getMonth() + 1)
                                }
                                
                                daysLeft = Math.ceil((nextDueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                                
                                // Se respondeu, mostra sempre verde com a contagem para o próximo
                                anamnesisStatus = <span style={{ color: '#10b981', fontWeight: 600, fontSize: '0.9em' }}>✅ {daysLeft} dias</span>
                            } else if (daysLeft < 0) {
                                anamnesisStatus = <span style={{ color: '#ef4444', fontWeight: 600, fontSize: '0.9em' }}>🔴 Vencida</span>
                            } else if (daysLeft <= 7) {
                                anamnesisStatus = <span style={{ color: '#f59e0b', fontWeight: 600, fontSize: '0.9em' }}>🟡 Vence em {daysLeft} dias</span>
                            } else {
                                anamnesisStatus = <span style={{ color: '#10b981', fontWeight: 600, fontSize: '0.9em' }}>✅ {daysLeft} dias</span>
                            }
                        } else {
                            anamnesisStatus = <span style={{ color: '#f59e0b', fontSize: '0.9em' }}>Data Inválida</span>
                        }
                    } else {
                        anamnesisStatus = <span style={{ color: '#6b7280', fontSize: '0.9em' }}>Sem validade</span>
                    }
                } catch (err) {
                    console.error('Erro ao calcular data anamnese:', err)
                    anamnesisStatus = <span style={{ color: '#ef4444', fontSize: '0.9em' }}>Erro Data</span>
                }
            }

            const isInactive = s.status === 'inativo'
            return (
                <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 0.7fr 0.7fr 0.7fr 0.8fr 0.8fr 0.8fr 0.6fr 1.4fr', gap: 8, alignItems: 'center', border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, opacity: isInactive ? 0.6 : 1, background: isInactive ? '#f9fafb' : '#fff' }}>
                
                {/* Aluno */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#e5e7eb', overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
                        {s.avatarUrl ? (
                            <img src={s.avatarUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.parentElement!.innerText = '👤' }} />
                        ) : (
                            <span style={{ fontSize: '1.2rem' }}>👤</span>
                        )}
                    </div>
                    <div>
                        <div style={{ fontWeight: 600 }}>{s.name}</div>
                        <div style={{ fontSize: '0.85em', color: '#6b7280' }}>{s.email}</div>
                    </div>
                </div>

                {/* Treinos */}
                <div style={{ fontSize: '0.9em', lineHeight: 1.4 }}>
                    {workoutsStr}
                </div>

                {/* Frequência */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <BarChart2 size={16} color={freq > 0 ? '#10b981' : '#cbd5e1'} />
                    <span style={{ fontWeight: 700, color: freq > 0 ? '#10b981' : '#94a3b8' }}>{freq}x</span>
                </div>

                {/* Dietas */}
                <div style={{ fontSize: '0.9em', lineHeight: 1.4 }}>
                    {dietsStr}
                </div>

                {/* Anamnese */}
                <div>
                    {anamnesisStatus}
                </div>

                {/* Plano */}
                <div>
                    {planStr}
                </div>

                {/* Financeiro */}
                <div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                        <span style={{ 
                            background: finStatus.bg, 
                            color: finStatus.color, 
                            padding: '2px 8px', borderRadius: 4, fontSize: '0.85em', fontWeight: 600 
                        }}>
                            {finStatus.label}
                        </span>
                        {finStatus.status === 'pending' && finStatus.daysDiff !== null && (
                            <span style={{ fontSize: '0.75em', color: '#b45309', marginTop: 2, fontWeight: 500 }}>
                                Vence em {finStatus.daysDiff} dias
                            </span>
                        )}
                        {finStatus.status === 'overdue' && finStatus.daysDiff !== null && (
                            <span style={{ fontSize: '0.75em', color: '#991b1b', marginTop: 2, fontWeight: 500 }}>
                                Vencido há {finStatus.daysDiff} dias
                            </span>
                        )}
                        {s.dueDay && (
                            <div style={{ fontSize: '0.75em', color: '#94a3b8', marginTop: 2 }}>
                                Dia {s.dueDay}
                            </div>
                        )}
                    </div>
                </div>

                {/* Último Login */}
                <div style={{ fontSize: '0.85em', color: '#64748b' }}>
                    {s.lastAccess ? new Date(s.lastAccess).toLocaleDateString('pt-BR') : 'Nunca'}
                </div>

                {/* Status */}
                <div>
                    <span style={{ 
                        background: isInactive ? '#f3f4f6' : '#dcfce7', 
                        color: isInactive ? '#6b7280' : '#166534', 
                        padding: '2px 8px', borderRadius: 4, fontSize: '0.85em', fontWeight: 600 
                    }}>
                        {s.status.toUpperCase()}
                    </span>
                </div>

                {/* Ações */}
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <button 
                        className="btn" 
                        title="Ver Feedbacks"
                        style={{ padding: '6px 8px', fontSize: '0.9em', background: '#f59e0b' }}
                        onClick={() => setSelectedStudentForFeedback(s)}
                    >
                        <MessageSquare size={16} />
                    </button>
                    <button 
                        className="btn" 
                        title="Ver Anamneses"
                        style={{ padding: '6px 8px', fontSize: '0.9em', background: '#3b82f6' }}
                        onClick={() => setSelectedStudentForAnamnesis(s)}
                    >
                        <ClipboardList size={16} />
                    </button>
                    <button 
                        className="btn" 
                        style={{ padding: '6px 12px', fontSize: '0.9em', background: 'var(--personal-accent)' }}
                        onClick={() => navigate(`/students/edit?id=${s.id}`)}
                    >
                        Gerenciar
                    </button>
                    <button 
                        className="btn" 
                        style={{ padding: '6px 12px', fontSize: '0.9em', background: isInactive ? '#10b981' : '#ef4444' }}
                        onClick={() => handleToggle(s)}
                    >
                        {isInactive ? 'Reativar' : 'Inativar'}
                    </button>
                </div>
                </div>
            )
            })}
            {filtered.length === 0 && <div>Nenhum aluno encontrado.</div>}
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