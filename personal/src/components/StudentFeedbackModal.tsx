import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { X, MessageSquare, Calendar } from 'lucide-react'

type Props = {
    studentId: string
    studentName: string
    onClose: () => void
}

type HistoryItem = {
    id: string
    workout_title: string
    finished_at: string
    notes?: string
}

export default function StudentFeedbackModal({ studentId, studentName, onClose }: Props) {
    const [history, setHistory] = useState<HistoryItem[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const loadHistory = async () => {
            const { data, error } = await supabase
                .from('workout_history')
                .select('*')
                .eq('student_id', studentId)
                .order('finished_at', { ascending: false })
            
            if (error) console.error(error)
            else setHistory(data || [])
            setLoading(false)
        }
        loadHistory()
    }, [studentId])

    // Agrupar por data
    const grouped = history.reduce((acc, item) => {
        const date = new Date(item.finished_at).toLocaleDateString('pt-BR')
        if (!acc[date]) acc[date] = []
        acc[date].push(item)
        return acc
    }, {} as Record<string, HistoryItem[]>)

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
                                        {items.map(item => (
                                            <div key={item.id} style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                                                <div style={{ fontWeight: 600, color: '#334155', marginBottom: 4 }}>{item.workout_title}</div>
                                                {item.notes ? (
                                                    <div style={{ display: 'flex', gap: 8, marginTop: 8, background: '#fff', padding: 8, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                                                        <MessageSquare size={16} color="#f59e0b" style={{ flexShrink: 0, marginTop: 2 }} />
                                                        <div style={{ fontSize: '0.9rem', color: '#475569' }}>"{item.notes}"</div>
                                                    </div>
                                                ) : (
                                                    <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic' }}>Sem feedback registrado.</div>
                                                )}
                                            </div>
                                        ))}
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