import { useEffect, useState, useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

type Personal = {
    id: string
    name: string
    email: string
    logoUrl?: string
}

type Debit = {
    id: string
    description: string
    amount: number
    dueDate: string
    paidAt?: string
    status: 'pending' | 'paid' | 'overdue' | 'canceled'
    type: 'saas' | 'service'
}

export default function FinancialByPersonal() {
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()
    const personalId = searchParams.get('id')

    const [personalsList, setPersonalsList] = useState<Personal[]>([])
    const [personal, setPersonal] = useState<Personal | null>(null)
    const [debits, setDebits] = useState<Debit[]>([])
    
    const [loading, setLoading] = useState(true)
    const [q, setQ] = useState('')

    // Carrega lista de personais se não tiver ID
    useEffect(() => {
        if (!personalId) {
            loadPersonalsList()
        } else {
            loadPersonalFinancials(personalId)
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

    async function loadPersonalFinancials(id: string) {
        setLoading(true)
        
        // 1. Dados do Personal
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

            // 2. Débitos (SaaS) onde o Personal é o PAGADOR (payer_id)
            // Assumindo que o Owner é quem vê isso, então receiver_id seria o Owner ou null/sistema
            // Vamos filtrar por type='saas' e payer_id=personalId
            const { data: dData, error } = await supabase
                .from('debits')
                .select('*')
                .eq('payer_id', id)
                .eq('type', 'saas')
                .order('due_date', { ascending: false })

            if (dData) {
                setDebits(dData.map((d: any) => ({
                    id: d.id,
                    description: d.description || 'Mensalidade SaaS',
                    amount: Number(d.amount),
                    dueDate: d.due_date,
                    paidAt: d.paid_at,
                    status: d.status,
                    type: d.type
                })))
            }
        }
        setLoading(false)
    }

    const filteredPersonals = personalsList.filter(p => 
        p.name.toLowerCase().includes(q.toLowerCase()) || 
        p.email.toLowerCase().includes(q.toLowerCase())
    )

    // Cálculos do Dashboard
    const totalPaid = debits.filter(d => d.status === 'paid').reduce((acc, curr) => acc + curr.amount, 0)
    const totalPending = debits.filter(d => d.status === 'pending' || d.status === 'overdue').reduce((acc, curr) => acc + curr.amount, 0)

    if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Carregando...</div>

    // MODO SELEÇÃO: Grid de Personais
    if (!personalId) {
        return (
            <div style={{ maxWidth: 1000, margin: '0 auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                    <div>
                        <h1 style={{ fontSize: '1.8rem', color: '#0f172a', margin: 0 }}>Financeiro por Personal</h1>
                        <p style={{ color: '#64748b', marginTop: 4 }}>Selecione um personal para ver o histórico de pagamentos.</p>
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

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                    {filteredPersonals.map(p => (
                        <div 
                            key={p.id}
                            onClick={() => navigate(`/billing/by-personal?id=${p.id}`)}
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

    // MODO DETALHE: Financeiro do Personal Selecionado
    return (
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            <div style={{ marginBottom: 32 }}>
                <button 
                    onClick={() => navigate('/billing/by-personal')}
                    style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8 }}
                >
                    ← Escolher outro personal
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 64, height: 64, borderRadius: 16, background: '#fff', border: '1px solid #e2e8f0', overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        {personal?.logoUrl ? <img src={personal.logoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '1.5rem' }}>👤</span>}
                    </div>
                    <div>
                        <h1 style={{ fontSize: '1.8rem', color: '#0f172a', margin: 0 }}>Financeiro: {personal?.name}</h1>
                        <p style={{ color: '#64748b', margin: '4px 0 0 0' }}>Histórico de pagamentos da mensalidade (SaaS)</p>
                    </div>
                </div>
            </div>

            {/* Cards de Resumo */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24, marginBottom: 32 }}>
                <div style={{ background: '#fff', padding: 24, borderRadius: 16, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: 8 }}>Total Pago (Histórico)</div>
                    <div style={{ fontSize: '2rem', fontWeight: 700, color: '#16a34a' }}>R$ {totalPaid.toFixed(2)}</div>
                </div>
                <div style={{ background: '#fff', padding: 24, borderRadius: 16, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: 8 }}>Em Aberto / Vencido</div>
                    <div style={{ fontSize: '2rem', fontWeight: 700, color: totalPending > 0 ? '#dc2626' : '#94a3b8' }}>R$ {totalPending.toFixed(2)}</div>
                </div>
                <div style={{ background: '#fff', padding: 24, borderRadius: 16, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <button style={{ 
                        background: '#0f172a', color: '#fff', padding: '12px 24px', borderRadius: 8, border: 'none', 
                        fontSize: '1rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 
                    }}>
                        ➕ Nova Cobrança
                    </button>
                </div>
            </div>

            {/* Tabela de Transações */}
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                <div style={{ padding: 24, borderBottom: '1px solid #f1f5f9', fontWeight: 600, color: '#0f172a' }}>
                    Histórico de Transações
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
                        <thead style={{ background: '#f8fafc' }}>
                            <tr>
                                <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '0.85rem', color: '#64748b' }}>DESCRIÇÃO</th>
                                <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '0.85rem', color: '#64748b' }}>VENCIMENTO</th>
                                <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '0.85rem', color: '#64748b' }}>VALOR</th>
                                <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '0.85rem', color: '#64748b' }}>STATUS</th>
                                <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '0.85rem', color: '#64748b' }}>PAGO EM</th>
                                <th style={{ padding: '16px 24px', textAlign: 'right', fontSize: '0.85rem', color: '#64748b' }}>AÇÕES</th>
                            </tr>
                        </thead>
                        <tbody>
                            {debits.map(d => (
                                <tr key={d.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={{ padding: '16px 24px', fontWeight: 500, color: '#0f172a' }}>{d.description}</td>
                                    <td style={{ padding: '16px 24px', color: '#475569' }}>{new Date(d.dueDate).toLocaleDateString()}</td>
                                    <td style={{ padding: '16px 24px', fontWeight: 600, color: '#0f172a' }}>R$ {d.amount.toFixed(2)}</td>
                                    <td style={{ padding: '16px 24px' }}>
                                        <span style={{ 
                                            padding: '4px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase',
                                            background: d.status === 'paid' ? '#dcfce7' : d.status === 'overdue' ? '#fee2e2' : '#f1f5f9',
                                            color: d.status === 'paid' ? '#166534' : d.status === 'overdue' ? '#991b1b' : '#475569'
                                        }}>
                                            {d.status === 'paid' ? 'Pago' : d.status === 'overdue' ? 'Vencido' : d.status === 'pending' ? 'Pendente' : d.status}
                                        </span>
                                    </td>
                                    <td style={{ padding: '16px 24px', color: '#64748b', fontSize: '0.9rem' }}>
                                        {d.paidAt ? new Date(d.paidAt).toLocaleDateString() : '-'}
                                    </td>
                                    <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                                        <button className="btn-icon" style={{ background: 'transparent', border: '1px solid #e2e8f0', padding: 6, borderRadius: 6, cursor: 'pointer' }}>👁️</button>
                                    </td>
                                </tr>
                            ))}
                            {debits.length === 0 && (
                                <tr>
                                    <td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
                                        Nenhum registro financeiro encontrado para este personal.
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
