import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/useAuth'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import { ArrowLeft, TrendingUp, Users, Target, History, Clock, Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Modal from '../../components/Modal'

export default function CRMDashboard() {
    const navigate = useNavigate()
    const { user } = useAuth()
    const [loading, setLoading] = useState(true)
    const [filterText, setFilterText] = useState('') // Filtro da tabela
    const [stats, setStats] = useState({
        totalLeads: 0,
        conversionRate: 0,
        byStatus: [] as any[],
        bySource: [] as any[],
        leadsList: [] as any[],
        columnsList: [] as any[]
    })
    
    // Modal Histórico
    const [historyOpen, setHistoryOpen] = useState(false)
    const [selectedLead, setSelectedLead] = useState<any>(null)

    const [debugInfo, setDebugInfo] = useState<any>({})

    useEffect(() => {
        loadStats()
    }, [user])

    const loadStats = async () => {
        try {
            setDebugInfo(prev => ({ ...prev, step: 'Iniciando loadStats', userId: user?.id }))
            
            // 1. Carregar LocalStorage
            let localCols: any[] = []
            let localLeads: any[] = []
            try {
                const savedCols = localStorage.getItem('crm_columns_offline')
                const savedLeads = localStorage.getItem('crm_leads_offline')
                if (savedCols) localCols = JSON.parse(savedCols)
                if (savedLeads) localLeads = JSON.parse(savedLeads)
            } catch (e) { void 0 }

            // 2. Carregar Supabase
            let finalCols = localCols
            let finalLeads = localLeads

            if (user) {
                const { data: cols, error: errCols } = await supabase.from('crm_columns').select('*').eq('user_id', user.id).order('order')
                const { data: leads, error: errLeads } = await supabase.from('crm_leads').select('*').eq('user_id', user.id)
                
                setDebugInfo(prev => ({ 
                    ...prev, 
                    supabaseCols: cols?.length, 
                    supabaseLeads: leads?.length, 
                    errCols, 
                    errLeads,
                    leadsSample: leads ? leads.slice(0, 1) : 'null'
                }))

                if (cols && cols.length > 0) {
                    finalCols = cols.map(c => ({ id: c.id, title: c.title, color: c.color, bg: c.bg_color }))
                }
                
                // Se vier do banco, usa o banco.
                if (leads) { // Mesmo se vier vazio, usa o vazio do banco pois é a verdade
                    finalLeads = leads.map(l => {
                        const statusExists = cols?.some(c => c.id === l.status_column_id)
                        let targetStatus = l.status_column_id

                        if (!statusExists && cols && cols.length > 0) {
                             // Tenta recuperar coluna pelo nome se possível, ou usa a primeira
                             const defaultCol = cols.find(c => c.title.toLowerCase().includes('novos')) || cols[0]
                             targetStatus = defaultCol.id
                        }

                        return {
                            id: l.id,
                            name: l.name,
                            source: l.source || 'Manual',
                            status: targetStatus,
                            createdAt: l.created_at,
                            history: l.history
                        }
                    })
                }
            }
            
            // ... (resto do código igual)


            if (!finalCols.length) return

            // Processa Funil (Por Status)
            const byStatus = finalCols.map(col => ({
                id: col.id,
                name: col.title,
                count: finalLeads.filter(l => l.status === col.id).length,
                color: col.color
            }))

            // Adicionar categoria "Não Classificado" se houver leads sobrando (Debug)
            const classifiedCount = byStatus.reduce((acc, curr) => acc + curr.count, 0)
            const unclassifiedCount = finalLeads.length - classifiedCount
            
            if (unclassifiedCount > 0) {
                byStatus.push({
                    id: 'unknown',
                    name: 'Não Classificado',
                    count: unclassifiedCount,
                    color: '#94a3b8'
                })
            }

            // Processa Origem (Source)
            const sourceMap = finalLeads.reduce((acc: any, lead) => {
                const source = lead.source || 'Manual'
                acc[source] = (acc[source] || 0) + 1
                return acc
            }, {})
            const bySource = Object.keys(sourceMap).map(key => ({
                name: key,
                value: sourceMap[key]
            }))

            // Taxa de Conversão
            const winCol = finalCols.find(c => c.title.toLowerCase().includes('ganho') || c.title.toLowerCase().includes('fechou'))
            const wonLeads = winCol ? finalLeads.filter(l => l.status === winCol.id).length : 0
            const conversionRate = finalLeads.length > 0 ? (wonLeads / finalLeads.length) * 100 : 0

            setStats({
                totalLeads: finalLeads.length,
                conversionRate,
                byStatus,
                bySource,
                leadsList: finalLeads,
                columnsList: finalCols
            })
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1'];

    return (
        <div style={{ padding: 20, maxWidth: 1200, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 30 }}>
                <button onClick={() => navigate('/crm')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                    <ArrowLeft size={24} />
                </button>
                <div>
                    <h1 style={{ margin: 0, fontSize: '1.8rem', color: '#0f172a' }}>Relatórios do CRM</h1>
                    <p style={{ margin: 0, color: '#64748b' }}>Fotografia completa do seu funil de vendas</p>
                </div>
            </div>

            {/* Cards de Resumo */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20, marginBottom: 30 }}>
                <div style={{ background: '#fff', padding: 20, borderRadius: 12, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ padding: 12, background: '#eff6ff', borderRadius: '50%', color: '#3b82f6' }}><Users size={24} /></div>
                    <div>
                        <div style={{ fontSize: '0.9em', color: '#64748b' }}>Total de Leads</div>
                        <div style={{ fontSize: '1.5em', fontWeight: 700, color: '#0f172a' }}>{stats.totalLeads}</div>
                    </div>
                </div>
                <div style={{ background: '#fff', padding: 20, borderRadius: 12, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ padding: 12, background: '#ecfdf5', borderRadius: '50%', color: '#10b981' }}><Target size={24} /></div>
                    <div>
                        <div style={{ fontSize: '0.9em', color: '#64748b' }}>Taxa de Conversão</div>
                        <div style={{ fontSize: '1.5em', fontWeight: 700, color: '#0f172a' }}>{stats.conversionRate.toFixed(1)}%</div>
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 20 }}>
                {/* Gráfico de Funil */}
                <div style={{ background: '#fff', padding: 20, borderRadius: 12, border: '1px solid #e2e8f0' }}>
                    <h3 style={{ margin: '0 0 20px 0', color: '#334155' }}>Leads por Etapa</h3>
                    <div style={{ width: '100%', height: 300, minHeight: 300 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.byStatus} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                                <Tooltip />
                                <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={30}>
                                    {stats.byStatus.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color || '#3b82f6'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Gráfico de Origem */}
                <div style={{ background: '#fff', padding: 20, borderRadius: 12, border: '1px solid #e2e8f0' }}>
                    <h3 style={{ margin: '0 0 20px 0', color: '#334155' }}>Origem dos Leads</h3>
                    <div style={{ width: '100%', height: 300, minHeight: 300 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={stats.bySource}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {stats.bySource.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Tabela de Extrato */}
            <div style={{ marginTop: 30, background: '#fff', padding: 20, borderRadius: 12, border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <h3 style={{ margin: 0, color: '#334155' }}>Detalhamento por Lead (Extrato)</h3>
                    <div style={{ position: 'relative', width: 300 }}>
                        <Search size={18} color="#94a3b8" style={{ position: 'absolute', left: 10, top: 9 }} />
                        <input 
                            placeholder="Buscar lead ou origem..." 
                            value={filterText}
                            onChange={e => setFilterText(e.target.value)}
                            style={{ width: '100%', padding: '8px 10px 8px 36px', borderRadius: 6, border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.9em' }} 
                        />
                    </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9em' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                                <th style={{ padding: 10, color: '#64748b', fontWeight: 600 }}>Nome</th>
                                <th style={{ padding: 10, color: '#64748b', fontWeight: 600 }}>Status Atual</th>
                                <th style={{ padding: 10, color: '#64748b', fontWeight: 600 }}>Origem</th>
                                <th style={{ padding: 10, color: '#64748b', fontWeight: 600 }}>Criado em</th>
                                <th style={{ padding: 10, color: '#64748b', fontWeight: 600 }}>Tempo de Casa</th>
                                <th style={{ padding: 10, color: '#64748b', fontWeight: 600 }}>Histórico</th>
                            </tr>
                        </thead>
                        <tbody>
                            {stats.leadsList
                                .filter(lead => lead.name.toLowerCase().includes(filterText.toLowerCase()) || lead.source.toLowerCase().includes(filterText.toLowerCase()))
                                .map(lead => {
                                const col = stats.columnsList.find(c => c.id === lead.status)
                                const created = lead.createdAt ? new Date(lead.createdAt) : new Date()
                                const days = Math.floor((new Date().getTime() - created.getTime()) / (1000 * 60 * 60 * 24))
                                
                                return (
                                    <tr key={lead.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={{ padding: 12, fontWeight: 500, color: '#0f172a' }}>{lead.name}</td>
                                        <td style={{ padding: 12 }}>
                                            <span style={{ background: col?.bg || '#f1f5f9', color: col?.color || '#475569', padding: '4px 8px', borderRadius: 4, fontSize: '0.85em', fontWeight: 500 }}>
                                                {col?.title || 'Desconhecido'}
                                            </span>
                                        </td>
                                        <td style={{ padding: 12, color: '#64748b' }}>{lead.source}</td>
                                        <td style={{ padding: 12, color: '#64748b' }}>{created.toLocaleDateString('pt-BR')}</td>
                                        <td style={{ padding: 12, color: '#64748b' }}>{days === 0 ? 'Hoje' : `${days} dias`}</td>
                                        <td style={{ padding: 12 }}>
                                            <button onClick={() => { setSelectedLead(lead); setHistoryOpen(true) }} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#3b82f6', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 500 }}>
                                                <History size={16} /> Ver Timeline
                                            </button>
                                        </td>
                                    </tr>
                                )
                            })}
                            {stats.leadsList.filter(lead => lead.name.toLowerCase().includes(filterText.toLowerCase()) || lead.source.toLowerCase().includes(filterText.toLowerCase())).length === 0 && (
                                <tr>
                                    <td colSpan={6} style={{ padding: 20, textAlign: 'center', color: '#94a3b8' }}>Nenhum lead encontrado</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <Modal isOpen={historyOpen} onClose={() => setHistoryOpen(false)} title={`Histórico: ${selectedLead?.name || ''}`}>
                <div style={{ padding: 24, maxHeight: '60vh', overflowY: 'auto' }}>
                    {(() => {
                        // Fallback robusto: Tenta ler do state, se não, lê direto do LocalStorage agora
                        let history = selectedLead?.history
                        if (!history || history.length === 0) {
                            try {
                                const local = JSON.parse(localStorage.getItem('crm_leads_offline') || '[]')
                                const match = local.find((l: any) => l.id === selectedLead?.id)
                                if (match && match.history && match.history.length > 0) {
                                    history = match.history
                                }
                            } catch (e) { console.error(e) }
                        }

                        if (!history || history.length === 0) {
                            return (
                                <div style={{ textAlign: 'center', padding: 20, color: '#94a3b8' }}>
                                    <History size={48} style={{ opacity: 0.2, marginBottom: 10 }} />
                                    <p>Nenhuma movimentação registrada ainda.</p>
                                    <p style={{ fontSize: '0.8em' }}>O histórico começa a contar a partir de agora.</p>
                                </div>
                            )
                        }

                        return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                            {history.map((h: any, idx: number) => {
                                const nextEvent = history[idx + 1]
                                const endDate = nextEvent ? new Date(nextEvent.date) : new Date()
                                const startDate = new Date(h.date)
                                const durationMs = endDate.getTime() - startDate.getTime()
                                const durationDays = Math.floor(durationMs / (1000 * 60 * 60 * 24))
                                const durationHours = Math.floor((durationMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
                                const durationMinutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60))
                                
                                const col = stats.columnsList.find(c => c.id === h.statusId)
                                
                                return (
                                    <div key={idx} style={{ display: 'flex', gap: 16, position: 'relative', paddingBottom: 30 }}>
                                        {idx !== history.length - 1 && (
                                            <div style={{ position: 'absolute', left: 15, top: 32, bottom: 0, width: 2, background: '#e2e8f0' }}></div>
                                        )}
                                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: col?.bg || '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1, border: `2px solid ${col?.color || '#cbd5e1'}`, flexShrink: 0 }}>
                                            <Clock size={16} color={col?.color || '#64748b'} />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 600, color: '#334155', fontSize: '1rem' }}>{col?.title || 'Etapa Desconhecida'}</div>
                                            <div style={{ fontSize: '0.85em', color: '#94a3b8', marginBottom: 6 }}>{startDate.toLocaleString('pt-BR')}</div>
                                            
                                            <div style={{ fontSize: '0.85em', color: '#475569', background: '#f8fafc', padding: '6px 10px', borderRadius: 6, display: 'inline-block', border: '1px solid #e2e8f0' }}>
                                                {idx === history.length - 1 ? (
                                                     <span style={{ color: '#16a34a', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                                                        <TrendingUp size={14} /> Atualmente aqui ({durationDays}d {durationHours}h {durationMinutes}m)
                                                     </span>
                                                ) : (
                                                     <span>Ficou por: <b>{durationDays}d {durationHours}h {durationMinutes}m</b></span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                        )
                    })()}
                </div>
            </Modal>
            
            <div style={{ marginTop: 50, padding: 20, background: '#1e293b', color: '#fff', borderRadius: 8, fontSize: '0.8rem', fontFamily: 'monospace' }}>
                <h3>Debug Info (Vercel)</h3>
                <pre>{JSON.stringify(debugInfo, null, 2)}</pre>
            </div>
        </div>
    )
}