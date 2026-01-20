import { useEffect, useState } from 'react'
import { listStudentsByPersonal, type StudentRecord } from '../../store/students'
import { supabase } from '../../lib/supabase'
import { useNavigate } from 'react-router-dom'

type PendingItem = {
    student: StudentRecord
    status: 'expired' | 'missing'
    dueDate?: string // Data que venceu
}

export default function AnamnesisPending() {
    const navigate = useNavigate()
    const [pendingItems, setPendingItems] = useState<PendingItem[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
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
                    
                    const result: PendingItem[] = []
                    const now = new Date()

                    // Se não tiver modelos, não tem pendência
                    if (allModels.length > 0) {
                        activeStudents.forEach(student => {
                            // 1. Verifica se tem modelo VINCULADO (específico do aluno)
                            // Ignora modelos globais conforme solicitado
                            const hasLinkedModel = allModels.some(m => m.student_id === student.id)
                            if (!hasLinkedModel) return

                            // 2. Busca respostas
                            const studentResponses = allResponses.filter(r => r.student_id === student.id)
                            
                            if (studentResponses.length === 0) {
                                // Nunca respondeu -> Ignora.
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
                                        result.push({
                                            student,
                                            status: 'expired',
                                            dueDate: expireDate.toISOString()
                                        })
                                    }
                                }
                            }
                            // Se nunca respondeu, ignora.
                        })
                    }

                    setPendingItems(result)
                }
            } catch (err) {
                console.error(err)
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [])

    if (loading) return <div>Carregando...</div>

    return (
        <div>
            <h1>Pendências • Anamneses</h1>
            <button className="btn" onClick={() => navigate('/dashboard/overview')} style={{ marginBottom: 20, background: 'transparent', color: '#666', border: '1px solid #ccc' }}>← Voltar</button>
            
            <div style={{ display: 'grid', gap: 10 }}>
                {pendingItems.length === 0 && (
                    <div className="form-card" style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
                        <div style={{ fontSize: '2rem', marginBottom: 10 }}>✅</div>
                        <div>Tudo em dia!</div>
                        <div style={{ fontSize: '0.9em', marginTop: 4 }}>Todos os alunos ativos possuem anamneses válidas.</div>
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
    )
}
