import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Camera, Search, User } from 'lucide-react'

export default function EvolutionCentral() {
    const navigate = useNavigate()
    const [students, setStudents] = useState<any[]>([])
    const [searchTerm, setSearchTerm] = useState('')
    const [loading, setLoading] = useState(true)

    // Configuração de Evolução
    const [evolutionMode, setEvolutionMode] = useState('anamnesis') // 'anamnesis' | 'standalone'
    const [evolutionFields, setEvolutionFields] = useState<any[]>([]) 
    const [personalId, setPersonalId] = useState('')

    useEffect(() => {
        loadStudents()
        loadPersonalConfig()
    }, [])

    async function loadPersonalConfig() {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        setPersonalId(user.id)

        const { data: profile } = await supabase
            .from('profiles')
            .select('data')
            .eq('id', user.id)
            .single()

        if (profile) {
            setEvolutionMode(profile.data?.config?.evolutionMode || 'anamnesis')
            setEvolutionFields(profile.data?.config?.evolutionFields || [])
        }
    }

    async function loadStudents() {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data, error } = await supabase
            .from('profiles')
            .select('id, full_name, data')
            .eq('personal_id', user.id)
            .eq('role', 'aluno')
            .order('full_name')

        if (data) {
            setStudents(data.map(s => ({
                id: s.id,
                name: s.full_name,
                status: s.data?.status || 'ativo',
                lastPhoto: s.data?.lastPhotoDate || null
            })))
        }
        setLoading(false)
    }

    const filteredStudents = students.filter(s => 
        s.name.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
            <header style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ fontSize: 24, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 12 }}>
                        <Camera size={28} /> Central de Evolução
                    </h1>
                    <p style={{ color: '#64748b', margin: 0 }}>Selecione um aluno para gerenciar ou adicionar novas fotos.</p>
                </div>
                <button 
                    onClick={() => navigate('/account/profile')}
                    style={{ 
                        background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', 
                        padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontWeight: 600,
                        fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 8
                    }}
                >
                    ⚙️ Configurar
                </button>
            </header>

            {/* Aviso de Configuração */}
            {evolutionMode === 'standalone' && evolutionFields.length === 0 && (
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: 16, marginBottom: 24, color: '#1e40af' }}>
                    <strong>Dica:</strong> Você ativou o modo de fotos avulsas, mas não definiu campos personalizados (ex: Frente, Costas). 
                    <button onClick={() => navigate('/account/profile')} style={{ background: 'none', border: 'none', color: '#2563eb', textDecoration: 'underline', cursor: 'pointer', fontWeight: 600, marginLeft: 4 }}>
                        Configurar agora
                    </button>
                </div>
            )}

            <div style={{ marginBottom: 24, position: 'relative' }}>
                <Search size={20} style={{ position: 'absolute', left: 12, top: 12, color: '#94a3b8' }} />
                <input 
                    type="text" 
                    placeholder="Buscar aluno..." 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    style={{ 
                        width: '100%', padding: '12px 12px 12px 40px', borderRadius: 8, 
                        border: '1px solid #cbd5e1', fontSize: 16 
                    }}
                />
            </div>

            {loading ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Carregando alunos...</div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                    {filteredStudents.map(student => (
                        <div 
                            key={student.id}
                            onClick={() => navigate(`/students/evolution/${student.id}`)}
                            style={{ 
                                background: '#fff', padding: 20, borderRadius: 12, 
                                border: '1px solid #e2e8f0', cursor: 'pointer',
                                transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 16,
                                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.borderColor = '#94a3b8'
                                e.currentTarget.style.transform = 'translateY(-2px)'
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.borderColor = '#e2e8f0'
                                e.currentTarget.style.transform = 'translateY(0)'
                            }}
                        >
                            <div style={{ 
                                width: 48, height: 48, borderRadius: '50%', background: '#f1f5f9', 
                                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' 
                            }}>
                                <User size={24} />
                            </div>
                            <div>
                                <div style={{ fontWeight: 600, color: '#334155', fontSize: 16 }}>{student.name}</div>
                                <div style={{ fontSize: 13, color: student.status === 'ativo' ? '#16a34a' : '#94a3b8' }}>
                                    {student.status === 'ativo' ? 'Ativo' : 'Inativo'}
                                </div>
                            </div>
                            <div style={{ marginLeft: 'auto', color: '#cbd5e1' }}>
                                ➜
                            </div>
                        </div>
                    ))}
                    {filteredStudents.length === 0 && (
                        <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 40, color: '#64748b' }}>
                            Nenhum aluno encontrado.
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
