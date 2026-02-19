import { useState, useRef, useEffect } from 'react'
import { Bell, AlertCircle, Clock, DollarSign, FileText, Dumbbell, X, MessageSquare } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { supabase } from '../lib/supabase'

type PersonalNotification = {
    id: string
    type: 'financial_overdue' | 'financial_due_soon' | 'financial_paid' | 'anamnesis_overdue' | 'anamnesis_answered' | 'workout_finished' | 'feedback' | 'system'
    title: string
    description: string
    date: Date
    studentId?: string
    link?: string
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
            let currentUser = user
            
            // Fallback se o hook falhar
            if (!currentUser) {
                console.error('Hook user vazio, tentando supabase.auth.getUser()...')
                const { data } = await supabase.auth.getUser()
                currentUser = data.user
            }

            if (!currentUser) {
                console.error('ABORTANDO: Usuário não autenticado.')
                return
            }

            setLoading(true)
            try {
                const list: PersonalNotification[] = []
                
                const todayStr = new Date().toISOString().split('T')[0]
                const recentLimit = new Date()
                recentLimit.setDate(recentLimit.getDate() - 30) // 30 dias de histórico
                const recentLimitStr = recentLimit.toISOString()

                // 1. Financeiro (Pagos Recentes)
                const { data: paidDebits } = await supabase
                    .from('debits')
                    .select('id, amount, paid_at, payer_id') 
                    .eq('receiver_id', currentUser.id)
                    .eq('status', 'paid')
                    .gte('paid_at', recentLimitStr)

                // 2. Financeiro (Pendentes)
                const { data: pendingDebits } = await supabase
                    .from('debits')
                    .select('id, amount, due_date, payer_id')
                    .eq('receiver_id', currentUser.id)
                    .eq('status', 'pending')

                // 3. Anamneses (Respondidas Recentes)
                const { data: answers, error: err3 } = await supabase
                    .from('protocols')
                    .select('id, title, created_at, student_id')
                    .eq('personal_id', currentUser.id)
                    .eq('type', 'anamnesis')
                    .gte('created_at', recentLimitStr)

                // 4. Anamneses (Vencidas)
                const { data: expiredAnamnesis } = await supabase
                    .from('protocols')
                    .select('id, title, ends_at, student_id')
                    .eq('personal_id', currentUser.id)
                    .eq('type', 'anamnesis_model')
                    .lt('ends_at', todayStr)

                // 5. Notificações do Sistema (Feedbacks, etc)
                const { data: sysNotifications, error: sysError } = await supabase
                    .from('notifications')
                    .select('id, type, title, message, created_at, link')
                    .eq('user_id', currentUser.id)
                    .gte('created_at', recentLimitStr)

                if (sysError) console.error('Erro SysNotif:', sysError)
                console.log('Notificações Sistema:', sysNotifications)

                // COLETAR IDs PARA NOMES
                const allStudentIds = new Set<string>()
                paidDebits?.forEach((d: any) => d.payer_id && allStudentIds.add(d.payer_id))
                pendingDebits?.forEach((d: any) => d.payer_id && allStudentIds.add(d.payer_id))
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

                // Pendentes
                pendingDebits?.forEach((d: any) => {
                    const name = profilesMap[d.payer_id] || 'Aluno'
                    const dueParts = d.due_date.split('-').map(Number)
                    const localDue = new Date(dueParts[0], dueParts[1]-1, dueParts[2])
                    const diffTime = localDue.getTime() - new Date().setHours(0,0,0,0)
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

                    if (diffDays < 0) {
                        list.push({
                            id: `overdue-${d.id}`,
                            type: 'financial_overdue',
                            title: 'Pagamento Atrasado',
                            description: `${name} - Venceu há ${Math.abs(diffDays)} dias`,
                            date: localDue,
                            studentId: d.payer_id,
                            link: '/financial'
                        })
                    } else if (diffDays <= 3) {
                        list.push({
                            id: `due-${d.id}`,
                            type: 'financial_due_soon',
                            title: 'Vencimento Próximo',
                            description: `${name} - Vence em ${diffDays === 0 ? 'hoje' : diffDays + ' dias'}`,
                            date: localDue,
                            studentId: d.payer_id,
                            link: '/financial'
                        })
                    }
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

                // ORDENAR: Mais recentes primeiro
                list.sort((a, b) => b.date.getTime() - a.date.getTime())

                console.log('Total Notificações:', list.length)
                console.log('Top 3 Notificações:', list.slice(0, 3))

                setNotifications(list)
                
                // Calcular não lidos baseado no LocalStorage
                const lastReadStr = localStorage.getItem('notification_last_read')
                const lastReadDate = lastReadStr ? new Date(lastReadStr) : new Date(0)
                const unread = list.filter(n => n.date.getTime() > lastReadDate.getTime()).length
                setUnreadCount(unread)

            } catch (error) {
                console.error('Erro Fatal Notificações:', error)
            } finally {
                setLoading(false)
            }
        }

        fetchNotifications()
        // Atualiza a cada 60s
        const interval = setInterval(fetchNotifications, 60000)
        return () => clearInterval(interval)
    }, [user])

    const handleClick = (n: PersonalNotification) => {
        setShowDropdown(false)
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
            case 'feedback': return <MessageSquare size={18} color="#2563eb" />
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
            case 'anamnesis_answered': 
            case 'feedback': return '#dbeafe'
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
