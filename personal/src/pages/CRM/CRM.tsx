import { useState } from 'react'
import { Plus, MoreHorizontal, Phone, Calendar, CheckCircle, XCircle } from 'lucide-react'

// Tipos Mockados
type Lead = {
    id: string
    name: string
    source: string // Instagram, Indicação, etc
    phone: string
    status: 'new' | 'contact' | 'schedule' | 'won' | 'lost'
    lastContact?: string
    notes?: string
}

const INITIAL_LEADS: Lead[] = [
    { id: '1', name: 'João Silva', source: 'Instagram', phone: '11999999999', status: 'new', lastContact: 'Hoje' },
    { id: '2', name: 'Maria Oliveira', source: 'Indicação', phone: '11988888888', status: 'contact', lastContact: 'Ontem', notes: 'Quer focar em emagrecimento' },
    { id: '3', name: 'Carlos Souza', source: 'Google', phone: '11977777777', status: 'schedule', lastContact: '2 dias atrás', notes: 'Avaliação marcada para sexta' },
    { id: '4', name: 'Ana Paula', source: 'Instagram', phone: '11966666666', status: 'won', lastContact: 'Semana passada' },
]

const COLUMNS = [
    { id: 'new', title: 'Novos Leads', color: '#3b82f6', bg: '#eff6ff' },
    { id: 'contact', title: 'Em Contato', color: '#f59e0b', bg: '#fffbeb' },
    { id: 'schedule', title: 'Agendou Avaliação', color: '#8b5cf6', bg: '#f5f3ff' },
    { id: 'won', title: 'Fechou (Ganho)', color: '#10b981', bg: '#ecfdf5' },
    { id: 'lost', title: 'Perdido', color: '#ef4444', bg: '#fef2f2' },
]

export default function CRM() {
    const [leads, setLeads] = useState<Lead[]>(INITIAL_LEADS)
    const [isDragging, setIsDragging] = useState<string | null>(null)

    // Função simples para mover (simulando drag and drop no clique para mobile/desktop fácil)
    const moveLead = (id: string, newStatus: Lead['status']) => {
        setLeads(prev => prev.map(l => l.id === id ? { ...l, status: newStatus } : l))
    }

    const addLead = () => {
        const name = prompt('Nome do interessado:')
        if (!name) return
        const newLead: Lead = {
            id: Math.random().toString(),
            name,
            source: 'Manual',
            phone: '',
            status: 'new',
            lastContact: 'Agora'
        }
        setLeads([...leads, newLead])
    }

    return (
        <div style={{ height: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '1.8rem', color: '#0f172a' }}>CRM • Vendas</h1>
                    <p style={{ margin: '4px 0 0 0', color: '#64748b' }}>Gerencie seus contatos e funil de vendas</p>
                </div>
                <button className="btn-primary" onClick={addLead} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Plus size={20} /> Novo Lead
                </button>
            </div>

            {/* Kanban Board */}
            <div style={{ 
                flex: 1, 
                display: 'flex', 
                gap: 16, 
                overflowX: 'auto', 
                paddingBottom: 20 
            }}>
                {COLUMNS.map(col => (
                    <div key={col.id} style={{ 
                        flex: '0 0 300px', 
                        display: 'flex', 
                        flexDirection: 'column',
                        background: '#f8fafc', 
                        borderRadius: 12, 
                        border: '1px solid #e2e8f0',
                        maxHeight: '100%'
                    }}>
                        {/* Header Coluna */}
                        <div style={{ 
                            padding: 16, 
                            borderBottom: `3px solid ${col.color}`,
                            display: 'flex', 
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            background: '#fff',
                            borderRadius: '12px 12px 0 0'
                        }}>
                            <span style={{ fontWeight: 700, color: '#334155' }}>{col.title}</span>
                            <span style={{ 
                                background: col.bg, color: col.color, 
                                padding: '2px 8px', borderRadius: 12, fontSize: '0.8em', fontWeight: 600 
                            }}>
                                {leads.filter(l => l.status === col.id).length}
                            </span>
                        </div>

                        {/* Lista de Cards */}
                        <div style={{ padding: 12, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {leads.filter(l => l.status === col.id).map(lead => (
                                <div key={lead.id} style={{ 
                                    background: '#fff', 
                                    padding: 16, 
                                    borderRadius: 8, 
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                                    border: '1px solid #e2e8f0',
                                    cursor: 'grab',
                                    transition: 'transform 0.2s',
                                    position: 'relative'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                        <span style={{ fontSize: '0.75em', color: '#94a3b8', background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>
                                            {lead.source}
                                        </span>
                                        <button style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}>
                                            <MoreHorizontal size={16} color="#cbd5e1" />
                                        </button>
                                    </div>
                                    
                                    <h4 style={{ margin: '0 0 4px 0', color: '#1e293b' }}>{lead.name}</h4>
                                    
                                    {lead.notes && (
                                        <p style={{ fontSize: '0.85em', color: '#64748b', margin: '0 0 8px 0', fontStyle: 'italic' }}>
                                            "{lead.notes}"
                                        </p>
                                    )}

                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8em', color: '#64748b', marginTop: 12 }}>
                                        <Phone size={14} /> {lead.phone || '—'}
                                    </div>
                                    
                                    {/* Ações Rápidas (Simulando mover) */}
                                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f1f5f9', display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                                        {col.id !== 'won' && (
                                            <button 
                                                title="Mover para Próxima Etapa"
                                                onClick={() => {
                                                    const next = COLUMNS[COLUMNS.findIndex(c => c.id === col.id) + 1]
                                                    if (next) moveLead(lead.id, next.id as any)
                                                }}
                                                style={{ background: '#eff6ff', border: 'none', padding: 6, borderRadius: 4, cursor: 'pointer', color: '#3b82f6' }}
                                            >
                                                →
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {leads.filter(l => l.status === col.id).length === 0 && (
                                <div style={{ textAlign: 'center', padding: 20, color: '#cbd5e1', fontSize: '0.9em', border: '2px dashed #e2e8f0', borderRadius: 8 }}>
                                    Vazio
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}