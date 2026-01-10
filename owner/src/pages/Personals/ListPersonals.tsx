import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { Link } from 'react-router-dom'

type Personal = {
    id: string
    name: string
    email: string
    phone?: string
    status: 'active' | 'inactive' | 'blocked'
    logoUrl?: string
    brandName?: string
    createdAt: string
    studentCount: number
}

export default function ListPersonals() {
    const [personals, setPersonals] = useState<Personal[]>([])
    const [loading, setLoading] = useState(true)
    const [q, setQ] = useState('')

    useEffect(() => {
        async function load() {
            setLoading(true)
            
            // Buscar Personais
            const { data: profiles, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('role', 'personal')
                .order('created_at', { ascending: false })

            if (error) {
                console.error('Erro ao listar personais:', error)
                setLoading(false)
                return
            }

            // Para cada personal, contar alunos (opcional, mas legal)
            // Como owner pode ver tudo, podemos fazer um count
            // Mas para performance, talvez fazer depois. Vou fazer simples agora.
            
            const formatted: Personal[] = profiles.map((p: any) => ({
                id: p.id,
                name: p.full_name || 'Sem nome',
                email: p.email || p.data?.email || '',
                phone: p.data?.phone || '',
                status: p.data?.status || 'active',
                logoUrl: p.data?.branding?.logoUrl,
                brandName: p.data?.branding?.brandName,
                createdAt: p.created_at,
                studentCount: 0 // Placeholder por enquanto
            }))

            setPersonals(formatted)
            setLoading(false)
        }
        load()
    }, [])

    const filtered = useMemo(() => {
        const term = q.trim().toLowerCase()
        if (!term) return personals
        return personals.filter(p => 
            p.name.toLowerCase().includes(term) || 
            p.email.toLowerCase().includes(term) ||
            p.brandName?.toLowerCase().includes(term)
        )
    }, [q, personals])

    if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Carregando personais...</div>

    return (
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
                <div>
                    <h1 style={{ fontSize: '1.8rem', color: '#0f172a', margin: 0 }}>Personais Parceiros</h1>
                    <p style={{ color: '#64748b', marginTop: 4 }}>Gerencie os profissionais cadastrados na plataforma.</p>
                </div>
                <Link to="/personals/create" className="btn" style={{ background: '#0f172a', color: '#fff', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>➕</span> Novo Personal
                </Link>
            </div>

            {/* Barra de Busca */}
            <div style={{ background: '#fff', padding: 16, borderRadius: 12, boxShadow: '0 2px 4px rgba(0,0,0,0.05)', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: '1.2rem' }}>🔍</span>
                <input 
                    value={q} 
                    onChange={e => setQ(e.target.value)} 
                    placeholder="Buscar por nome, email ou marca..." 
                    style={{ border: 'none', outline: 'none', fontSize: '1rem', flex: 1, color: '#0f172a' }}
                />
                <div style={{ fontSize: '0.85rem', color: '#94a3b8', background: '#f1f5f9', padding: '4px 12px', borderRadius: 20 }}>
                    {filtered.length} encontrados
                </div>
            </div>

            {/* Grid de Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 24 }}>
                {filtered.map(p => (
                    <div key={p.id} style={{ 
                        background: '#fff', 
                        borderRadius: 16, 
                        border: '1px solid #e2e8f0',
                        overflow: 'hidden',
                        transition: 'transform 0.2s, box-shadow 0.2s',
                        position: 'relative'
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
                        {/* Header do Card */}
                        <div style={{ padding: 24, display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                            <div style={{ 
                                width: 64, height: 64, borderRadius: 12, background: '#f8fafc', 
                                border: '1px solid #f1f5f9', overflow: 'hidden', flexShrink: 0,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem'
                            }}>
                                {p.logoUrl ? (
                                    <img src={p.logoUrl} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    <span>👤</span>
                                )}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={p.name}>
                                        {p.name}
                                    </h3>
                                    <span style={{ 
                                        fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase',
                                        padding: '2px 8px', borderRadius: 4,
                                        background: p.status === 'active' ? '#dcfce7' : '#fee2e2',
                                        color: p.status === 'active' ? '#166534' : '#991b1b'
                                    }}>
                                        {p.status === 'active' ? 'Ativo' : 'Inativo'}
                                    </span>
                                </div>
                                <div style={{ fontSize: '0.9rem', color: '#64748b', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={p.email}>
                                    {p.email}
                                </div>
                                {p.brandName && (
                                    <div style={{ fontSize: '0.8rem', color: '#3b82f6', marginTop: 4, fontWeight: 500 }}>
                                        {p.brandName}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Divider */}
                        <div style={{ height: 1, background: '#f1f5f9', margin: '0 24px' }} />

                        {/* Info Extra */}
                        <div style={{ padding: '16px 24px', display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#64748b' }}>
                            <div>
                                📅 Desde {new Date(p.createdAt).toLocaleDateString()}
                            </div>
                        </div>

                        {/* Ações */}
                        <div style={{ background: '#f8fafc', padding: '12px 24px', display: 'flex', gap: 8 }}>
                            <Link to={`/personals/students?id=${p.id}`} style={{ 
                                flex: 1, textAlign: 'center', padding: '8px', borderRadius: 6,
                                background: '#fff', border: '1px solid #cbd5e1', color: '#475569',
                                textDecoration: 'none', fontSize: '0.9rem', fontWeight: 500
                            }}>
                                👥 Alunos
                            </Link>
                            <Link to={`/personals/edit?id=${p.id}`} style={{ 
                                flex: 1, textAlign: 'center', padding: '8px', borderRadius: 6,
                                background: '#0f172a', border: '1px solid #0f172a', color: '#fff',
                                textDecoration: 'none', fontSize: '0.9rem', fontWeight: 500
                            }}>
                                ✏️ Editar
                            </Link>
                        </div>
                    </div>
                ))}
            </div>

            {filtered.length === 0 && (
                <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
                    Nenhum personal encontrado com esses critérios.
                </div>
            )}
        </div>
    )
}
