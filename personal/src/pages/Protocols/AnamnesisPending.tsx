import { useEffect, useState } from 'react'
import { listPendingAnamneses, type AnamnesisResponse } from '../../store/anamnesis'
import { listStudentsByPersonal, type StudentRecord } from '../../store/students'
import { supabase } from '../../lib/supabase'
import { useNavigate } from 'react-router-dom'

export default function AnamnesisPending() {
    const navigate = useNavigate()
    const [items, setItems] = useState<AnamnesisResponse[]>([])
    const [students, setStudents] = useState<StudentRecord[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function load() {
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                const [pList, sList] = await Promise.all([
                    listPendingAnamneses(user.id),
                    listStudentsByPersonal(user.id)
                ])
                setItems(pList)
                setStudents(sList)
            }
            setLoading(false)
        }
        load()
    }, [])

    if (loading) return <div>Carregando...</div>

    return (
        <div>
            <h1>Pendências • Anamneses Vencidas</h1>
            <button className="btn" onClick={() => navigate('/dashboard/overview')} style={{ marginBottom: 20, background: 'transparent', color: '#666', border: '1px solid #ccc' }}>← Voltar</button>
            
            <div style={{ display: 'grid', gap: 10 }}>
                {items.length === 0 && <div className="form-card" style={{ padding: 20, textAlign: 'center' }}>Nenhuma anamnese vencida. Tudo em dia!</div>}
                {items.map(item => {
                    const student = students.find(s => s.id === item.studentId)
                    return (
                        <div key={item.id} className="form-card" style={{ padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <div style={{ fontWeight: 'bold' }}>{student?.name || 'Aluno Desconhecido'}</div>
                                <div style={{ fontSize: 13, color: '#dc2626' }}>Venceu em: {new Date(item.dueDate!).toLocaleDateString()}</div>
                            </div>
                            <button 
                                className="btn" 
                                onClick={() => navigate(`/protocols/anamnesis-apply?studentId=${item.studentId}`)}
                            >
                                Renovar
                            </button>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
