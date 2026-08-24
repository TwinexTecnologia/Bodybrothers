import { useState, useRef, useEffect } from 'react'
import { Bell, AlertCircle, Clock, DollarSign, FileText, Dumbbell, X, MessageSquare } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { supabase } from '../lib/supabase'
import { listStudentsByPersonal, type StudentRecord } from '../store/students'
import { listPlans, type PlanRecord } from '../store/plans'
import type { DebitRecord } from '../store/financial'
import { getCurrentBillingDueDate, normalizeDate } from '../lib/planBilling'

function reportNotificationDebug(hypothesisId: string, msg: string, data: Record<string, unknown>) {
    fetch('http://127.0.0.1:7777/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            sessionId: 'personal-dashboard-slow-v2',
            runId: 'pre-fix',
            hypothesisId,
            location: 'personal/src/components/NotificationBellV2.tsx',
            msg: `[DEBUG] ${msg}`,
            data,
            ts: Date.now(),
        }),
    }).catch(() => {})
}

type PersonalNotification = {
    id: string
    type: 'financial_overdue' | 'financial_due_soon' | 'financial_paid' | 'anamnesis_overdue' | 'anamnesis_answered' | 'workout_finished' | 'feedback' | 'system'
    title: string
    description: string
    date: Date
    studentId?: string
    link?: string
}

const DAY_MS = 1000 * 60 * 60 * 24

function getFinancialReminder(
    student: StudentRecord,
    plan: PlanRecord | undefined,
    payments: DebitRecord[],
): PersonalNotification | null {
    if (student.status !== 'ativo' || !plan || !student.planStartDate) return null

    const planName = plan.name.toLowerCase()
    const isFree = plan.price <= 0 || planName.includes('permuta') || planName.includes('gratuito')
    if (isFree) return null

    const today = normalizeDate(new Date())
    const studentPayments = payments
        .filter((payment) => payment.payerId === student.id)
        .sort((a, b) => new Date(b.paidAt || b.dueDate).getTime() - new Date(a.paidAt || a.dueDate).getTime())

    const lastPayment = studentPayments[0]
    const dueDate = getCurrentBillingDueDate(
        student.planStartDate,
        plan,
        lastPayment ? (lastPayment.paidAt || lastPayment.dueDate) : null,
    )
    if (!dueDate) return null

    const daysRemaining = Math.round((dueDate.getTime() - today.getTime()) / DAY_MS)
    const studentName = student.name || 'Aluno'

    if (daysRemaining < -3) {
        const daysOverdue = Math.abs(daysRemaining)
        return {
            id: `financial-overdue-${student.id}-${dueDate.toISOString()}`,
            type: 'financial_overdue',
            title: 'Pagamento em Atraso',
            description: `${studentName} está em atraso há ${daysOverdue} ${daysOverdue === 1 ? 'dia' : 'dias'}.`,
            date: dueDate,
            studentId: student.id,
            link: '/financial',
        }
    }

    if (daysRemaining >= -3 && daysRemaining <= 0) {
        return {
            id: `financial-due-today-${student.id}-${dueDate.toISOString()}`,
            type: 'financial_due_soon',
            title: daysRemaining === 0 ? 'Pagamento Vence Hoje' : 'Pagamento Recente',
            description: daysRemaining === 0 ? `${studentName} vence hoje.` : `${studentName} venceu nos últimos ${Math.abs(daysRemaining)} dias.`,
            date: dueDate,
            studentId: student.id,
            link: '/financial',
        }
    }

    if (daysRemaining >= 1 && daysRemaining <= 3) {
        const reminderText =
            daysRemaining === 1 ? 'vence amanhã' : `vence em ${daysRemaining} dias`

        return {
            id: `financial-due-soon-${student.id}-${dueDate.toISOString()}`,
            type: 'financial_due_soon',
            title: 'Lembrete de Pagamento',
            description: `${studentName} ${reminderText}.`,
            date: dueDate,
            studentId: student.id,
            link: '/financial',
        }
    }

    return null
}

function getNotificationPriority(notification: PersonalNotification) {
    if (notification.type === 'financial_overdue') return 0

    if (notification.type === 'financial_due_soon') {
        const today = normalizeDate(new Date())
        const diffDays = Math.ceil((normalizeDate(notification.date).getTime() - today.getTime()) / DAY_MS)
        if (diffDays === 0) return 1
        if (diffDays === 1) return 2
        if (diffDays === 2) return 3
        if (diffDays === 3) return 4
        return 5
    }

    return 10
}

