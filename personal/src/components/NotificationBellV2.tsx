import { useState, useRef, useEffect } from 'react'
import { Bell, AlertCircle, Clock, DollarSign, FileText, Dumbbell, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { supabase } from '../lib/supabase'

type PersonalNotification = {
    id: string
    type: 'financial_overdue' | 'financial_due_soon' | 'financial_paid' | 'anamnesis_overdue' | 'anamnesis_answered' | 'workout_finished'
    title: string
    description: string
    date: Date
    studentId?: string
    link?: string
}

export default function NotificationBellV2() {
    const { user } = useAuth()
    const [notifications, setNotifications] = useState<PersonalNotification[]>([])
    const [loading, setLoading] = useState(false)
    const [showDropdown, setShowDropdown] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)
    const navigate = useNavigate()

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowDropdown(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    useEffect(() => {
        if (!user) return

        console.log('--- DEBUG USER ID ---')
        console.log('Personal Logado:', user.id)

        const fetchNotifications = async () => {
            setLoading(true)
            try {
                const list: PersonalNotification[] = []
                
                const todayStr = new Date().toISOString().split('T')[0]
                const recentLimit = new Date()
                recentLimit.setDate(recentLimit.getDate() - 3)
                const recentLimitStr = recentLimit.toISOString()

                // 1. Financeiro (Pagos Recentes)
                const { data: paidDebits } = await supabase
                    .from('debits')
                    .select('id, amount, paid_at, payer_id, profiles(full_name)')
                    .eq('receiver_id', user.id)
                    .eq('status', 'paid')
                    .gte('paid_at', recentLimitStr)

                paidDebits?.forEach((d: any) => {
                    list.push({
                        id: `paid-${d.id}`,
                        type: 'financial_paid',
                        title: 'Pagamento Recebido',
                        description: `${d.profiles?.full_name || 'Aluno'} pagou R$ ${Number(d.amount).toFixed(2)}`,
                        date: new Date(d.paid_at),
                        studentId: d.payer_id,
                        // Sem link conforme solicitado
                    })
                })

                // 2. Financeiro (Vencidos e Próximos)
                const { data: pendingDebits } = await supabase
                    .from('debits')
                    .select('id, amount, due_date, payer_id, profiles(full_name)')
                    .eq('receiver_id', user.id)
                    .eq('status', 'pending')
                
                pendingDebits?.forEach((d: any) => {
                    const dueParts = d.due_date.split('-').map(Number)
                    const localDue = new Date(dueParts[0], dueParts[1]-1, dueParts[2])
                    const diffTime = localDue.getTime() - new Date().setHours(0,0,0,0)
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

                    if (diffDays < 0) {
                        list.push({
                            id: `overdue-${d.id}`,
                            type: 'financial_overdue',
                            title: 'Pagamento Atrasado',
                            description: `${d.profiles?.full_name || 'Aluno'} - Venceu há ${Math.abs(diffDays)} dias`,
                            date: localDue,
                            studentId: d.payer_id,
                            link: '/financial'
                        })
                    } else if (diffDays <= 3) { // Reduzi para 3 dias
                        list.push({
                            id: `due-${d.id}`,
                            type: 'financial_due_soon',
                            title: 'Vencimento Próximo',
                            description: `${d.profiles?.full_name || 'Aluno'} - Vence em ${diffDays === 0 ? 'hoje' : diffDays + ' dias'}`,
                            date: localDue,
                            studentId: d.payer_id,
                            link: '/financial'
                        })
                    }
                })

                // 3. Anamnese (Vencidas)
                const { data: expiredAnamnesis } = await supabase
                    .from('protocols')
                    .select('id, title, ends_at, student_id')
                    .eq('personal_id', user.id)
                    .eq('type', 'anamnesis_model')
                    .lt('ends_at', todayStr)
                
                if (expiredAnamnesis && expiredAnamnesis.length > 0) {
                    const studentIds = [...new Set(expiredAnamnesis.map(a => a.student_id).filter(Boolean))]
                    let students: any[] = []
                    if (studentIds.length > 0) {
                        const { data } = await supabase.from('profiles').select('id, full_name').in('id', studentIds)
                        students = data || []
                    }
                    
                    expiredAnamnesis.forEach(a => {
                        const stName = students?.find(s => s.id === a.student_id)?.full_name || 'Aluno'
                        list.push({
                            id: `anam-exp-${a.id}`,
                            type: 'anamnesis_overdue',
                            title: 'Anamnese Vencida',
                            description: `${stName} não respondeu "${a.title}"`,
                            date: new Date(a.ends_at),
                            studentId: a.student_id,
                            link: '/protocols/anamnesis-pending'
                        })
                    })
                }

                // 4. Anamnese (Respondidas Recentes)
                const { data: answers } = await supabase
                    .from('protocols')
                    .select('id, title, created_at, student_id')
                    .eq('personal_id', user.id)
                    .eq('type', 'anamnesis')
                    .gte('created_at', recentLimitStr)
                
                if (answers && answers.length > 0) {
                    const studentIds = [...new Set(answers.map(a => a.student_id))]
                    let students: any[] = []
                    if (studentIds.length > 0) {
                        const { data } = await supabase.from('profiles').select('id, full_name').in('id', studentIds)
                        students = data || []
                    }

                    answers.forEach(a => {
                        const stName = students?.find(s => s.id === a.student_id)?.full_name || 'Aluno'
                        list.push({
                            id: `anam-ans-${a.id}`,
                            type: 'anamnesis_answered',
                            title: 'Anamnese Respondida',
                            description: `${stName} respondeu "${a.title}"`,
                            date: new Date(a.created_at),
                            studentId: a.student_id,
                            link: `/protocols/anamnesis/view/${a.id}` 
                        })
                    })
                }

                // 5. Notificações do Banco (Feedback de Treino, Avisos Gerais)
                const { data: dbNotifications, error: dbError } = await supabase
                    .from('notifications')
                    .select('*')
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false })
                    .limit(20)

                if (dbError) console.error('Erro lendo notifications:', dbError)
                console.log('Notificações DB encontradas:', dbNotifications)

                if (dbNotifications) {
                    dbNotifications.forEach(n => {
                        list.push({
                            id: `db-${n.id}`,
                            type: n.type === 'feedback' ? 'workout_finished' : 'info',
                            title: n.title,
                            description: n.message,
                            date: new Date(n.created_at),
                            link: n.link
                        })
                    })
                }

                // 6. Feedbacks de Treino (Direto do Histórico - Backup se notifications falhar)
                // Busca alunos do personal
                const { data: myStudents } = await supabase.from('profiles').select('id, full_name').eq('personal_id', user.id)
                
                // DEBUG
                console.log('--- DEBUG NOTIFICAÇÕES ---')
                console.log('Alunos do Personal:', myStudents?.length)

                if (myStudents && myStudents.length > 0) {
                    const studentIds = myStudents.map(s => s.id)
                    
                    // Aumentei para 30 dias para teste
                    const debugLimit = new Date()
                    debugLimit.setDate(debugLimit.getDate() - 30)
                    const debugLimitStr = debugLimit.toISOString()

                    const { data: recentWorkouts, error: histError } = await supabase
                        .from('workout_history')
                        .select('id, workout_title, finished_at, notes, student_id')
                        .in('student_id', studentIds)
                        .gte('finished_at', debugLimitStr) // 30 dias atrás
                        .order('finished_at', { ascending: false })
                        .limit(20)

                    if (histError) console.error('Erro buscando histórico:', histError)
                    console.log('Treinos Recentes Encontrados:', recentWorkouts)

                    recentWorkouts?.forEach(w => {
                        // Evita duplicatas se já veio do banco de notifications
                        // (Embora IDs sejam diferentes, o conteúdo é o mesmo. O ideal é usar um prefixo diferente)
                        // Vamos assumir que se veio do 'db-notifications', ok. Aqui é 'history-...'.
                        
                        const studentName = myStudents.find(s => s.id === w.student_id)?.full_name || 'Aluno'
                        list.push({
                            id: `history-${w.id}`,
                            type: 'workout_finished',
                            title: 'Treino Finalizado',
                            description: `${studentName} terminou "${w.workout_title}"${w.notes ? ': ' + w.notes : ''}`,
                            date: new Date(w.finished_at),
                            studentId: w.student_id,
                            link: `/students/history?id=${w.student_id}` // Ajuste conforme rota real
                        })
                    })
                }

                list.sort((a, b) => {
                    const isOverdueA = a.type.includes('overdue')
                    const isOverdueB = b.type.includes('overdue')
                    if (isOverdueA && !isOverdueB) return -1
                    if (!isOverdueA && isOverdueB) return 1
                    return b.date.getTime() - a.date.getTime()
                })

                setNotifications(list)

            } catch (error) {
                console.error('Erro Fatal Notificações:', error)
            } finally {
                setLoading(false)
            }
        }

        fetchNotifications()
        const interval = setInterval(fetchNotifications, 60000)
        return () => clearInterval(interval)
    }, [user])

    const handleClick = (n: PersonalNotification) => {
        setShowDropdown(false)
        if (n.link) navigate(n.link)
    }

    const getIcon = (type: PersonalNotification['type']) => {
        try {
            switch (type) {
                case 'financial_overdue': return <AlertCircle size={18} color="#dc2626" />
                case 'financial_due_soon': return <Clock size={18} color="#d97706" />
                case 'financial_paid': return <DollarSign size={18} color="#16a34a" />
                case 'anamnesis_overdue': return <AlertCircle size={18} color="#dc2626" />
                case 'anamnesis_answered': return <FileText size={18} color="#2563eb" />
                case 'workout_finished': return <Dumbbell size={18} color="#16a34a" />
                default: return <Bell size={18} />
            }
        } catch (e) {
            return <Bell size={18} />
        }
    }

    const getBgColor = (type: PersonalNotification['type']) => {
        switch (type) {
            case 'financial_overdue': 
            case 'anamnesis_overdue': return '#fee2e2'
            case 'financial_due_soon': return '#fef3c7'
            case 'financial_paid': 
            case 'workout_finished': return '#dcfce7'
            case 'anamnesis_answered': return '#dbeafe'
            default: return '#f1f5f9'
        }
    }

    return (
        <div style={{ position: 'relative' }} ref={dropdownRef}>
            <button 
                onClick={() => setShowDropdown(!showDropdown)}
                style={{ 
                    background: 'transparent', border: 'none', cursor: 'pointer', 
                    position: 'relative', color: '#64748b', padding: 8,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
            >
                <Bell size={24} />
                {notifications.length > 0 && (
                    <span style={{ 
                        position: 'absolute', top: 0, right: 0, 
                        background: '#ef4444', color: '#fff', 
                        fontSize: '0.7rem', fontWeight: 'bold', 
                        width: 18, height: 18, borderRadius: '50%', 
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: '2px solid #fff'
                    }}>
                        {notifications.length}
                    </span>
                )}
            </button>

            {showDropdown && (
                <div style={{ 
                    position: 'absolute', top: '100%', right: 0, width: 360, 
                    background: '#fff', borderRadius: 12, boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', 
                    border: '1px solid #f1f5f9', zIndex: 1000, overflow: 'hidden',
                    marginTop: 8
                }}>
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
                        <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>Notificações</strong>
                        <button onClick={() => setShowDropdown(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={16}/></button>
                    </div>
                    
                    <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                        {loading ? (
                            <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8' }}>Carregando...</div>
                        ) : notifications.length === 0 ? (
                            <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                                Nenhuma notificação recente.
                            </div>
                        ) : (
                            notifications.map(n => (
                                <div 
                                    key={n.id} 
                                    onClick={() => handleClick(n)}
                                    style={{ 
                                        padding: '12px 16px', borderBottom: '1px solid #f8fafc', 
                                        cursor: 'pointer', transition: 'background 0.2s',
                                        display: 'flex', gap: 12, alignItems: 'flex-start'
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                                    onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                                >
                                    <div style={{ 
                                        marginTop: 2, 
                                        background: getBgColor(n.type), 
                                        padding: 8, borderRadius: '50%', 
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        minWidth: 34, height: 34
                                    }}>
                                        {getIcon(n.type)}
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>{n.title}</div>
                                        <div style={{ fontSize: '0.8rem', color: '#64748b', lineHeight: 1.4 }}>{n.description}</div>
                                        <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: 4 }}>
                                            {n.date.toLocaleDateString('pt-BR')} {n.date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
