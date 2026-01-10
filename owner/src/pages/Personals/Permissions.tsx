import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import Modal from '../../components/Modal'

type Personal = {
    id: string
    name: string
    email: string
    logoUrl?: string
    permissions: Record<string, boolean>
}

const MODULES = [
    { key: 'dashboard', label: 'Dashboard', desc: 'Visão geral e métricas' },
    { key: 'students', label: 'Gerenciar Alunos', desc: 'Cadastro e gestão de alunos' },
    { key: 'protocols', label: 'Protocolos', desc: 'Treinos, dietas e anamneses' },
    { key: 'finance', label: 'Financeiro', desc: 'Controle de pagamentos' },
    { key: 'chat', label: 'Chat', desc: 'Comunicação com alunos' },
    { key: 'account', label: 'Conta', desc: 'Configurações do perfil' }
]

export default function Permissions() {
    const [personals, setPersonals] = useState<Personal[]>([])
    const [selected, setSelected] = useState<Personal | null>(null)
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [q, setQ] = useState('')

    async function loadPersonals() {
        setLoading(true)
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('role', 'personal')
            .order('full_name')
        
        if (data) {
            setPersonals(data.map((p: any) => ({
                id: p.id,
                name: p.full_name || 'Sem nome',
                email: p.email || p.data?.email || '',
                logoUrl: p.data?.branding?.logoUrl,
                permissions: p.data?.permissions || {}
            })))
        }
        setLoading(false)
    }

    useEffect(() => {
        loadPersonals()
    }, [])

    const handleEdit = (p: Personal) => {
        setSelected({ ...p, permissions: { ...p.permissions } })
        setShowModal(true)
    }

    const togglePermission = (key: string) => {
        if (!selected) return
        setSelected(prev => {
            if (!prev) return null
            const nextPerms = { ...prev.permissions }
            const currentVal = nextPerms[key] !== false 
            nextPerms[key] = !currentVal
            return { ...prev, permissions: nextPerms }
        })
    }

    const savePermissions = async () => {
        if (!selected) return
        
        const { data: currentData } = await supabase
            .from('profiles')
            .select('data')
            .eq('id', selected.id)
            .single()
            
        const newData = {
            ...(currentData?.data || {}),
            permissions: selected.permissions
        }

        const { error } = await supabase
            .from('profiles')
            .update({ data: newData })
            .eq('id', selected.id)

        if (!error) {
            await loadPersonals()
            setShowModal(false)
        } else {
            alert('Erro ao salvar permissões')
        }
    }

    const filtered = personals.filter(p => 
        p.name.toLowerCase().includes(q.toLowerCase()) || 
        p.email.toLowerCase().includes(q.toLowerCase())
    )

    if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Carregando personais...</div>

    return (
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
                <div>
                    <h1 style={{ fontSize: '1.8rem', color: '#0f172a', margin: 0 }}>Permissões de Acesso</h1>
                    <p style={{ color: '#64748b', marginTop: 4 }}>Controle quais funcionalidades cada personal pode utilizar.</p>
                </div>
                <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}>🔍</span>
                    <input 
                        value={q} 
                        onChange={e => setQ(e.target.value)} 
                        placeholder="Buscar personal..." 
                        style={{ padding: '10px 12px 10px 36px', borderRadius: 8, border: '1px solid #cbd5e1', width: 200 }}
                    />
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 24 }}>
                {filtered.map(p => {
                    const activeCount = MODULES.filter(m => p.permissions[m.key] !== false).length
                    const totalCount = MODULES.length
                    
                    return (
                        <div key={p.id} style={{ 
                            background: '#fff', borderRadius: 16, 
                            border: '1px solid #e2e8f0', overflow: 'hidden',
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
                            <div style={{ padding: 24, display: 'flex', alignItems: 'center', gap: 16, borderBottom: '1px solid #f8fafc' }}>
                                <div style={{ width: 56, height: 56, borderRadius: 12, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                    {p.logoUrl ? <img src={p.logoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '👤'}
                                </div>
                                <div>
                                    <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '1.1rem' }}>{p.name}</div>
                                    <div style={{ fontSize: '0.9rem', color: '#64748b' }}>{p.email}</div>
                                </div>
                            </div>

                            <div style={{ padding: 24 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontSize: '0.9rem' }}>
                                    <span style={{ color: '#64748b' }}>Acesso liberado</span>
                                    <span style={{ fontWeight: 600, color: activeCount === totalCount ? '#16a34a' : '#0f172a' }}>
                                        {activeCount} de {totalCount} módulos
                                    </span>
                                </div>
                                
                                {/* Barra de progresso visual */}
                                <div style={{ height: 6, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden', marginBottom: 20 }}>
                                    <div style={{ 
                                        height: '100%', 
                                        width: `${(activeCount / totalCount) * 100}%`, 
                                        background: activeCount === totalCount ? '#22c55e' : '#3b82f6',
                                        borderRadius: 3
                                    }} />
                                </div>

                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, minHeight: 60 }}>
                                    {MODULES.map(m => {
                                        if (p.permissions[m.key] === false) return null
                                        return (
                                            <span key={m.key} style={{ 
                                                fontSize: '0.75rem', background: '#f0f9ff', color: '#0369a1', 
                                                padding: '4px 8px', borderRadius: 6, border: '1px solid #e0f2fe'
                                            }}>
                                                {m.label}
                                            </span>
                                        )
                                    })}
                                    {activeCount === 0 && <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic' }}>Nenhum acesso permitido</span>}
                                </div>
                            </div>

                            <div style={{ padding: '16px 24px', background: '#f8fafc', borderTop: '1px solid #f1f5f9' }}>
                                <button 
                                    onClick={() => handleEdit(p)}
                                    style={{ 
                                        width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #cbd5e1',
                                        background: '#fff', color: '#0f172a', fontWeight: 600, cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                                    }}
                                >
                                    ⚙️ Configurar Acessos
                                </button>
                            </div>
                        </div>
                    )
                })}
            </div>

            <Modal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title={`Permissões: ${selected?.name}`}
                width={600}
                footer={
                    <>
                        <button className="btn" style={{ background: '#fff', border: '1px solid #e2e8f0', color: '#64748b', padding: '10px 20px', borderRadius: 8, cursor: 'pointer' }} onClick={() => setShowModal(false)}>Cancelar</button>
                        <button className="btn" style={{ background: '#0f172a', color: '#fff', padding: '10px 24px', borderRadius: 8, border: 'none', cursor: 'pointer' }} onClick={savePermissions}>Salvar Alterações</button>
                    </>
                }
            >
                {selected && (
                    <div style={{ display: 'grid', gap: 12 }}>
                        {MODULES.map(m => {
                            const isAllowed = selected.permissions[m.key] !== false
                            return (
                                <label key={m.key} style={{ 
                                    display: 'flex', alignItems: 'center', gap: 16, 
                                    padding: 16, border: isAllowed ? '1px solid #3b82f6' : '1px solid #e2e8f0', 
                                    borderRadius: 12, cursor: 'pointer', 
                                    background: isAllowed ? '#eff6ff' : '#fff',
                                    transition: 'all 0.2s'
                                }}>
                                    {/* Toggle Switch Customizado */}
                                    <div style={{ position: 'relative', width: 44, height: 24 }}>
                                        <input 
                                            type="checkbox" 
                                            checked={isAllowed} 
                                            onChange={() => togglePermission(m.key)}
                                            style={{ opacity: 0, width: 0, height: 0 }}
                                        />
                                        <div style={{ 
                                            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, 
                                            background: isAllowed ? '#3b82f6' : '#cbd5e1', borderRadius: 24, transition: '0.2s' 
                                        }} />
                                        <div style={{ 
                                            position: 'absolute', top: 2, left: isAllowed ? 22 : 2, width: 20, height: 20, 
                                            background: '#fff', borderRadius: '50%', transition: '0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' 
                                        }} />
                                    </div>

                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 600, color: '#0f172a' }}>{m.label}</div>
                                        <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{m.desc}</div>
                                    </div>
                                    
                                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: isAllowed ? '#3b82f6' : '#94a3b8' }}>
                                        {isAllowed ? 'ATIVO' : 'BLOQUEADO'}
                                    </div>
                                </label>
                            )
                        })}
                    </div>
                )}
            </Modal>
        </div>
    )
}
