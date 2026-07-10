import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { Toast, type ToastType } from '../../components/Toast'
import { reviewAndReapplyAnamnesis } from '../../store/anamnesis'
import type { StudentRecord } from '../../store/students'

type PendingItem = {
    student: StudentRecord;
    status: 'expired';
    dueDate: string;
}

type ReviewItem = {
    id: string;
    student: StudentRecord;
    answeredAt: string;
    data: any;
}

type AnamnesisOption = {
    id: string;
    title: string;
}

export default function AnamnesisPending() {
    const navigate = useNavigate()
    const [pendingItems, setPendingItems] = useState<PendingItem[]>([])
    const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]) // Itens para revisar
    const [loading, setLoading] = useState(true)
    const [markingId, setMarkingId] = useState<string | null>(null)
    const [isReviewRequired, setIsReviewRequired] = useState(false)
    const [toast, setToast] = useState<{ msg: string, type: ToastType } | null>(null)
    const [libraryModels, setLibraryModels] = useState<AnamnesisOption[]>([])
    const [modelsById, setModelsById] = useState<Record<string, AnamnesisOption>>({})
    
    // Estados do Modal de Confirmação
    const [confirmModal, setConfirmModal] = useState<{ open: boolean, item: ReviewItem | null, days: number, nextModelId: string }>({ 
        open: false, 
        item: null, 
        days: 90,
        nextModelId: ''
    })

    useEffect(() => {
        load()
    }, [])

    async function load() {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                // 1. Busca perfil do personal para ver configuração
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('data')
                    .eq('id', user.id)
                    .single()

                const reviewRequired = profile?.data?.config?.anamnesisReviewRequired === true
                setIsReviewRequired(reviewRequired)

                const [studentsRes, modelsRes, responsesRes] = await Promise.all([
                    supabase
                        .from('profiles')
                        .select('id, personal_id, full_name, email, created_at, plan_id, due_day, data')
                        .eq('personal_id', user.id)
                        .eq('role', 'aluno'),
                    supabase
                        .from('protocols')
                        .select('id, title, status, student_id')
                        .eq('personal_id', user.id)
                        .eq('type', 'anamnesis_model'),
                    supabase
                        .from('protocols')
                        .select('id, student_id, created_at, data, content, renew_in_days')
                        .eq('personal_id', user.id)
                        .eq('type', 'anamnesis')
                ])

                const students = ((studentsRes.data || []) as any[]).map((student): StudentRecord => ({
                    id: student.id,
                    personalId: student.personal_id,
                    name: student.full_name || '',
                    email: student.email || student.data?.email || '',
                    status: student.data?.status === 'inativo' ? 'inativo' : 'ativo',
                    createdAt: student.created_at,
                    lastAccess: student.data?.last_app_access_at,
                    address: student.data?.address,
                    planId: student.plan_id || student.data?.planId,
                    planStartDate: student.data?.planStartDate,
                    dueDay: student.due_day || student.data?.dueDay,
                    workoutIds: student.data?.workoutIds,
                    workoutSchedule: student.data?.workoutSchedule,
                    dietIds: student.data?.dietIds,
                    avatarUrl: student.data?.avatarUrl,
                    tempPassword: student.data?.tempPassword,
                    whatsapp: student.data?.whatsapp
                }))
                const allModels = modelsRes.data || []
                const allResponses = responsesRes.data || []
                const activeStudents = students.filter(s => s.status === 'ativo')
                const activeStudentsById = new Map(activeStudents.map(student => [student.id, student]))
                const studentsWithLinkedModel = new Set(
                    allModels
                        .filter((model: any) => !!model.student_id)
                        .map((model: any) => model.student_id)
                )
                const activeModelOptions = allModels
                    .filter((model: any) => (model.status ?? 'active') === 'active')
                    .map((model: any) => ({
                        id: model.id,
                        title: model.title || 'Sem título'
                    }))
                const libraryModelOptions = allModels
                    .filter((model: any) => !model.student_id && (model.status ?? 'active') === 'active')
                    .map((model: any) => ({
                        id: model.id,
                        title: model.title || 'Sem título'
                    }))

                setLibraryModels(libraryModelOptions)
                setModelsById(
                    activeModelOptions.reduce((acc: Record<string, AnamnesisOption>, model: AnamnesisOption) => {
                        acc[model.id] = model
                        return acc
                    }, {})
                )

                const responsesByStudentId = new Map<string, any[]>()

                allResponses.forEach((response: any) => {
                    const currentResponses = responsesByStudentId.get(response.student_id) || []
                    currentResponses.push(response)
                    responsesByStudentId.set(response.student_id, currentResponses)
                })
                
                const resultPending: PendingItem[] = []
                const resultReview: ReviewItem[] = []
                const now = new Date()

                // Se não tiver modelos, não tem pendência
                if (allModels.length > 0) {
                    if (reviewRequired) {
                        allResponses.forEach((response: any) => {
                            const student = activeStudentsById.get(response.student_id)
                            if (!student) return

                            const respData = response.data || response.content || {}
                            if (!respData.reviewed_at) {
                                resultReview.push({
                                    id: response.id,
                                    student,
                                    answeredAt: response.created_at,
                                    data: respData
                                })
                            }
                        })
                    }

                    activeStudents.forEach(student => {
                        if (!studentsWithLinkedModel.has(student.id)) return

                        const studentResponses = (responsesByStudentId.get(student.id) || []).slice()

                        if (studentResponses.length === 0) {
                            return
                        } else {
                            studentResponses.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                            const last = studentResponses[0]
                            
                            // Se reviewRequired, ignora data de criação e considera reviewed_at como base
                            // MAS se ainda não foi revisada, ela cai na lista de cima (resultReview) e não aqui.
                            // Se já foi revisada, usamos reviewed_at. Se não é required, usamos created_at.
                            
                            const lastData = last.data || last.content || {}
                            
                            const isPendingReview = reviewRequired && !lastData.reviewed_at
                            if (isPendingReview) return 

                            // Data base para cálculo de vencimento
                            // Se reviewRequired = true, usa reviewed_at (se existir)
                            // Se reviewRequired = false, usa created_at
                            const baseDateStr = (reviewRequired && lastData.reviewed_at) 
                                ? lastData.reviewed_at 
                                : last.created_at
                            
                            const renewDays = last.renew_in_days || 90
                            if (renewDays) {
                                const baseDate = new Date(baseDateStr)
                                const expireDate = new Date(baseDate.getTime() + (renewDays * 24 * 60 * 60 * 1000))
                                expireDate.setHours(0, 0, 0, 0)
                                
                                const nowZero = new Date(now)
                                nowZero.setHours(0,0,0,0)

                                if (expireDate <= nowZero) {
                                    resultPending.push({
                                        student,
                                        status: 'expired',
                                        dueDate: expireDate.toISOString()
                                    })
                                }
                            }
                        }
                    })
                }

                setPendingItems(resultPending)
                setReviewItems(resultReview.sort((a, b) => new Date(b.answeredAt).getTime() - new Date(a.answeredAt).getTime()))
            }
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    const handleOpenConfirm = (item: ReviewItem) => {
        const currentRenew = item.data.renew_in_days || 90
        const currentModelId = item.data?.modelId
        const hasCurrentOption = currentModelId && modelsById[currentModelId]
        const nextModelId = hasCurrentOption
            ? currentModelId
            : (libraryModels[0]?.id || '')

        if (!nextModelId) {
            setToast({ msg: 'Nenhuma anamnese disponível para reaplicar.', type: 'error' })
            return
        }

        setConfirmModal({ open: true, item, days: currentRenew, nextModelId })
    }

    const getSelectableModels = (item: ReviewItem | null) => {
        if (!item) return libraryModels

        const currentModelId = item.data?.modelId
        const currentModel = currentModelId ? modelsById[currentModelId] : null

        if (!currentModel) return libraryModels
        if (libraryModels.some(model => model.id === currentModel.id)) return libraryModels

        return [currentModel, ...libraryModels]
    }

    const handleConfirmReview = async () => {
        const { item, days, nextModelId } = confirmModal
        if (!item) return

        if (days <= 0) {
            setToast({ msg: 'Por favor, insira um número válido de dias.', type: 'error' })
            return
        }

        if (!nextModelId) {
            setToast({ msg: 'Selecione qual anamnese será reaplicada.', type: 'error' })
            return
        }
        
        setConfirmModal(prev => ({ ...prev, open: false })) // Fecha modal
        setMarkingId(item.id)
        
        try {
            const result = await reviewAndReapplyAnamnesis({
                responseId: item.id,
                nextModelId,
                daysValid: days
            })

            if (!result.success) {
                throw new Error(result.message || 'Erro ao concluir a anamnese.')
            }

            setReviewItems(prev => prev.filter(i => i.id !== item.id))
            setToast({ msg: `Anamnese concluída e nova aplicação agendada para ${days} dias.`, type: 'success' })
        } catch (err: any) {
            console.error('Erro ao confirmar:', err)
            setToast({ msg: 'Erro ao atualizar: ' + err.message, type: 'error' })
        } finally {
            setMarkingId(null)
            setConfirmModal({ open: false, item: null, days: 90, nextModelId: '' })
        }
    }

    if (loading) return <div>Carregando...</div>

    const selectableModels = getSelectableModels(confirmModal.item)

    return (
        <div>
            {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
            <h1>Gestão de Anamneses</h1>
            <button className="btn" onClick={() => navigate('/dashboard/overview')} style={{ marginBottom: 20, background: 'transparent', color: '#666', border: '1px solid #ccc' }}>← Voltar</button>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
                
                {/* SEÇÃO 1: AGUARDANDO ANÁLISE (SOMENTE SE CONFIGURADO) */}
                {isReviewRequired && (
                    <div className="section">
                        <h2 style={{ fontSize: '1.2rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                            🔔 Aguardando Análise <span style={{ background: '#3b82f6', color: '#fff', fontSize: '0.8rem', padding: '2px 8px', borderRadius: 12 }}>{reviewItems.length}</span>
                        </h2>
                        
                        {reviewItems.length === 0 ? (
                            <div style={{ padding: 20, background: '#f8fafc', borderRadius: 8, color: '#64748b', fontSize: '0.9rem' }}>
                                Nenhuma anamnese recente para analisar.
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gap: 10 }}>
                                {reviewItems.map(item => (
                                    <div key={item.id} className="form-card" style={{ padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: '4px solid #3b82f6', background: '#eff6ff' }}>
                                        <div>
                                            <div style={{ fontWeight: 'bold', fontSize: '1.1em', color: '#1e3a8a' }}>{item.student.name}</div>
                                            <div style={{ fontSize: 13, color: '#3b82f6', marginTop: 4 }}>
                                                Respondeu em {new Date(item.answeredAt).toLocaleDateString()} às {new Date(item.answeredAt).toLocaleTimeString().slice(0,5)}
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <button 
                                                className="btn"
                                                onClick={() => navigate(`/protocols/anamnesis/view/${item.id}`)}
                                                style={{ background: '#fff', color: '#3b82f6', border: '1px solid #bfdbfe', padding: '8px 12px' }}
                                            >
                                                Ver Respostas
                                            </button>
                                            <button 
                                                className="btn" 
                                                disabled={markingId === item.id}
                                                onClick={() => handleOpenConfirm(item)}
                                                style={{ background: '#3b82f6', color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}
                                            >
                                                {markingId === item.id ? '...' : '✅ Concluir'}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* MODAL DE CONFIRMAÇÃO */}
                {confirmModal.open && confirmModal.item && (
                    <div style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(0,0,0,0.5)', zIndex: 9999,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
                    }}>
                        <div style={{
                            background: '#fff', borderRadius: 16, padding: 24,
                            width: '100%', maxWidth: 400,
                            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
                        }}>
                            <h3 style={{ margin: '0 0 8px 0', fontSize: '1.25rem', color: '#0f172a' }}>Confirmar Conclusão</h3>
                            <p style={{ margin: '0 0 20px 0', color: '#64748b', fontSize: '0.95rem' }}>
                                A anamnese de <strong>{confirmModal.item.student.name}</strong> será marcada como analisada e uma nova anamnese será aplicada automaticamente.
                            </p>

                            <label style={{ display: 'block', marginBottom: 16 }}>
                                <span style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                                    Qual anamnese deseja aplicar agora?
                                </span>
                                <select
                                    value={confirmModal.nextModelId}
                                    onChange={e => setConfirmModal(prev => ({ ...prev, nextModelId: e.target.value }))}
                                    style={{
                                        width: '100%', padding: '10px 12px', borderRadius: 8,
                                        border: '1px solid #cbd5e1', fontSize: '1rem', outline: 'none',
                                        background: '#fff'
                                    }}
                                >
                                    <option value="">Selecione uma anamnese</option>
                                    {selectableModels.map(model => (
                                        <option key={model.id} value={model.id}>{model.title}</option>
                                    ))}
                                </select>
                            </label>

                            <label style={{ display: 'block', marginBottom: 20 }}>
                                <span style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                                    Em quantos dias essa nova anamnese vence?
                                </span>
                                <input 
                                    type="number"
                                    value={confirmModal.days}
                                    onChange={e => setConfirmModal(prev => ({ ...prev, days: parseInt(e.target.value) || 0 }))}
                                    style={{
                                        width: '100%', padding: '10px 12px', borderRadius: 8,
                                        border: '1px solid #cbd5e1', fontSize: '1rem', outline: 'none'
                                    }}
                                />
                            </label>

                            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                                <button 
                                    onClick={() => setConfirmModal(prev => ({ ...prev, open: false }))}
                                    style={{
                                        background: '#fff', border: '1px solid #cbd5e1', color: '#475569',
                                        padding: '10px 16px', borderRadius: 8, fontWeight: 600, cursor: 'pointer'
                                    }}
                                >
                                    Cancelar
                                </button>
                                <button 
                                    onClick={handleConfirmReview}
                                    style={{
                                        background: '#16a34a', border: 'none', color: '#fff',
                                        padding: '10px 16px', borderRadius: 8, fontWeight: 600, cursor: 'pointer',
                                        boxShadow: '0 4px 6px -1px rgba(22, 163, 74, 0.3)'
                                    }}
                                >
                                    Confirmar
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* SEÇÃO 2: PENDÊNCIAS (VENCIDOS) */}
                <div className="section">
                    <h2 style={{ fontSize: '1.2rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                        ⚠️ Pendências / Vencidos
                    </h2>

                    <div style={{ display: 'grid', gap: 10 }}>
                        {pendingItems.length === 0 && (
                            <div className="form-card" style={{ padding: 20, textAlign: 'center', color: '#64748b' }}>
                                <div>✅ Tudo em dia com os prazos!</div>
                            </div>
                        )}
                        
                        {pendingItems.map((item, idx) => (
                            <div key={item.student.id + idx} className="form-card" style={{ padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: '4px solid #ef4444' }}>
                                <div>
                                    <div style={{ fontWeight: 'bold', fontSize: '1.1em' }}>{item.student.name}</div>
                                    <div style={{ fontSize: 13, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <span>⏰</span> Venceu em {new Date(item.dueDate).toLocaleDateString()}
                                    </div>
                                </div>
                                <button 
                                    className="btn" 
                                    style={{ background: '#ef4444' }}
                                    onClick={() => navigate(`/protocols/anamnesis-apply?studentId=${item.student.id}`)}
                                >
                                    Renovar
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
