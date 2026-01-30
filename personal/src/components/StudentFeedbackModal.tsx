import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { X, MessageSquare, Calendar, AlertTriangle, Clock } from 'lucide-react'

type Props = {
    studentId: string
    studentName: string
    onClose: () => void
}

type HistoryItem = {
    id: string
    workout_title: string
    started_at: string
    finished_at: string | null
    notes?: string
    feedback?: string
    duration_seconds?: number
}

export default function StudentFeedbackModal({ studentId, studentName, onClose }: Props) {
    const [history, setHistory] = useState<HistoryItem[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const loadHistory = async () => {
            setLoading(true)
            await autoCloseStaleSessions()
            
            const { data, error } = await supabase
                .from('workout_history')
                .select('*')
                .eq('student_id', studentId)
                .order('started_at', { ascending: false })
            
            if (error) console.error(error)
            else setHistory(data || [])
            setLoading(false)
        }
        loadHistory()
    }, [studentId])

    async function autoCloseStaleSessions() {
        try {
            const { data: staleSessions, error } = await supabase
                .from('workout_history')
                .select('id, started_at')
                .eq('student_id', studentId)
                .is('finished_at', null)
            
            if (error || !staleSessions) return

            const now = new Date()
            const fourHoursMs = 4 * 60 * 60 * 1000

            const sessionsToClose = staleSessions.filter(s => {
                const start = new Date(s.started_at)
                const diff = now.getTime() - start.getTime()
                return diff > fourHoursMs
            })

            if (sessionsToClose.length > 0) {
                for (const s of sessionsToClose) {
                    const start = new Date(s.started_at)
                    const autoFinishTime = new Date(start.getTime() + 60 * 60 * 1000).toISOString() 
                    
                    await supabase
                        .from('workout_history')
                        .update({
                            finished_at: autoFinishTime,
                            feedback: 'Encerrado por não finalizar',
                            notes: 'Encerrado por não finalizar',
                            duration_seconds: 14400 // 4 horas
                        })
                        .eq('id', s.id)
                }
            }
        } catch (err) {
            console.error('Erro ao limpar sessões antigas:', err)
        }
    }

    const grouped = history.reduce((acc, item) => {
        const refDate = item.finished_at ? item.finished_at : item.started_at
        const date = new Date(refDate).toLocaleDateString('pt-BR')
        
        if (!acc[date]) acc[date] = []
        acc[date].push(item)
        return acc
    }, {} as Record<string, HistoryItem[]>)

    // Função para verificar se foi fechado pelo sistema
    const isSystemClosed = (text?: string) => {
        if (!text) return false
        return text.includes('Finalizado automaticamente') || text.includes('Aluno não finalizou') || text.includes('Encerrado por não finalizar')
    }

    const formatDuration = (seconds?: number) => {
        if (!seconds) return ''
        const h = Math.floor(seconds / 3600)
        const m = Math.floor((seconds % 3600) / 60)
        return h > 0 ? `${h}h ${m}m` : `${m}m`
    }

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
            <div style={{ background: '#fff', width: '90%', maxWidth: 600, maxHeight: '80vh', borderRadius: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ padding: 16, borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0 }}>Histórico & Feedbacks - {studentName}</h3>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}><X /></button>
                </div>
                
                <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
                    {loading ? <div>Carregando...</div> : (
                        Object.keys(grouped).length === 0 ? <div>Nenhum treino registrado.</div> : (
                            Object.entries(grouped).map(([date, items]) => (
                                <div key={date} style={{ marginBottom: 24 }}>
                                    <h4 style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#64748b', marginBottom: 12, fontSize: '0.9rem', borderBottom: '1px solid #f1f5f9', paddingBottom: 4 }}>
                                        <Calendar size={16} /> {date}
                                    </h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                        {items.map(item => {
                                            const autoClosed = isSystemClosed(item.notes) || isSystemClosed(item.feedback)
                                            const isRunning = !item.finished_at

                                            return (
                                                <div key={item.id} style={{ background: isRunning ? '#fff7ed' : '#f8fafc', padding: 12, borderRadius: 8, border: `1px solid ${isRunning ? '#fdba74' : '#e2e8f0'}` }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <div style={{ fontWeight: 600, color: '#334155', marginBottom: 4 }}>{item.workout_title}</div>
                                                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                                            {item.duration_seconds && <span style={{ fontSize: '0.75rem', color: '#64748b', background: '#e2e8f0', padding: '2px 6px', borderRadius: 4 }}>⏱ {formatDuration(item.duration_seconds)}</span>}
                                                            {isRunning && <span style={{ fontSize: '0.75rem', background: '#fff7ed', color: '#c2410c', padding: '2px 6px', borderRadius: 4, border: '1px solid #ffedd5' }}>Em andamento</span>}
                                                        </div>
                                                    </div>

                                                    {item.notes ? (
                                                        <div style={{ 
                                                            display: 'flex', gap: 8, marginTop: 8, 
                                                            background: autoClosed ? '#f3f4f6' : '#fff', 
                                                            padding: 8, borderRadius: 6, 
                                                            border: `1px solid ${autoClosed ? '#e5e7eb' : '#e2e8f0'}` 
                                                        }}>
                                                            {autoClosed ? (
                                                                <Clock size={16} color="#9ca3af" style={{ flexShrink: 0, marginTop: 2 }} />
                                                            ) : (
                                                                <MessageSquare size={16} color="#f59e0b" style={{ flexShrink: 0, marginTop: 2 }} />
                                                            )}
                                                            <div style={{ fontSize: '0.9rem', color: autoClosed ? '#6b7280' : '#475569', fontStyle: autoClosed ? 'italic' : 'normal' }}>
                                                                "{item.notes}"
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic', marginTop: 4 }}>Sem feedback registrado.</div>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            ))
                        )
                    )}
                </div>
            </div>
        </div>
    )
}