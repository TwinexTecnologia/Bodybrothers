import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/useAuth'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import { ArrowLeft, TrendingUp, Users, Target } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function CRMDashboard() {
    const navigate = useNavigate()
    const { user } = useAuth()
    const [loading, setLoading] = useState(true)
    const [stats, setStats] = useState({
        totalLeads: 0,
        conversionRate: 0,
        byStatus: [] as any[],
        bySource: [] as any[]
    })

    useEffect(() => {
        if (!user) return
        loadStats()
    }, [user])

    const loadStats = async () => {
        try {
            // 1. Carrega Colunas (para saber os nomes das etapas)
            const { data: cols } = await supabase.from('crm_columns').select('*').eq('user_id', user!.id).order('order')
            
            // 2. Carrega Leads
            const { data: leads } = await supabase.from('crm_leads').select('*').eq('user_id', user!.id)

            if (!leads || !cols) return

            // Processa Funil (Por Status)
            const byStatus = cols.map(col => ({
                name: col.title,
                count: leads.filter(l => l.status_column_id === col.id).length,
                color: col.color
            }))

            // Processa Origem (Source)
            const sourceMap = leads.reduce((acc: any, lead) => {
                const source = lead.source || 'Manual'
                acc[source] = (acc[source] || 0) + 1
                return acc
            }, {})
            const bySource = Object.keys(sourceMap).map(key => ({
                name: key,
                value: sourceMap[key]
            }))

            // Taxa de Conversão (Busca coluna "Ganho" ou "Fechou")
            const winCol = cols.find(c => c.title.toLowerCase().includes('ganho') || c.title.toLowerCase().includes('fechou'))
            const wonLeads = winCol ? leads.filter(l => l.status_column_id === winCol.id).length : 0
            const conversionRate = leads.length > 0 ? (wonLeads / leads.length) * 100 : 0

            setStats({
                totalLeads: leads.length,
                conversionRate,
                byStatus,
                bySource
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
                    <div style={{ height: 300 }}>
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
                    <div style={{ height: 300 }}>
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
        </div>
    )
}