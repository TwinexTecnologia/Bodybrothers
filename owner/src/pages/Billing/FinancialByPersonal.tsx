import { useEffect, useState, useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

type Personal = {
    id: string
    name: string
    email: string
    logoUrl?: string
    planSlug?: string
    billingCycle?: string
    subscriptionStatus?: string
    billingModel?: string
    isPermuta?: boolean
    studentLimit?: number | null
    activeStudents?: number
    nextBillingAt?: string | null
}

type Payment = {
    id: string
    description: string
    amount: number
    dueAt?: string
    paidAt?: string
    status: 'pending' | 'approved' | 'failed' | 'canceled' | 'refunded'
    provider?: string
}

const PLAN_LABELS: Record<string, string> = {
    free: 'Free',
    starter: 'Starter',
    premium: 'Premium',
    pro: 'Pro',
    elite: 'Elite',
    unlimited: 'Ilimitado',
}

const STATUS_LABELS: Record<string, string> = {
    free: 'Free',
    active: 'Ativo',
    pending_payment: 'Aguardando pagamento',
    past_due: 'Em atraso',
    blocked: 'Bloqueado',
    canceled: 'Cancelado',
}

const BILLING_CYCLE_LABELS: Record<string, string> = {
    monthly: 'Mensal',
    quarterly: 'Trimestral',
    yearly: 'Anual',
}

export default function FinancialByPersonal() {
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()
    const personalId = searchParams.get('id')

    const [personalsList, setPersonalsList] = useState<Personal[]>([])
    const [personal, setPersonal] = useState<Personal | null>(null)
    const [payments, setPayments] = useState<Payment[]>([])
    
    const [loading, setLoading] = useState(true)
    const [actionLoading, setActionLoading] = useState(false)
    const [feedback, setFeedback] = useState('')
    const [actionError, setActionError] = useState('')
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
        const [{ data: profiles }, { data: subscriptions }, { data: students }] = await Promise.all([
            supabase
                .from('profiles')
                .select('id, full_name, email, data')
                .eq('role', 'personal')
                .order('full_name'),
            supabase
                .from('personal_subscriptions')
                .select('personal_id, plan_slug, billing_cycle, status, student_limit, next_billing_at'),
            supabase
                .from('profiles')
                .select('personal_id, data')
                .eq('role', 'aluno')
        ])

        const subscriptionMap = new Map((subscriptions || []).map((subscription: any) => [subscription.personal_id, subscription]))
        const activeStudentsMap = new Map<string, number>()

        ;(students || []).forEach((student: any) => {
            const key = student.personal_id
            if (!key) return
            const status = student?.data?.status || 'ativo'
            if (status === 'inativo') return
            activeStudentsMap.set(key, (activeStudentsMap.get(key) || 0) + 1)
        })

        if (profiles) {
            setPersonalsList(profiles.map((p: any) => {
                const subscription = subscriptionMap.get(p.id)
                return {
                    id: p.id,
                    name: p.full_name || 'Sem nome',
                    email: p.email || '',
                    logoUrl: p.data?.branding?.logoUrl,
                    planSlug: subscription?.plan_slug || p.data?.saas?.plan || 'free',
                    billingCycle: subscription?.billing_cycle || p.data?.saas?.billingCycle || 'monthly',
                    subscriptionStatus: subscription?.status || p.data?.saas?.subscriptionStatus || 'free',
                    billingModel: p.data?.saas?.billingModel || 'normal',
                    isPermuta: Boolean(p.data?.saas?.isPermuta) || p.data?.saas?.billingModel === 'permuta',
                    studentLimit: subscription?.student_limit ?? p.data?.saas?.studentLimit ?? 1,
                    activeStudents: activeStudentsMap.get(p.id) || 0,
                    nextBillingAt: subscription?.next_billing_at || p.data?.saas?.nextBillingAt || null,
                }
            }))
        }
        setLoading(false)
    }

    async function loadPersonalFinancials(id: string) {
        setLoading(true)
        
        const [{ data: pData }, { data: subscription }, { data: students }, { data: paymentData }] = await Promise.all([
            supabase
                .from('profiles')
                .select('*')
                .eq('id', id)
                .single(),
            supabase
                .from('personal_subscriptions')
                .select('*')
                .eq('personal_id', id)
                .maybeSingle(),
            supabase
                .from('profiles')
                .select('id, data')
                .eq('personal_id', id)
                .eq('role', 'aluno'),
            supabase
                .from('subscription_payments')
                .select('*')
                .eq('personal_id', id)
                .order('created_at', { ascending: false })
                .limit(20)
        ])
        
        if (pData) {
            const activeStudents = (students || []).filter((student: any) => (student?.data?.status || 'ativo') !== 'inativo').length
            setPersonal({
                id: pData.id,
                name: pData.full_name || 'Sem nome',
                email: pData.email || '',
                logoUrl: pData.data?.branding?.logoUrl,
                planSlug: subscription?.plan_slug || pData.data?.saas?.plan || 'free',
                billingCycle: subscription?.billing_cycle || pData.data?.saas?.billingCycle || 'monthly',
                subscriptionStatus: subscription?.status || pData.data?.saas?.subscriptionStatus || 'free',
                billingModel: pData.data?.saas?.billingModel || 'normal',
                isPermuta: Boolean(pData.data?.saas?.isPermuta) || pData.data?.saas?.billingModel === 'permuta',
                studentLimit: subscription?.student_limit ?? pData.data?.saas?.studentLimit ?? 1,
                activeStudents,
                nextBillingAt: subscription?.next_billing_at || pData.data?.saas?.nextBillingAt || null,
            })

            if (paymentData) {
                setPayments(paymentData.map((payment: any) => ({
                    id: payment.id,
                    description: payment.description || 'Cobrança SaaS',
                    amount: Number(payment.amount || 0),
                    dueAt: payment.due_at,
                    paidAt: payment.paid_at,
                    status: payment.status,
                    provider: payment.provider,
                })))
            }
        }
        setLoading(false)
    }

    async function handleRemovePermuta() {
        if (!personalId || !personal?.isPermuta) return

        const confirmed = window.confirm('Deseja remover a permuta deste personal? Ele ficará bloqueado até regularizar o pagamento no próprio painel.')
        if (!confirmed) return

        setActionLoading(true)
        setFeedback('')
        setActionError('')

        try {
            const { data, error } = await supabase.functions.invoke('manage-personal-subscription', {
                body: {
                    action: 'remove_permuta',
                    personalId,
                },
            })

            if (error) throw error
            if (!data?.success) {
                throw new Error(data?.error || 'Não foi possível remover a permuta.')
            }

            setFeedback('Permuta removida com sucesso. O personal agora precisa regularizar o pagamento no próprio painel.')
            await loadPersonalFinancials(personalId)
        } catch (err: any) {
            console.error(err)
            let message = err?.message || 'Não foi possível remover a permuta.'
            if (err?.context && typeof err.context.json === 'function') {
                const payload = await err.context.json().catch(() => null)
                message = payload?.error || payload?.message || message
            }
            setActionError(message)
        } finally {
            setActionLoading(false)
        }
    }

    const filteredPersonals = personalsList.filter(p => 
        p.name.toLowerCase().includes(q.toLowerCase()) || 
        p.email.toLowerCase().includes(q.toLowerCase())
    )

    // Cálculos do Dashboard
    const totals = useMemo(() => ({
        active: personalsList.filter(p => p.subscriptionStatus === 'active').length,
        pastDue: personalsList.filter(p => p.subscriptionStatus === 'past_due').length,
        blocked: personalsList.filter(p => p.subscriptionStatus === 'blocked').length,
        free: personalsList.filter(p => (p.subscriptionStatus || 'free') === 'free').length,
    }), [personalsList])

    const totalPaid = payments.filter(d => d.status === 'approved').reduce((acc, curr) => acc + curr.amount, 0)
    const totalPending = payments.filter(d => d.status === 'pending' || d.status === 'failed').reduce((acc, curr) => acc + curr.amount, 0)

    if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Carregando...</div>

    // MODO SELEÇÃO: Grid de Personais
    if (!personalId) {
        return (
            <div style={{ maxWidth: 1200, margin: '0 auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                    <div>
                        <h1 style={{ fontSize: '1.8rem', color: '#0f172a', margin: 0 }}>Cobrança dos Personais</h1>
                        <p style={{ color: '#64748b', marginTop: 4 }}>Monitore plano, status da assinatura e próxima cobrança de cada personal.</p>
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

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
                    <SummaryCard title="Ativos" value={String(totals.active)} color="#166534" background="#dcfce7" />
                    <SummaryCard title="Em atraso" value={String(totals.pastDue)} color="#9a3412" background="#ffedd5" />
                    <SummaryCard title="Bloqueados" value={String(totals.blocked)} color="#991b1b" background="#fee2e2" />
                    <SummaryCard title="Free" value={String(totals.free)} color="#1d4ed8" background="#dbeafe" />
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
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 600, color: '#0f172a' }}>{p.name}</div>
                                <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{p.email}</div>
                                <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                    <Tag>{PLAN_LABELS[p.planSlug || 'free'] || 'Free'}</Tag>
                                    <Tag>{BILLING_CYCLE_LABELS[p.billingCycle || 'monthly'] || 'Mensal'}</Tag>
                                    <Tag tone={getStatusTone(p.subscriptionStatus)}>{STATUS_LABELS[p.subscriptionStatus || 'free'] || 'Free'}</Tag>
                                    {p.isPermuta && <Tag tone="success">Permuta</Tag>}
                                </div>
                                <div style={{ marginTop: 10, fontSize: '0.8rem', color: '#64748b' }}>
                                    {p.activeStudents || 0} ativos / {p.studentLimit ?? 1} no plano
                                </div>
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
                        <p style={{ color: '#64748b', margin: '4px 0 0 0' }}>Monitoramento da assinatura SaaS e histórico de cobranças.</p>
                    </div>
                </div>
            </div>

            {personal?.isPermuta && (
                <div style={{ background: '#ecfdf5', border: '1px solid #bbf7d0', borderRadius: 16, padding: 20, marginBottom: 24, display: 'grid', gap: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <div>
                            <div style={{ fontSize: '1rem', fontWeight: 700, color: '#166534' }}>Permuta ativa</div>
                            <div style={{ fontSize: '0.92rem', color: '#166534', marginTop: 4 }}>
                                Este personal está usando o plano {PLAN_LABELS[personal.planSlug || 'free'] || 'Free'} sem cobrança automática.
                            </div>
                        </div>
                        <button
                            onClick={handleRemovePermuta}
                            disabled={actionLoading}
                            style={{
                                background: '#166534',
                                color: '#fff',
                                border: 'none',
                                borderRadius: 10,
                                padding: '12px 16px',
                                fontWeight: 700,
                                cursor: actionLoading ? 'not-allowed' : 'pointer',
                                opacity: actionLoading ? 0.7 : 1,
                            }}
                        >
                            {actionLoading ? 'Removendo permuta...' : 'Remover permuta'}
                        </button>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#166534' }}>
                        Ao remover a permuta, o personal ficará bloqueado e precisará regularizar o pagamento no próprio painel escolhendo método e seguindo a assinatura normalmente.
                    </div>
                </div>
            )}

            {actionError && (
                <div style={{ background: '#fef2f2', color: '#b91c1c', padding: 14, borderRadius: 12, marginBottom: 24 }}>
                    {actionError}
                </div>
            )}

            {feedback && (
                <div style={{ background: '#dcfce7', color: '#166534', padding: 14, borderRadius: 12, marginBottom: 24 }}>
                    {feedback}
                </div>
            )}

            {/* Cards de Resumo */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24, marginBottom: 32 }}>
                <div style={{ background: '#fff', padding: 24, borderRadius: 16, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: 8 }}>Plano atual</div>
                    <div style={{ fontSize: '2rem', fontWeight: 700, color: '#0f172a' }}>{PLAN_LABELS[personal?.planSlug || 'free'] || 'Free'}</div>
                    {personal?.isPermuta && (
                        <div style={{ marginTop: 12 }}>
                            <Tag tone="success">Permuta</Tag>
                        </div>
                    )}
                </div>
                <div style={{ background: '#fff', padding: 24, borderRadius: 16, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: 8 }}>Status da assinatura</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 700, color: getStatusColor(personal?.subscriptionStatus) }}>{STATUS_LABELS[personal?.subscriptionStatus || 'free'] || 'Free'}</div>
                </div>
                <div style={{ background: '#fff', padding: 24, borderRadius: 16, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: 8 }}>Alunos ativos</div>
                    <div style={{ fontSize: '2rem', fontWeight: 700, color: '#0f172a' }}>{personal?.activeStudents || 0} / {personal?.studentLimit ?? 1}</div>
                </div>
                <div style={{ background: '#fff', padding: 24, borderRadius: 16, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: 8 }}>Próxima cobrança</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0f172a' }}>{personal?.nextBillingAt ? new Date(personal.nextBillingAt).toLocaleDateString() : '-'}</div>
                </div>
                <div style={{ background: '#fff', padding: 24, borderRadius: 16, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: 8 }}>Total Pago (Histórico)</div>
                    <div style={{ fontSize: '2rem', fontWeight: 700, color: '#16a34a' }}>R$ {totalPaid.toFixed(2)}</div>
                </div>
                <div style={{ background: '#fff', padding: 24, borderRadius: 16, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: 8 }}>Pendentes / Falhas</div>
                    <div style={{ fontSize: '2rem', fontWeight: 700, color: totalPending > 0 ? '#dc2626' : '#94a3b8' }}>R$ {totalPending.toFixed(2)}</div>
                </div>
            </div>

            {/* Tabela de Transações */}
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                <div style={{ padding: 24, borderBottom: '1px solid #f1f5f9', fontWeight: 600, color: '#0f172a' }}>
                    Histórico de Cobranças
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
                                <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '0.85rem', color: '#64748b' }}>PROVEDOR</th>
                            </tr>
                        </thead>
                        <tbody>
                            {payments.map(d => (
                                <tr key={d.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={{ padding: '16px 24px', fontWeight: 500, color: '#0f172a' }}>{d.description}</td>
                                    <td style={{ padding: '16px 24px', color: '#475569' }}>{d.dueAt ? new Date(d.dueAt).toLocaleDateString() : '-'}</td>
                                    <td style={{ padding: '16px 24px', fontWeight: 600, color: '#0f172a' }}>R$ {d.amount.toFixed(2)}</td>
                                    <td style={{ padding: '16px 24px' }}>
                                        <span style={{ 
                                            padding: '4px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase',
                                            background: getPaymentToneBackground(d.status),
                                            color: getPaymentToneColor(d.status)
                                        }}>
                                            {getPaymentStatusLabel(d.status)}
                                        </span>
                                    </td>
                                    <td style={{ padding: '16px 24px', color: '#64748b', fontSize: '0.9rem' }}>
                                        {d.paidAt ? new Date(d.paidAt).toLocaleDateString() : '-'}
                                    </td>
                                    <td style={{ padding: '16px 24px', color: '#64748b' }}>{d.provider || '-'}</td>
                                </tr>
                            ))}
                            {payments.length === 0 && (
                                <tr>
                                    <td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
                                        Nenhuma cobrança registrada ainda para este personal.
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

function SummaryCard({ title, value, color, background }: { title: string; value: string; color: string; background: string }) {
    return (
        <div style={{ background, border: `1px solid ${background}`, padding: 20, borderRadius: 16 }}>
            <div style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: 8 }}>{title}</div>
            <div style={{ fontSize: '2rem', fontWeight: 700, color }}>{value}</div>
        </div>
    )
}

function Tag({ children, tone = 'default' }: { children: React.ReactNode; tone?: 'default' | 'warning' | 'danger' | 'success' }) {
    const palette = tone === 'danger'
        ? { background: '#fee2e2', color: '#991b1b' }
        : tone === 'warning'
            ? { background: '#ffedd5', color: '#9a3412' }
            : tone === 'success'
                ? { background: '#dcfce7', color: '#166534' }
                : { background: '#e2e8f0', color: '#334155' }

    return <span style={{ padding: '4px 8px', borderRadius: 999, fontSize: '0.75rem', fontWeight: 700, background: palette.background, color: palette.color }}>{children}</span>
}

function getStatusTone(status?: string | null): 'default' | 'warning' | 'danger' | 'success' {
    if (status === 'blocked') return 'danger'
    if (status === 'past_due') return 'warning'
    if (status === 'active') return 'success'
    return 'default'
}

function getStatusColor(status?: string | null) {
    if (status === 'blocked') return '#991b1b'
    if (status === 'past_due') return '#9a3412'
    if (status === 'active') return '#166534'
    return '#0f172a'
}

function getPaymentStatusLabel(status: Payment['status']) {
    if (status === 'approved') return 'Pago'
    if (status === 'failed') return 'Falhou'
    if (status === 'pending') return 'Pendente'
    if (status === 'canceled') return 'Cancelado'
    if (status === 'refunded') return 'Estornado'
    return status
}

function getPaymentToneBackground(status: Payment['status']) {
    if (status === 'approved') return '#dcfce7'
    if (status === 'failed') return '#fee2e2'
    if (status === 'pending') return '#fef3c7'
    return '#f1f5f9'
}

function getPaymentToneColor(status: Payment['status']) {
    if (status === 'approved') return '#166534'
    if (status === 'failed') return '#991b1b'
    if (status === 'pending') return '#92400e'
    return '#475569'
}