export default function NotificationBellV2() {
    const { user } = useAuth()
    const [notifications, setNotifications] = useState<PersonalNotification[]>([])
    const [unreadCount, setUnreadCount] = useState(0) // Estado para controle de lidos
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
        const fetchNotifications = async () => {
            const fetchStartedAt = performance.now()
            // #region debug-point D:notification-start
            reportNotificationDebug('D', 'Notification fetch started', {
                hasHookUser: Boolean(user),
            })
            // #endregion
            let currentUser = user
            
            // Fallback se o hook falhar
            if (!currentUser) {
                const { data } = await supabase.auth.getUser()
                currentUser = data.user
            }

            if (!currentUser) {
                // #region debug-point D:notification-no-user
                reportNotificationDebug('D', 'Notification fetch skipped without user', {
                    durationMs: Math.round(performance.now() - fetchStartedAt),
                })
                // #endregion
                return
            }

            setLoading(true)
            try {
                const list: PersonalNotification[] = []
                
                const todayStr = new Date().toISOString().split('T')[0]
                const recentLimit = new Date()
                recentLimit.setDate(recentLimit.getDate() - 30) // 30 dias de histórico
                const recentLimitStr = recentLimit.toISOString()

                const paidStart = new Date()
                paidStart.setDate(paidStart.getDate() - 400)

                const [
                    students,
                    plans,
                    { data: paidDebits },
                    { data: answers },
                    { data: expiredAnamnesis },
                    { data: sysNotifications },
                ] = await Promise.all([
                    listStudentsByPersonal(currentUser.id),
                    listPlans(currentUser.id),
                    supabase
                        .from('debits')
                        .select('id, amount, paid_at, due_date, payer_id, receiver_id, status, description, saas_ref_month')
                        .eq('receiver_id', currentUser.id)
                        .eq('status', 'paid')
                        .gte('paid_at', paidStart.toISOString()),
                    supabase
                        .from('protocols')
                        .select('id, title, created_at, student_id')
                        .eq('personal_id', currentUser.id)
                        .eq('type', 'anamnesis')
                        .gte('created_at', recentLimitStr),
                    supabase
                        .from('protocols')
                        .select('id, title, ends_at, student_id')
                        .eq('personal_id', currentUser.id)
                        .eq('type', 'anamnesis_model')
                        .lt('ends_at', todayStr),
                    supabase
                        .from('notifications')
                        .select('id, type, title, message, created_at, link')
                        .eq('user_id', currentUser.id)
                        .gte('created_at', recentLimitStr),
                ])
                // #region debug-point D:notification-queries-finished
                reportNotificationDebug('D', 'Notification queries finished', {
                    durationMs: Math.round(performance.now() - fetchStartedAt),
                    studentsCount: students.length,
                    plansCount: plans.length,
                    paidDebitsCount: paidDebits?.length || 0,
                    answersCount: answers?.length || 0,
                    expiredAnamnesisCount: expiredAnamnesis?.length || 0,
                    sysNotificationsCount: sysNotifications?.length || 0,
                })
                // #endregion

                // COLETAR IDs PARA NOMES
                const allStudentIds = new Set<string>()
                students.forEach((student) => allStudentIds.add(student.id))
                paidDebits?.forEach((d: any) => d.payer_id && allStudentIds.add(d.payer_id))
                answers?.forEach((a: any) => a.student_id && allStudentIds.add(a.student_id))
                expiredAnamnesis?.forEach((a: any) => a.student_id && allStudentIds.add(a.student_id))

                let profilesMap: Record<string, string> = {}
                if (allStudentIds.size > 0) {
                    const { data: profiles } = await supabase
                        .from('profiles')
                        .select('id, full_name')
                        .in('id', Array.from(allStudentIds))
                    
                    if (profiles) {
                        profiles.forEach(p => { profilesMap[p.id] = p.full_name || 'Aluno' })
                    }
                }

                // PROCESSAR LISTAS

                const planMap = new Map(plans.map((plan) => [plan.id, plan]))
                const mappedPayments: DebitRecord[] = (paidDebits || []).map((d: any) => ({
                    id: d.id,
                    payerId: d.payer_id,
                    receiverId: d.receiver_id,
                    amount: Number(d.amount),
                    description: d.description,
                    dueDate: d.due_date,
                    paidAt: d.paid_at,
                    status: d.status,
                    monthRef: d.saas_ref_month,
                }))

                students
                    .filter((student) => student.status === 'ativo')
                    .forEach((student) => {
                        const financialReminder = getFinancialReminder(student, student.planId ? planMap.get(student.planId) : undefined, mappedPayments)
                        if (financialReminder) list.push(financialReminder)
                    })
                
                // Pagos
                paidDebits?.forEach((d: any) => {
                    list.push({
                        id: `paid-${d.id}`,
                        type: 'financial_paid',
                        title: 'Pagamento Recebido',
                        description: `${profilesMap[d.payer_id] || 'Aluno'} pagou R$ ${Number(d.amount).toFixed(2)}`,
                        date: new Date(d.paid_at),
                        studentId: d.payer_id
                    })
                })

                // Anamneses Respondidas
                answers?.forEach((a: any) => {
                    list.push({
                        id: `anam-ans-${a.id}`,
                        type: 'anamnesis_answered',
                        title: 'Anamnese Respondida',
                        description: `${profilesMap[a.student_id] || 'Aluno'} respondeu "${a.title}"`,
                        date: new Date(a.created_at),
                        studentId: a.student_id,
                        link: `/protocols/anamnesis/view/${a.id}`
                    })
                })
                
                // Anamneses Vencidas
                expiredAnamnesis?.forEach((a: any) => {
                    list.push({
                        id: `anam-exp-${a.id}`,
                        type: 'anamnesis_overdue',
                        title: 'Anamnese Vencida',
                        description: `${profilesMap[a.student_id] || 'Aluno'} não respondeu "${a.title}"`,
                        date: new Date(a.ends_at),
                        studentId: a.student_id,
                        link: '/protocols/anamnesis-pending'
                    })
                })

                // Sistema / Feedback
                sysNotifications?.forEach((n: any) => {
                    list.push({
                        id: `sys-${n.id}`,
                        type: n.type || 'system',
                        title: n.title,
                        description: n.message,
                        date: new Date(n.created_at),
                        link: n.link
                    })
                })

                // ORDENAR: financeiros prioritarios primeiro, restante por data mais recente
                list.sort((a, b) => {
                    const priorityDiff = getNotificationPriority(a) - getNotificationPriority(b)
                    if (priorityDiff !== 0) return priorityDiff

                    if (a.type === 'financial_overdue' && b.type === 'financial_overdue') {
                        return a.date.getTime() - b.date.getTime()
                    }

                    if (a.type === 'financial_due_soon' && b.type === 'financial_due_soon') {
                        return a.date.getTime() - b.date.getTime()
                    }

                    return b.date.getTime() - a.date.getTime()
                })

                setNotifications(list)
                
                // Calcular não lidos baseado no LocalStorage
                const lastReadStr = localStorage.getItem('notification_last_read')
                const lastReadDate = lastReadStr ? new Date(lastReadStr) : new Date(0)
                const unread = list.filter(n => n.date.getTime() > lastReadDate.getTime()).length
                setUnreadCount(unread)
                // #region debug-point D:notification-finished
                reportNotificationDebug('D', 'Notification fetch finished', {
                    durationMs: Math.round(performance.now() - fetchStartedAt),
                    notificationsCount: list.length,
                    unreadCount: unread,
                })
                // #endregion

            } catch (error) {
                // #region debug-point D:notification-error
                reportNotificationDebug('D', 'Notification fetch failed', {
                    durationMs: Math.round(performance.now() - fetchStartedAt),
                    error: error instanceof Error ? error.message : String(error),
                })
                // #endregion
                console.error('Erro Fatal Notificações:', error)
            } finally {
                setLoading(false)
            }
        }

        const timeout = window.setTimeout(fetchNotifications, 700)
        // Atualiza a cada 60s
        const interval = setInterval(fetchNotifications, 60000)
        return () => {
            clearTimeout(timeout)
            clearInterval(interval)
        }
    }, [user])

    const handleClick = (n: PersonalNotification) => {
        setShowDropdown(false)
        if (n.type === 'feedback') return // Apenas informativo
        if (n.link) navigate(n.link)
    }

    const getIcon = (type: PersonalNotification['type']) => {
        switch (type) {
            case 'financial_overdue': return <AlertCircle size={18} color="#dc2626" />
            case 'financial_due_soon': return <Clock size={18} color="#d97706" />
            case 'financial_paid': return <DollarSign size={18} color="#16a34a" />
            case 'anamnesis_overdue': return <AlertCircle size={18} color="#dc2626" />
            case 'anamnesis_answered': return <FileText size={18} color="#2563eb" />
            case 'workout_finished': return <Dumbbell size={18} color="#16a34a" />
            case 'feedback': return <MessageSquare size={18} color="#ea580c" />
            default: return <Bell size={18} />
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
            case 'feedback': return '#ffedd5'
            default: return '#f1f5f9'
        }
    }

    return (
        <div style={{ position: 'relative' }} ref={dropdownRef}>
            <button 
                onClick={() => {
                    setShowDropdown(!showDropdown)
                    if (!showDropdown) {
                        setUnreadCount(0)
                        localStorage.setItem('notification_last_read', new Date().toISOString())
                    }
                }}
                style={{ 
                    background: 'transparent', border: 'none', cursor: 'pointer', 
                    position: 'relative', color: '#64748b', padding: 8,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
            >
                <Bell size={24} />
                {unreadCount > 0 && (
                    <span style={{ 
                        position: 'absolute', top: 0, right: 0, 
                        background: '#ef4444', color: '#fff', 
                        fontSize: '0.7rem', fontWeight: 'bold', 
                        width: 18, height: 18, borderRadius: '50%', 
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: '2px solid #fff'
                    }}>
                        {unreadCount}
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
                                        cursor: n.type === 'feedback' ? 'default' : 'pointer', 
                                        transition: 'background 0.2s',
                                        display: 'flex', gap: 12, alignItems: 'flex-start'
                                    }}
                                    onMouseEnter={e => n.type !== 'feedback' && (e.currentTarget.style.background = '#f8fafc')}
                                    onMouseLeave={e => n.type !== 'feedback' && (e.currentTarget.style.background = '#fff')}
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
