import { useEffect, useState } from 'react'
import { listStudentsByPersonal, type StudentRecord } from '../../store/students'
import { supabase } from '../../lib/supabase'
import { useNavigate } from 'react-router-dom'

type PendingItem = {
    student: StudentRecord
    status: 'expired' | 'missing'
    dueDate?: string // Data que venceu
}

type ReviewItem = {
    id: string
    student: StudentRecord
    answeredAt: string
    data: any
}

export default function AnamnesisPending() {
    const navigate = useNavigate()
    const [pendingItems, setPendingItems] = useState<PendingItem[]>([])
    const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]) // Itens para revisar
    const [loading, setLoading] = useState(true)
    const [markingId, setMarkingId] = useState<string | null>(null)

    useEffect(() => {
        load()
    }, [])

    async function load() {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                const [students, modelsRes, responsesRes] = await Promise.all([
                    listStudentsByPersonal(user.id),
                    supabase.from('protocols').select('*').eq('personal_id', user.id).eq('type', 'anamnesis_model'),
                    supabase.from('protocols').select('*').eq('personal_id', user.id).eq('type', 'anamnesis')
                ])

                const allModels = modelsRes.data || []
                const allResponses = responsesRes.data || []
                const activeStudents = students.filter(s => s.status === 'ativo')
                
                const resultPending: PendingItem[] = []
                const resultReview: ReviewItem[] = []
                const now = new Date()

                // Se não tiver modelos, não tem pendência
                if (allModels.length > 0) {
                    activeStudents.forEach(student => {
                        // 1. Verifica se tem modelo VINCULADO
                        const hasLinkedModel = allModels.some(m => m.student_id === student.id)
                        if (!hasLinkedModel) return

                        // 2. Busca respostas
                        const studentResponses = allResponses.filter(r => r.student_id === student.id)
                        
                        // Lógica de Revisão (Novas Respostas)
                        // Pega todas as respostas que NÃO foram revisadas ainda
                        studentResponses.forEach(resp => {
                            const respData = resp.data || resp.content || {}
                            // Se não tem reviewed_at, precisa de revisão
                            if (!respData.reviewed_at) {
                                resultReview.push({
                                    id: resp.id,
                                    student,
                                    answeredAt: resp.created_at,
                                    data: respData
                                })
                            }
                        })

                        if (studentResponses.length === 0) {
                            // Nunca respondeu -> Ignora (ou mostra como missing se quiser)
                        } else {
                            // Verifica validade da última
                            studentResponses.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                            const last = studentResponses[0]
                            
                            const renewDays = last.renew_in_days || 90
                            if (renewDays) {
                                const created = new Date(last.created_at)
                                const expireDate = new Date(created.getTime() + (renewDays * 24 * 60 * 60 * 1000))
                                expireDate.setHours(0, 0, 0, 0)
                                
                                const nowZero = new Date(now)
                                nowZero.setHours(0,0,0,0)

                                if (expireDate <= nowZero) {
                                    resultPending.push({
                                        student,
                                        status: 'expired',
                                        dueDate: expireDate.toISOString()
                                    })
                                }
                            }
                        }
                    })
                }

                setPendingItems(resultPending)
                setReviewItems(resultReview.sort((a, b) => new Date(b.answeredAt).getTime() - new Date(a.answeredAt).getTime()))
            }
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    const handleMarkAsReviewed = async (item: ReviewItem) => {
        if (!confirm(`Confirmar que analisou a anamnese de ${item.student.name}?`)) return
        
        setMarkingId(item.id)
        try {
            // Atualiza o JSON data adicionando reviewed_at
            const newData = { ...item.data, reviewed_at: new Date().toISOString() }
            
            // Tenta atualizar tanto data quanto content para garantir
            const { error } = await supabase
                .from('protocols')
                .update({ 
                    data: newData,
                    content: newData // Alguns registros usam content
                })
                .eq('id', item.id)

            if (error) throw error

            // Remove da lista localmente
            setReviewItems(prev => prev.filter(i => i.id !== item.id))
            alert('Anamnese marcada como concluída!')
        } catch (err: any) {
            alert('Erro ao atualizar: ' + err.message)
        } finally {
            setMarkingId(null)
        }
    }

    if (loading) return <div>Carregando...</div>

    return (
        <div>
            <h1>Gestão de Anamneses</h1>
            <button className="btn" onClick={() => navigate('/dashboard/overview')} style={{ marginBottom: 20, background: 'transparent', color: '#666', border: '1px solid #ccc' }}>← Voltar</button>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
                
                {/* SEÇÃO 1: AGUARDANDO ANÁLISE (NOVO) */}
                <div className="section">
                    <h2 style={{ fontSize: '1.2rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                        🔔 Aguardando Análise <span style={{ background: '#3b82f6', color: '#fff', fontSize: '0.8rem', padding: '2px 8px', borderRadius: 12 }}>{reviewItems.length}</span>
                    </h2>
                    
                    {reviewItems.length === 0 ? (
                        <div style={{ padding: 20, background: '#f8fafc', borderRadius: 8, color: '#64748b', fontSize: '0.9rem' }}>
                            Nenhuma anamnese recente para analisar.
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gap: 10 }}>
                            {reviewItems.map(item => (
                                <div key={item.id} className="form-card" style={{ padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: '4px solid #3b82f6', background: '#eff6ff' }}>
                                    <div>
                                        <div style={{ fontWeight: 'bold', fontSize: '1.1em', color: '#1e3a8a' }}>{item.student.name}</div>
                                        <div style={{ fontSize: 13, color: '#3b82f6', marginTop: 4 }}>
                                            Respondeu em {new Date(item.answeredAt).toLocaleDateString()} às {new Date(item.answeredAt).toLocaleTimeString().slice(0,5)}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button 
                                            className="btn"
                                            onClick={() => navigate(`/protocols/view/${item.id}`)}
                                            style={{ background: '#fff', color: '#3b82f6', border: '1px solid #bfdbfe', padding: '8px 12px' }}
                                        >
                                            Ver Respostas
                                        </button>
                                        <button 
                                            className="btn" 
                                            disabled={markingId === item.id}
                                            onClick={() => handleMarkAsReviewed(item)}
                                            style={{ background: '#3b82f6', color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}
                                        >
                                            {markingId === item.id ? '...' : '✅ Concluir'}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* SEÇÃO 2: PENDÊNCIAS (VENCIDOS) */}
                <div className="section">
                    <h2 style={{ fontSize: '1.2rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                        ⚠️ Pendências / Vencidos
                    </h2>

                    <div style={{ display: 'grid', gap: 10 }}>
                        {pendingItems.length === 0 && (
                            <div className="form-card" style={{ padding: 20, textAlign: 'center', color: '#64748b' }}>
                                <div>✅ Tudo em dia com os prazos!</div>
                            </div>
                        )}
                        
                        {pendingItems.map((item, idx) => (
                            <div key={item.student.id + idx} className="form-card" style={{ padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: item.status === 'missing' ? '4px solid #f59e0b' : '4px solid #ef4444' }}>
                                <div>
                                    <div style={{ fontWeight: 'bold', fontSize: '1.1em' }}>{item.student.name}</div>
                                    {item.status === 'missing' ? (
                                        <div style={{ fontSize: 13, color: '#d97706', display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <span>⚠️</span> Nunca respondeu
                                        </div>
                                    ) : (
                                        <div style={{ fontSize: 13, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <span>⏰</span> Venceu em {new Date(item.dueDate!).toLocaleDateString()}
                                        </div>
                                    )}
                                </div>
                                <button 
                                    className="btn" 
                                    style={{ background: item.status === 'missing' ? '#0f172a' : '#ef4444' }}
                                    onClick={() => navigate(`/protocols/anamnesis-apply?studentId=${item.student.id}`)}
                                >
                                    {item.status === 'missing' ? 'Aplicar Nova' : 'Renovar'}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
