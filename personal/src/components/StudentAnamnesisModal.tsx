import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Modal from './Modal'
import { useNavigate } from 'react-router-dom'
import { FileText, Calendar, Eye, Camera } from 'lucide-react'

interface Props {
    studentId: string
    studentName: string
    onClose: () => void
}

export default function StudentAnamnesisModal({ studentId, studentName, onClose }: Props) {
    const navigate = useNavigate()
    const [list, setList] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const load = async () => {
            const { data } = await supabase
                .from('protocols')
                .select('id, title, created_at')
                .eq('student_id', studentId)
                .eq('type', 'anamnesis')
                .order('created_at', { ascending: false })
            setList(data || [])
            setLoading(false)
        }
        load()
    }, [studentId])

    const handleView = (id: string) => {
        // Navega para a visualização
        navigate(`/protocols/anamnesis/view/${id}`)
    }

    return (
        <Modal isOpen={true} onClose={onClose} title={`Anamneses de ${studentName}`}>
            <div style={{ minWidth: 400, maxHeight: '60vh', overflowY: 'auto' }}>
                
                <button 
                    className="btn" 
                    onClick={() => navigate(`/students/evolution/${studentId}`)}
                    style={{ 
                        width: '100%', 
                        marginBottom: 20, 
                        padding: '10px', 
                        background: '#eff6ff', 
                        color: '#2563eb', 
                        border: '1px solid #dbeafe',
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        gap: 8,
                        fontWeight: 600,
                        borderRadius: 8
                    }}
                >
                    <Camera size={18} /> Ver Evolução Fotográfica
                </button>

                {loading ? (
                    <div style={{ padding: 20, textAlign: 'center', color: '#64748b' }}>Carregando...</div>
                ) : list.length === 0 ? (
                    <div style={{ padding: 30, textAlign: 'center', color: '#94a3b8', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                        <FileText size={40} strokeWidth={1} />
                        <div>Nenhuma anamnese respondida.</div>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gap: 10 }}>
                        {list.map(item => (
                            <div 
                                key={item.id} 
                                style={{ 
                                    padding: 12, border: '1px solid #e2e8f0', borderRadius: 8, 
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    background: '#f8fafc'
                                }}
                            >
                                <div>
                                    <div style={{ fontWeight: 600, color: '#334155' }}>{item.title}</div>
                                    <div style={{ fontSize: '0.85em', color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <Calendar size={14} />
                                        {new Date(item.created_at).toLocaleDateString()}
                                    </div>
                                </div>
                                <button 
                                    className="btn" 
                                    style={{ padding: '6px 12px', fontSize: '0.85em', background: '#fff', border: '1px solid #cbd5e1', color: '#0f172a', display: 'flex', gap: 6, alignItems: 'center' }}
                                    onClick={() => handleView(item.id)}
                                >
                                    <Eye size={16} /> Ver
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </Modal>
    )
}
