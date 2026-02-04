import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, MoreHorizontal, Phone, Settings, Trash2, GripVertical, Check, X, UserPlus, Edit, Search, Filter, Trophy, BarChart, RefreshCw } from 'lucide-react'
import Modal from '../../components/Modal'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/useAuth'

// Tipos
type LeadStatus = string

type LeadHistory = {
    statusId: string
    statusName?: string
    date: string
}

type Lead = {
    id: string
    name: string
    email?: string
    source: string
    phone: string
    goal?: string
    status: LeadStatus
    lastContact?: string
    notes?: string
    createdAt?: string
    history?: LeadHistory[]
}

type Column = {
    id: string
    title: string
    color: string
    bg: string
}

const DEFAULT_COLUMNS_TEMPLATE = [
    { title: 'Novos Leads', color: '#3b82f6', bg: '#eff6ff' },
    { title: 'Em Contato', color: '#f59e0b', bg: '#fffbeb' },
    { title: 'Agendou Avaliação', color: '#8b5cf6', bg: '#f5f3ff' },
    { title: 'Fechou (Ganho)', color: '#10b981', bg: '#ecfdf5' },
    { title: 'Perdido', color: '#ef4444', bg: '#fef2f2' },
]

export default function CRM() {
    const navigate = useNavigate()
    const { user } = useAuth()
    const [columns, setColumns] = useState<Column[]>([])
    const [leads, setLeads] = useState<Lead[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [configOpen, setConfigOpen] = useState(false)
    const [finalizerColumnId, setFinalizerColumnId] = useState<string | null>(null)
    
    // Novo Lead Modal
    const [newLeadOpen, setNewLeadOpen] = useState(false)
    const [editingLeadId, setEditingLeadId] = useState<string | null>(null)
    const [newLeadData, setNewLeadData] = useState({ name: '', phone: '', email: '', goal: '', notes: '', source: 'Instagram', customSource: '' })
    const [formError, setFormError] = useState('')

    // Origens Disponíveis
    const [availableSources, setAvailableSources] = useState(['Instagram', 'WhatsApp', 'Indicação', 'Google', 'Facebook', 'Twitter', 'Manual'])

    // Modais
    const [winModalOpen, setWinModalOpen] = useState(false)
    const [leadToWin, setLeadToWin] = useState<Lead | null>(null)
    const [deleteModalOpen, setDeleteModalOpen] = useState(false)
    const [leadToDelete, setLeadToDelete] = useState<string | null>(null)

    // Filtros
    const [searchTerm, setSearchTerm] = useState('')
    const [sourceFilter, setSourceFilter] = useState('all')

    // Carregar Inicial
    useEffect(() => {
        const savedCols = localStorage.getItem('crm_columns_offline')
        const savedLeads = localStorage.getItem('crm_leads_offline')
        
        if (savedCols) {
            try { setColumns(JSON.parse(savedCols)) } catch (e) { console.error(e) }
        } else {
            setColumns(DEFAULT_COLUMNS_TEMPLATE.map((c, idx) => ({ id: `local-col-${idx}`, title: c.title, color: c.color, bg: c.bg })))
        }

        if (savedLeads) {
            try { setLeads(JSON.parse(savedLeads)) } catch (e) { console.error(e) }
        }

        // Carregar Configurações Extras
        const savedSettings = localStorage.getItem('crm_settings')
        if (savedSettings) {
            try {
                const { finalizerId } = JSON.parse(savedSettings)
                setFinalizerColumnId(finalizerId)
            } catch (e) { console.error(e) }
        }

        setIsLoading(false)

        const loadSupabaseData = async () => {
            if (!user) return
            try {
                let { data: cols } = await supabase.from('crm_columns').select('*').eq('user_id', user.id).order('order', { ascending: true })
                if (cols && cols.length > 0) {
                    const mappedCols = cols.map(c => ({ id: c.id, title: c.title, color: c.color, bg: c.bg_color }))
                    setColumns(mappedCols)
                    localStorage.setItem('crm_columns_offline', JSON.stringify(mappedCols)) // Atualiza cache
                    
                    // Se não tiver finalizador configurado, tenta adivinhar
                    if (!savedSettings) {
                        const winner = mappedCols.find((c: Column) => c.title.includes('Ganho') || c.title.includes('Fechou'))
                        if (winner) setFinalizerColumnId(winner.id)
                    }
                } else if (cols && cols.length === 0) {
                     // Se banco vazio, limpa local
                     // (Opcional: Poderíamos restaurar padrão, mas você quer fidelidade ao banco)
                }

                const { data: leadsData } = await supabase.from('crm_leads').select('*').eq('user_id', user.id).neq('active', false)
                
                // Prioridade Total ao Banco (Online First)
                if (leadsData) { // Se array existe (mesmo vazio)
                    const onlineLeads = leadsData.map(l => ({
                        id: l.id, name: l.name, phone: l.phone || '', email: l.email || '', source: l.source || 'Manual',
                        status: l.status_column_id, goal: l.goal, notes: l.notes, createdAt: l.created_at, 
                        history: l.history
                    }))
                    
                    setLeads(onlineLeads)
                    localStorage.setItem('crm_leads_offline', JSON.stringify(onlineLeads)) // Sobrescreve cache com a verdade
                }
            } catch (error) { console.error('Erro sync Supabase:', error) }
        }

        if (user) loadSupabaseData()
    }, [user])

    // --- Ações ---
    const setFinalizer = (colId: string) => {
        setFinalizerColumnId(colId)
        localStorage.setItem('crm_settings', JSON.stringify({ finalizerId: colId }))
    }

    const moveLead = async (id: string, newStatusId: string) => {
        const newColName = columns.find(c => c.id === newStatusId)?.title || 'Etapa'

        const updatedLeads = leads.map(l => {
            if (l.id === id) {
                const history = l.history || []
                // Se for o primeiro movimento e não tiver histórico inicial, adiciona o status anterior com data de criação (retroativo)
                let newHistory = [...history]
                if (newHistory.length === 0 && l.createdAt) {
                    const startColName = columns.find(c => c.id === l.status)?.title || 'Entrada'
                    newHistory.push({ statusId: l.status, statusName: startColName, date: l.createdAt })
                }
                
                return { 
                    ...l, 
                    status: newStatusId,
                    history: [...newHistory, { statusId: newStatusId, statusName: newColName, date: new Date().toISOString() }]
                }
            }
            return l
        })
        setLeads(updatedLeads)
        localStorage.setItem('crm_leads_offline', JSON.stringify(updatedLeads)) // Salva sempre localmente (cache)

        if (user) {
            const lead = updatedLeads.find(l => l.id === id)
            await supabase.from('crm_leads').update({ 
                status_column_id: newStatusId,
                history: lead?.history 
            }).eq('id', id)
        }

        // Auto-Sync após mover
        syncData(true, updatedLeads)

        if (newStatusId === finalizerColumnId) {
            const lead = updatedLeads.find(l => l.id === id)
            if (lead) { setLeadToWin(lead); setWinModalOpen(true) }
        }
    }

    const saveNewLead = async () => {
        if (!newLeadData.name.trim()) { setFormError('Nome é obrigatório'); return }
        if (!newLeadData.email.trim()) { setFormError('Email é obrigatório (será o login do aluno)'); return }
        if (!newLeadData.phone.trim()) { setFormError('WhatsApp é obrigatório'); return }
        
        setFormError('')
        
        let finalSource = newLeadData.source
        if (newLeadData.source === 'custom') {
            finalSource = newLeadData.customSource
            if (!availableSources.includes(finalSource)) setAvailableSources(prev => [...prev, finalSource])
        }

        let currentUpdatedLeads: Lead[] = []

        if (editingLeadId) {
            const updatedLeads = leads.map(l => l.id === editingLeadId ? { ...l, ...newLeadData, source: finalSource } : l)
            setLeads(updatedLeads)
            localStorage.setItem('crm_leads_offline', JSON.stringify(updatedLeads))
            currentUpdatedLeads = updatedLeads
            
            if (user) await supabase.from('crm_leads').update({ name: newLeadData.name, email: newLeadData.email, phone: newLeadData.phone, goal: newLeadData.goal, notes: newLeadData.notes, source: finalSource }).eq('id', editingLeadId)
        } else {
            const newLead = { 
                id: crypto.randomUUID(), // Gera UUID v4 válido nativo do navegador
                ...newLeadData, 
                source: finalSource, 
                status: columns[0].id, 
                lastContact: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                history: [{ statusId: columns[0].id, date: new Date().toISOString() }]
            }
            const updatedLeads = [...leads, newLead]
            setLeads(updatedLeads)
            localStorage.setItem('crm_leads_offline', JSON.stringify(updatedLeads))
            currentUpdatedLeads = updatedLeads
            
            if (user) {
                await supabase.from('crm_leads').insert({
                    name: newLeadData.name, email: newLeadData.email, phone: newLeadData.phone, goal: newLeadData.goal, notes: newLeadData.notes,
                    source: finalSource, status_column_id: columns[0].id, user_id: user.id,
                    history: newLead.history
                })
            }
        }
        
        // Auto-Sync após criar/editar
        syncData(true, currentUpdatedLeads)

        setNewLeadData({ name: '', phone: '', email: '', goal: '', notes: '', source: 'Instagram', customSource: '' })
        setEditingLeadId(null)
        setNewLeadOpen(false)
    }

    const deleteLead = (id: string) => { setLeadToDelete(id); setDeleteModalOpen(true) }
    
    const confirmDelete = async () => {
        if (!leadToDelete) return
        
        console.log('Tentando inativar lead:', leadToDelete)

        const updatedLeads = leads.filter(l => l.id !== leadToDelete)
        setLeads(updatedLeads)
        localStorage.setItem('crm_leads_offline', JSON.stringify(updatedLeads))
        
        // Soft Delete: Apenas marca como inativo
        if (user) {
            const { data, error } = await supabase
                .from('crm_leads')
                .update({ active: false })
                .eq('id', leadToDelete)
                .select()
            
            if (error) {
                console.error('Erro no Soft Delete:', error)
                alert('Erro ao inativar no banco. Verifique o console.')
            } else {
                console.log('Lead inativado com sucesso:', data)
            }
        }
        
        setDeleteModalOpen(false); setLeadToDelete(null)
    }

    // Config Colunas
    const [newColName, setNewColName] = useState('')
    const addColumn = async () => {
        if (!newColName.trim()) return
        const newCol = { id: `col-${Date.now()}`, title: newColName, color: '#64748b', bg: '#f8fafc' }
        const updatedCols = [...columns, newCol]
        setColumns(updatedCols)
        
        if (!user) {
            localStorage.setItem('crm_columns_offline', JSON.stringify(updatedCols))
        } else {
            const { data } = await supabase.from('crm_columns').insert({ title: newColName, color: '#64748b', bg_color: '#f8fafc', order: columns.length, user_id: user.id }).select().single()
            if (data) setColumns([...columns, { id: data.id, title: data.title, color: data.color, bg: data.bg_color }])
        }
        setNewColName('')
    }

    const removeColumn = async (id: string) => {
        if (!confirm('Tem certeza?')) return
        const updatedCols = columns.filter(c => c.id !== id)
        setColumns(updatedCols)
        if (!user) localStorage.setItem('crm_columns_offline', JSON.stringify(updatedCols))
        else await supabase.from('crm_columns').delete().eq('id', id)
    }

    const updateColumnTitle = (id: string, newTitle: string) => {
        const updatedCols = columns.map(c => c.id === id ? { ...c, title: newTitle } : c)
        setColumns(updatedCols)
        
        // Salva Offline instantaneamente
        if (!user) {
            localStorage.setItem('crm_columns_offline', JSON.stringify(updatedCols))
        }
    }

    const persistColumnTitle = async (id: string, newTitle: string) => {
        // Salva no Banco apenas ao sair do campo (onBlur) para economizar requisições
        if (user && newTitle.trim()) {
            await supabase.from('crm_columns').update({ title: newTitle }).eq('id', id)
        }
    }

    const resetCRM = async () => {
        if (!confirm('Resetar tudo?')) return
        localStorage.removeItem('crm_columns_offline')
        if (user) await supabase.from('crm_columns').delete().eq('user_id', user.id)
        window.location.reload()
    }

    const optimizeColumns = async () => {
        if (!confirm('Isso vai remover colunas com nomes duplicados e unificar os leads na primeira coluna encontrada. Continuar?')) return
        
        let currentUser = user
        if (!currentUser) {
            const { data } = await supabase.auth.getUser()
            currentUser = data.user
        }

        if (!currentUser) return alert('Precisa estar online.')
        
        try {
            // 1. Pega todas as colunas
            const { data: cols } = await supabase.from('crm_columns').select('*').eq('user_id', currentUser.id)
            if (!cols) return

            // 2. Agrupa por nome
            const groups: Record<string, string[]> = {}
            cols.forEach(c => {
                if (!groups[c.title]) groups[c.title] = []
                groups[c.title].push(c.id)
            })

            // 3. Processa
            let moved = 0
            let deleted = 0

            for (const title in groups) {
                const ids = groups[title]
                if (ids.length > 1) {
                    const keeper = ids[0] // Mantém o primeiro
                    const toDelete = ids.slice(1) // Apaga o resto

                    console.log(`Otimizando "${title}": Mantendo ${keeper}, apagando ${toDelete.length} duplicatas.`)

                    // Move leads para o keeper
                    await supabase.from('crm_leads')
                        .update({ status_column_id: keeper })
                        .in('status_column_id', toDelete)
                    
                    moved++

                    // Apaga colunas duplicadas
                    await supabase.from('crm_columns')
                        .delete()
                        .in('id', toDelete)
                    
                    deleted += toDelete.length
                }
            }

            alert(`Otimização concluída!\nColunas duplicadas removidas: ${deleted}\nGrupos unificados: ${moved}`)
            window.location.reload()

        } catch (e) {
            console.error(e)
            alert('Erro ao otimizar: ' + e)
        }
    }

    const filteredLeads = leads.filter(l => {
        const matchesSearch = l.name.toLowerCase().includes(searchTerm.toLowerCase()) || l.phone.includes(searchTerm)
        const matchesSource = sourceFilter === 'all' || l.source === sourceFilter
        return matchesSearch && matchesSource
    })

    const openEditLead = (lead: Lead) => {
        setEditingLeadId(lead.id)
        setNewLeadData({ name: lead.name, phone: lead.phone, email: lead.email || '', goal: lead.goal || '', notes: lead.notes || '', source: lead.source, customSource: '' })
        setNewLeadOpen(true)
    }

    const handleWinAction = (createStudent: boolean) => {
        // Garante dados frescos
        const currentLead = leads.find(l => l.id === leadToWin?.id) || leadToWin
        if (!currentLead) return

        if (createStudent) {
            const params = new URLSearchParams(); 
            params.append('name', currentLead.name);
            if (currentLead.email) params.append('email', currentLead.email);
            if (currentLead.phone) params.append('phone', currentLead.phone);
            
            console.log('Redirecionando com:', params.toString())
            
            navigate(`/students/create?${params.toString()}`)
        }
        setWinModalOpen(false); setLeadToWin(null)
    }

    const syncData = async (silent = false, leadsOverride?: Lead[]) => {
        if (!silent) {
            console.log('🔄 Tentando iniciar Sync Manual...')
            if (!window.confirm('Deseja enviar os dados locais para a nuvem? Isso corrigirá a visualização na Vercel.')) return
            setIsLoading(true)
        } else {
             console.log('🔄 Sync Automático iniciado...')
        }
        
        // Tenta obter usuário manualmente se o hook falhou
        let currentUser = user
        if (!currentUser) {
            const { data } = await supabase.auth.getUser()
            currentUser = data.user
        }

        if (!currentUser) {
            if (!silent) {
                setIsLoading(false)
                alert('Erro Crítico: Você não está logado no Supabase.')
            }
            return
        }
        
        try {
            // 1. Mapeamento de Colunas (Evita duplicatas e garante IDs reais)
            const colsMap: Record<string, string> = {} // LocalID -> RealID
            const colsNameMap: Record<string, string> = {} // Name -> RealID (Fallback)

            // Carrega colunas existentes no banco
            const { data: existingCols } = await supabase.from('crm_columns').select('*').eq('user_id', currentUser.id)
            if (existingCols) {
                existingCols.forEach(c => {
                    colsNameMap[c.title] = c.id
                })
            }
            
            for (const col of columns) {
                // Tenta encontrar pelo título no mapa carregado do banco
                let realId = colsNameMap[col.title]
                
                if (!realId) {
                    // Cria nova coluna se não existir no banco
                    const { data: newCol, error: createError } = await supabase.from('crm_columns').insert({
                         title: col.title, color: col.color, bg_color: col.bg, order: columns.indexOf(col), user_id: currentUser.id
                    }).select().single()
                    
                    if (createError) {
                        console.error('Erro ao criar coluna:', col.title, createError)
                        continue
                    }
                    realId = newCol.id
                    colsNameMap[col.title] = realId // Atualiza mapa
                }
                
                if (realId) colsMap[col.id] = realId
            }

            // 2. Sincronizar Leads
            let count = 0
            let errorCount = 0
            const leadsToSync = leadsOverride || leads
            
            for (const lead of leadsToSync) {
                // Descobre o ID real da coluna
                let realStatusId = colsMap[lead.status] || colsNameMap[columns.find(c => c.id === lead.status)?.title || '']
                
                // Se ainda não achou, usa a primeira coluna disponível no banco (Fallback seguro)
                if (!realStatusId) {
                    const firstCol = Object.values(colsNameMap)[0]
                    if (firstCol) realStatusId = firstCol
                    else {
                        console.error('Nenhuma coluna disponível para o lead', lead.name)
                        errorCount++
                        continue
                    }
                }
                
                // Payload Limpo
                const payload: any = {
                    name: lead.name,
                    email: lead.email,
                    phone: lead.phone,
                    source: lead.source,
                    goal: lead.goal,
                    notes: lead.notes,
                    status_column_id: realStatusId, // UUID Válido garantido
                    user_id: currentUser.id,
                    history: lead.history 
                }

                // IMPORTANTE: Agora usamos UUIDs nativos, então sempre podemos usar Upsert.
                // O banco vai aceitar o ID que geramos no front.
                payload.id = lead.id
                const { error } = await supabase.from('crm_leads').upsert(payload)
                
                if (error) { 
                    console.error('Erro upsert lead:', lead.name, error); 
                    errorCount++ 
                } else {
                    count++
                }
            }
            if (!silent) {
                alert(`Sincronização Finalizada!\n\nSucesso: ${count}\nErros: ${errorCount}\n\nAgora verifique na Vercel.`)
                window.location.reload()
            } else {
                console.log(`✅ Auto-Sync finalizado. ${count} leads processados.`)
            }
            
        } catch (err) {
            if (!silent) alert('Erro Fatal no Sync. Verifique o console.')
            console.error(err)
        } finally {
            if (!silent) setIsLoading(false)
        }
    }

    // Auto-Sync APENAS em ações do usuário (Removido do carregamento inicial para evitar ressuscitar dados deletados)
    /*
    useEffect(() => {
        if (user) {
            const timer = setTimeout(() => syncData(true), 3000)
            return () => clearTimeout(timer)
        }
    }, [user])
    */

    return (
        <div style={{ height: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column' }}>
            <style>{`
                .crm-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06) !important;
                    border-color: #cbd5e1 !important;
                }
            `}</style>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '1.8rem', color: '#0f172a' }}>CRM • Vendas</h1>
                    <p style={{ margin: '4px 0 0 0', color: '#64748b' }}>Funil de vendas personalizável</p>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                    <button 
                        className="btn" 
                        onClick={() => navigate('/crm/dashboard')} 
                        style={{ 
                            background: '#fff', 
                            border: '1px solid #cbd5e1', 
                            padding: '8px 16px', 
                            borderRadius: 8, 
                            display: 'flex', 
                            gap: 8, 
                            alignItems: 'center', 
                            cursor: 'pointer',
                            color: '#64748b', 
                            fontWeight: 500
                        }}
                    >
                        <BarChart size={18} /> Relatórios
                    </button>
                    <button 
                        className="btn" 
                        onClick={() => setConfigOpen(true)} 
                        style={{ 
                            background: '#fff', 
                            border: '1px solid #cbd5e1', 
                            padding: '8px 16px', 
                            borderRadius: 8, 
                            display: 'flex', 
                            gap: 8, 
                            alignItems: 'center', 
                            cursor: 'pointer',
                            color: '#64748b', // Cor forçada para garantir contraste
                            fontWeight: 500
                        }}
                    >
                        <Settings size={18} /> Configurar
                    </button>
                    <button className="btn-primary" onClick={() => { setNewLeadOpen(true); setEditingLeadId(null); setNewLeadData({ name: '', phone: '', email: '', goal: '', notes: '', source: 'Instagram', customSource: '' }) }} style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: 8, display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer', fontWeight: 600 }}><Plus size={18} /> Novo Lead</button>
                </div>
            </div>

            {/* Filtros */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 20, padding: '12px', background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1, maxWidth: 300 }}>
                    <Search size={18} color="#94a3b8" style={{ position: 'absolute', left: 10, top: 10 }} />
                    <input placeholder="Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ width: '100%', padding: '8px 10px 8px 36px', borderRadius: 6, border: '1px solid #cbd5e1', outline: 'none' }} />
                </div>
                <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)} style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', outline: 'none' }}>
                    <option value="all">Todas as Origens</option>
                    {availableSources.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
            </div>

            {/* Kanban */}
            <div style={{ flex: 1, display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 20, alignItems: 'flex-start' }}>
                {columns.map(col => (
                    <div key={col.id} style={{ flex: '1 0 270px', maxWidth: 350, display: 'flex', flexDirection: 'column', background: '#f1f5f9', borderRadius: 12, maxHeight: '100%', border: '1px solid #cbd5e1' }}>
                        
                        {/* Header da Coluna Profissional */}
                        <div style={{ padding: '12px 14px', background: '#fff', borderRadius: '11px 11px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 10, height: 10, borderRadius: '50%', background: col.color, boxShadow: `0 0 0 2px ${col.bg}` }}></div>
                                <span style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                                    {col.title}
                                    {finalizerColumnId === col.id && <Trophy size={14} color="#f59e0b" fill="#f59e0b" />}
                                </span>
                            </div>
                            <span style={{ background: '#f8fafc', color: '#64748b', padding: '2px 8px', borderRadius: 6, fontSize: '0.75em', fontWeight: 600, border: '1px solid #e2e8f0' }}>
                                {filteredLeads.filter(l => l.status === col.id).length}
                            </span>
                        </div>

                        {/* Corpo da Coluna */}
                        <div style={{ padding: 10, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {filteredLeads.filter(l => l.status === col.id).map(lead => (
                                <div key={lead.id} 
                                    className="crm-card" // Classe para hover (vou adicionar style tag no final)
                                    style={{ 
                                        background: '#fff', 
                                        padding: 14, 
                                        borderRadius: 8, 
                                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)', 
                                        border: '1px solid #e2e8f0',
                                        borderLeft: `3px solid ${col.color}`, // Borda lateral colorida
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center' }}>
                                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                            <span style={{ fontSize: '0.7em', color: '#64748b', background: '#f8fafc', padding: '2px 6px', borderRadius: 4, border: '1px solid #f1f5f9', fontWeight: 500 }}>{lead.source}</span>
                                            {lead.createdAt && <span style={{ fontSize: '0.65em', color: '#94a3b8' }}>{new Date(lead.createdAt).toLocaleDateString('pt-BR')}</span>}
                                        </div>
                                        <div style={{ display: 'flex', gap: 4, opacity: 0.6 }} onMouseEnter={e => e.currentTarget.style.opacity = '1'} onMouseLeave={e => e.currentTarget.style.opacity = '0.6'}>
                                            <button onClick={() => openEditLead(lead)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b', padding: 2 }}><Edit size={14} /></button>
                                            <button onClick={() => deleteLead(lead.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#ef4444', padding: 2 }}><Trash2 size={14} /></button>
                                        </div>
                                    </div>
                                    
                                    <h4 style={{ margin: '0 0 4px 0', color: '#0f172a', fontSize: '0.95rem', fontWeight: 600 }}>{lead.name}</h4>
                                    
                                    {lead.notes && (
                                        <p style={{ fontSize: '0.8em', color: '#64748b', margin: '4px 0 8px 0', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                            {lead.notes}
                                        </p>
                                    )}

                                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end' }}>
                                        <select 
                                            value="" 
                                            onChange={(e) => moveLead(lead.id, e.target.value)} 
                                            style={{ 
                                                background: 'transparent', 
                                                border: 'none', 
                                                color: '#3b82f6', 
                                                fontSize: '0.75em', 
                                                fontWeight: 600, 
                                                cursor: 'pointer', 
                                                outline: 'none',
                                                textAlign: 'right',
                                                paddingRight: 0
                                            }}
                                        >
                                            <option value="" disabled>Mover para...</option>
                                            {columns.filter(c => c.id !== col.id).map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                                        </select>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* Modais */}
            <Modal isOpen={configOpen} onClose={() => setConfigOpen(false)} title="Configurar Etapas">
                <div style={{ padding: 16 }}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                        <input placeholder="Nova etapa..." value={newColName} onChange={e => setNewColName(e.target.value)} style={{ flex: 1, padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }} />
                        <button onClick={addColumn} style={{ padding: '8px 16px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Adicionar</button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {columns.map(col => (
                            <div key={col.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6 }}>
                                <input 
                                    value={col.title}
                                    onChange={(e) => updateColumnTitle(col.id, e.target.value)}
                                    onBlur={(e) => persistColumnTitle(col.id, e.target.value)}
                                    style={{ 
                                        fontWeight: 500, 
                                        color: '#334155', 
                                        background: 'transparent', 
                                        border: '1px solid transparent', 
                                        borderRadius: 4,
                                        padding: '4px 8px',
                                        flex: 1,
                                        marginRight: 10,
                                        fontSize: '1rem',
                                        outlineColor: '#3b82f6'
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.border = '1px solid #cbd5e1'}
                                    onMouseLeave={e => {
                                        if (document.activeElement !== e.currentTarget) e.currentTarget.style.border = '1px solid transparent'
                                    }}
                                    onFocus={e => e.currentTarget.style.border = '1px solid #3b82f6'}
                                />
                                <div style={{ display: 'flex', gap: 12 }}>
                                    <button 
                                        onClick={() => setFinalizer(col.id)}
                                        title={finalizerColumnId === col.id ? "Etapa Finalizadora (Cria Aluno)" : "Marcar como Etapa Finalizadora"}
                                        style={{ 
                                            color: finalizerColumnId === col.id ? '#f59e0b' : '#cbd5e1', 
                                            border: 'none', background: 'none', cursor: 'pointer',
                                            display: 'flex', alignItems: 'center'
                                        }}
                                    >
                                        <Trophy size={18} fill={finalizerColumnId === col.id ? '#f59e0b' : 'none'} />
                                    </button>
                                    <button onClick={() => removeColumn(col.id)} style={{ color: '#ef4444', border: 'none', background: 'none', cursor: 'pointer' }}><Trash2 size={18} /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div style={{ marginTop: 20, display: 'flex', justifyContent: 'space-between' }}>
                        <button onClick={resetCRM} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Resetar Padrões</button>
                        <button onClick={optimizeColumns} style={{ color: '#f59e0b', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>🧹 Otimizar Banco (Remover Duplicatas)</button>
                    </div>
                </div>
            </Modal>
            
            <Modal isOpen={newLeadOpen} onClose={() => setNewLeadOpen(false)} title={editingLeadId ? "Editar Interessado" : "Novo Lead"}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    
                    {formError && (
                        <div style={{ background: '#fef2f2', color: '#b91c1c', padding: '10px 12px', borderRadius: 6, fontSize: '0.9em', border: '1px solid #fecaca', display: 'flex', alignItems: 'center', gap: 8 }}>
                            ⚠️ {formError}
                        </div>
                    )}

                    <div>
                        <label style={{ display: 'block', fontSize: '0.9em', fontWeight: 600, color: '#334155', marginBottom: 4 }}>Nome Completo <span style={{ color: '#ef4444' }}>*</span></label>
                        <input 
                            placeholder="Ex: Ana Silva" 
                            value={newLeadData.name} 
                            onChange={e => setNewLeadData({...newLeadData, name: e.target.value})} 
                            style={{ width: '100%', padding: '10px', borderRadius: 6, border: '1px solid #cbd5e1', borderColor: formError && !newLeadData.name ? '#ef4444' : '#cbd5e1' }} 
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.9em', fontWeight: 600, color: '#334155', marginBottom: 4 }}>WhatsApp <span style={{ color: '#ef4444' }}>*</span></label>
                            <input 
                                placeholder="(11) 99999-9999" 
                                value={newLeadData.phone} 
                                onChange={e => setNewLeadData({...newLeadData, phone: e.target.value})} 
                                style={{ width: '100%', padding: '10px', borderRadius: 6, border: '1px solid #cbd5e1', borderColor: formError && !newLeadData.phone ? '#ef4444' : '#cbd5e1' }} 
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.9em', fontWeight: 600, color: '#334155', marginBottom: 4 }}>Email <span style={{ color: '#ef4444' }}>*</span></label>
                            <input 
                                placeholder="login@email.com" 
                                value={newLeadData.email} 
                                onChange={e => setNewLeadData({...newLeadData, email: e.target.value})} 
                                style={{ width: '100%', padding: '10px', borderRadius: 6, border: '1px solid #cbd5e1', borderColor: formError && !newLeadData.email ? '#ef4444' : '#cbd5e1' }} 
                            />
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '0.9em', fontWeight: 600, color: '#334155', marginBottom: 4 }}>Origem</label>
                        <div style={{ display: 'flex', gap: 8 }}>
                             <select 
                                value={newLeadData.source} 
                                onChange={e => setNewLeadData({...newLeadData, source: e.target.value})} 
                                style={{ flex: 1, padding: '10px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff' }}
                             >
                                {availableSources.map(s => <option key={s} value={s}>{s}</option>)}
                                <option value="custom">➕ Outra...</option>
                             </select>
                             {newLeadData.source === 'custom' && (
                                <input 
                                    placeholder="Qual plataforma?" 
                                    value={newLeadData.customSource} 
                                    onChange={e => setNewLeadData({...newLeadData, customSource: e.target.value})} 
                                    style={{ flex: 1, padding: '10px', borderRadius: 6, border: '1px solid #cbd5e1' }} 
                                    autoFocus
                                />
                             )}
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '0.9em', fontWeight: 600, color: '#334155', marginBottom: 4 }}>Observações / Objetivo</label>
                        <textarea 
                            placeholder="Ex: Quer emagrecer 5kg, tem dores no joelho..." 
                            value={newLeadData.notes} 
                            onChange={e => setNewLeadData({...newLeadData, notes: e.target.value})} 
                            style={{ width: '100%', padding: '10px', borderRadius: 6, border: '1px solid #cbd5e1', minHeight: 80, resize: 'vertical' }} 
                        />
                    </div>

                    <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                        <button 
                            onClick={() => setNewLeadOpen(false)} 
                            style={{ flex: 1, padding: '12px', background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 500 }}
                        >
                            Cancelar
                        </button>
                        <button 
                            onClick={saveNewLead} 
                            style={{ flex: 1, padding: '12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)' }}
                        >
                            {editingLeadId ? 'Salvar Alterações' : 'Cadastrar Lead'}
                        </button>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={winModalOpen} onClose={() => setWinModalOpen(false)} title="Venda!">
                 <div style={{ textAlign: 'center', padding: 20 }}>
                     <h3>Criar aluno para {leadToWin?.name}?</h3>
                     <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 20 }}>
                         <button onClick={() => handleWinAction(false)} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}>Não</button>
                         <button onClick={() => handleWinAction(true)} style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer' }}>Sim, Criar</button>
                     </div>
                 </div>
            </Modal>

            <Modal isOpen={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} title="Excluir">
                <div style={{ textAlign: 'center', padding: 20 }}>
                    <p>Tem certeza?</p>
                    <button onClick={confirmDelete} style={{ marginTop: 10, padding: '8px 16px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Excluir</button>
                </div>
            </Modal>
        </div>
    )
}