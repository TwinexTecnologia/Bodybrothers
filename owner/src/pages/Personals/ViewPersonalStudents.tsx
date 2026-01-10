import { useEffect, useState, useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

type Student = {
    id: string
    name: string
    email: string
    status: 'ativo' | 'inativo'
    createdAt: string
    lastAccess?: string
    planName?: string
}

type Personal = {
    id: string
    name: string
    email: string
    logoUrl?: string
}

export default function ViewPersonalStudents() {
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()
    const personalId = searchParams.get('id')

    const [personal, setPersonal] = useState<Personal | null>(null)
    const [students, setStudents] = useState<Student[]>([])
    const [personalsList, setPersonalsList] = useState<Personal[]>([]) // Para o seletor caso não venha ID
    
    const [loading, setLoading] = useState(true)
    const [q, setQ] = useState('')

    // Se não tiver ID, carrega lista de personais para escolher
    useEffect(() => {
        if (!personalId) {
            loadPersonalsList()
        } else {
            loadPersonalData(personalId)
        }
    }, [personalId])

    async function loadPersonalsList() {
        setLoading(true)
        const { data } = await supabase
            .from('profiles')
            .select('id, full_name, email, data')
            .eq('role', 'personal')
            .order('full_name')
        
        if (data) {
            setPersonalsList(data.map((p: any) => ({
                id: p.id,
                name: p.full_name || 'Sem nome',
                email: p.email || '',
                logoUrl: p.data?.branding?.logoUrl
            })))
        }
        setLoading(false)
    }

    async function loadPersonalData(id: string) {
        setLoading(true)
        
        // 1. Carrega dados do Personal
        const { data: pData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', id)
            .single()
        
        if (pData) {
            setPersonal({
                id: pData.id,
                name: pData.full_name || 'Sem nome',
                email: pData.email || '',
                logoUrl: pData.data?.branding?.logoUrl
            })

            // 2. Carrega alunos desse personal
            // Precisamos garantir que o Owner tenha permissão de ver profiles com role='aluno' e personal_id=id
            const { data: sData } = await supabase
                .from('profiles')
                .select('*')
                .eq('role', 'aluno')
                .eq('personal_id', id)
                .order('full_name')

            if (sData) {
                setStudents(sData.map((s: any) => ({
                    id: s.id,
                    name: s.full_name || 'Sem nome',
                    email: s.email || s.data?.email || '',
                    status: s.data?.status || 'ativo',
                    createdAt: s.created_at,
                    lastAccess: s.last_login_at,
                    planName: 'Plano Padrão' // Futuramente buscar da tabela plans
                })))
            }
        }
        setLoading(false)
    }

    const filtered = useMemo(() => {
        const term = q.trim().toLowerCase()
        if (!term) return students
        return students.filter(s => 
            s.name.toLowerCase().includes(term) || 
            s.email.toLowerCase().includes(term)
        )
    }, [q, students])

    if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Carregando...</div>

    // MODO SELEÇÃO: Se não tem personal selecionado
    if (!personalId) {
        return (
            <div style={{ maxWidth: 1000, margin: '0 auto' }}>
                <h1 style={{ fontSize: '1.8rem', color: '#0f172a', marginBottom: 24 }}>Selecione um Personal</h1>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                    {personalsList.map(p => (
                        <div 
                            key={p.id}
                            onClick={() => navigate(`/personals/students?id=${p.id}`)}
                            style={{ 
                                background: '#fff', padding: 20, borderRadius: 12, 
                                border: '1px solid #e2e8f0', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: 16,
                                transition: 'transform 0.2s, box-shadow 0.2s'
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.transform = 'translateY(-2px)'
                                e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.transform = 'translateY(0)'
                                e.currentTarget.style.boxShadow = 'none'
                            }}
                        >
                            <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#f1f5f9', overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                {p.logoUrl ? <img src={p.logoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '👤'}
                            </div>
                            <div>
                                <div style={{ fontWeight: 600, color: '#0f172a' }}>{p.name}</div>
                                <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{p.email}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            <div style={{ marginBottom: 32 }}>
                <button 
                    onClick={() => navigate('/personals/list')}
                    style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8 }}
                >
                    ← Voltar para lista
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 64, height: 64, borderRadius: 16, background: '#fff', border: '1px solid #e2e8f0', overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        {personal?.logoUrl ? <img src={personal.logoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '1.5rem' }}>👤</span>}
                    </div>
                    <div>
                        <h1 style={{ fontSize: '1.8rem', color: '#0f172a', margin: 0 }}>Alunos de {personal?.name}</h1>
                        <p style={{ color: '#64748b', margin: '4px 0 0 0' }}>{students.length} alunos cadastrados</p>
                    </div>
                </div>
            </div>

            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                {/* Header da Tabela / Busca */}
                <div style={{ padding: 24, borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
                    <div style={{ position: 'relative', flex: 1, minWidth: 280 }}>
                        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}>🔍</span>
                        <input 
                            value={q} 
                            onChange={e => setQ(e.target.value)} 
                            placeholder="Buscar aluno por nome ou email..." 
                            style={{ 
                                width: '100%', padding: '10px 12px 10px 40px', borderRadius: 8, 
                                border: '1px solid #cbd5e1', outline: 'none', boxSizing: 'border-box'
                            }}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        {/* Filtros ou Ações em lote futuras */}
                    </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
                        <thead style={{ background: '#f8fafc' }}>
                            <tr>
                                <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>ALUNO</th>
                                <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>STATUS</th>
                                <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>CADASTRO</th>
                                <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>ÚLTIMO ACESSO</th>
                                <th style={{ padding: '16px 24px', textAlign: 'right', fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>AÇÕES</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(s => (
                                <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={{ padding: '16px 24px' }}>
                                        <div style={{ fontWeight: 600, color: '#0f172a' }}>{s.name}</div>
                                        <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{s.email}</div>
                                    </td>
                                    <td style={{ padding: '16px 24px' }}>
                                        <span style={{ 
                                            padding: '4px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase',
                                            background: s.status === 'ativo' ? '#dcfce7' : '#fee2e2',
                                            color: s.status === 'ativo' ? '#166534' : '#991b1b'
                                        }}>
                                            {s.status}
                                        </span>
                                    </td>
                                    <td style={{ padding: '16px 24px', color: '#475569', fontSize: '0.9rem' }}>
                                        {new Date(s.createdAt).toLocaleDateString()}
                                    </td>
                                    <td style={{ padding: '16px 24px', color: '#475569', fontSize: '0.9rem' }}>
                                        {s.lastAccess ? new Date(s.lastAccess).toLocaleDateString() + ' ' + new Date(s.lastAccess).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                                    </td>
                                    <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                                        <button 
                                            className="btn-icon" 
                                            style={{ background: 'transparent', border: '1px solid #e2e8f0', padding: 8, borderRadius: 6, cursor: 'pointer', color: '#64748b' }}
                                            title="Detalhes"
                                        >
                                            👁️
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan={5} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
                                        Nenhum aluno encontrado.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
