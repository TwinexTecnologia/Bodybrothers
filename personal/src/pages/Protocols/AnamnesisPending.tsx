import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { listStudentsByPersonal } from '../../store/students'
import { useNavigate } from 'react-router-dom'
import { Toast, type ToastType } from '../../components/Toast'

type PendingItem = {
    student: any;
    status: 'expired' | 'warning' | 'ok';
    dueDate: string;
}

type ReviewItem = {
    id: string;
    student: any;
    answeredAt: string;
    data: any;
}

export default function AnamnesisPending() {
    const navigate = useNavigate()
    const [pendingItems, setPendingItems] = useState<PendingItem[]>([])
    const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]) // Itens para revisar
    const [loading, setLoading] = useState(true)
    const [markingId, setMarkingId] = useState<string | null>(null)
    const [isReviewRequired, setIsReviewRequired] = useState(false)
    const [toast, setToast] = useState<{ msg: string, type: ToastType } | null>(null)
    
    // Estados do Modal de Confirmação
    const [confirmModal, setConfirmModal] = useState<{ open: boolean, item: ReviewItem | null, days: number }>({ 
        open: false, 
        item: null, 
        days: 90 
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

                const [students, modelsRes, responsesRes] = await Promise.all([
                    listStudentsByPersonal(user.id),
                    supabase.from('protocols').select('*').eq('personal_id', user.id).eq('type', 'anamnesis_model'),
                    supabase.from('protocols').select('*').eq('personal_id', user.id).eq('type', 'anamnesis')
                ])

                const allModels = modelsRes.data || []
                const allResponses = responsesRes.data || []
                const activeStudents = students.filter(s => s.status === 'ativo')
                
                const resultPending: PendingItem[] = []
                const resultReview: ReviewItem[] = []
                const now = new Date()

                // Se não tiver modelos, não tem pendência
                if (allModels.length > 0) {
                    activeStudents.forEach(student => {
                        // 1. Verifica se tem modelo VINCULADO
                        const hasLinkedModel = allModels.some(m => m.student_id === student.id)
                        if (!hasLinkedModel) return

                        // 2. Busca respostas
                        const studentResponses = allResponses.filter(r => r.student_id === student.id)
                        
                        // Lógica de Revisão (Novas Respostas) - APENAS SE CONFIGURADO
                        if (reviewRequired) {
                            // Pega todas as respostas que NÃO foram revisadas ainda
                            studentResponses.forEach(resp => {
                                const respData = resp.data || resp.content || {}
                                // Se não tem reviewed_at, precisa de revisão
                                if (!respData.reviewed_at) {
                                    resultReview.push({
                                        id: resp.id,
                                        student,
                                        answeredAt: resp.created_at,
                                        data: respData
                                    })
                                }
                            })
                        }

                        if (studentResponses.length === 0) {
                            // Nunca respondeu -> Ignora (ou mostra como missing se quiser)
                        } else {
                            // Verifica validade da última
                            studentResponses.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                            const last = studentResponses[0]
                            
                            // Se reviewRequired, ignora data de criação e considera reviewed_at como base
                            // MAS se ainda não foi revisada, ela cai na lista de cima (resultReview) e não aqui.
                            // Se já foi revisada, usamos reviewed_at. Se não é required, usamos created_at.
                            
                            const lastData = last.data || last.content || {}
                            
                            // Se precisa de revisão mas ainda não foi revisada, ela "não conta" como válida ainda
                            // Então o aluno tecnicamente está "Vencido" ou "Pendente de Análise"
                            // Para simplificar: se está em resultReview, não mostramos como vencido aqui embaixo para não duplicar
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
        setConfirmModal({ open: true, item, days: currentRenew })
    }

    const handleConfirmReview = async () => {
        const { item, days } = confirmModal
        if (!item) return

        if (days <= 0) {
            setToast({ msg: 'Por favor, insira um número válido de dias.', type: 'error' })
            return
        }
        
        setConfirmModal(prev => ({ ...prev, open: false })) // Fecha modal
        setMarkingId(item.id)
        
        try {
            // 1. Busca dados atuais do banco para garantir integridade
            const { data: currentProtocol, error: fetchError } = await supabase
                .from('protocols')
                .select('data')
                .eq('id', item.id)
                .single()
            
            if (fetchError) throw fetchError

            // 2. Prepara novo objeto data
            const currentData = currentProtocol?.data || {}
            const newData = { 
                ...currentData, 
                reviewed_at: new Date().toISOString(),
                renew_in_days: days 
            }
            
            // 3. Atualiza
            console.log('Enviando update para o banco:', newData)
            const { error } = await supabase
                .from('protocols')
                .update({ 
                    data: newData
                })
                .eq('id', item.id)

            if (error) throw error
            
            console.log('Update sucesso!')
            // Remove da lista localmente
            setReviewItems(prev => prev.filter(i => i.id !== item.id))
            setToast({ msg: `Anamnese concluída! Renovação em ${days} dias.`, type: 'success' })
        } catch (err: any) {
            console.error('Erro ao confirmar:', err)
            setToast({ msg: 'Erro ao atualizar: ' + err.message, type: 'error' })
        } finally {
            setMarkingId(null)
            setConfirmModal({ open: false, item: null, days: 90 })
        }
    }

    if (loading) return <div>Carregando...</div>

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
                                A anamnese de <strong>{confirmModal.item.student.name}</strong> será marcada como analisada.
                            </p>

                            <label style={{ display: 'block', marginBottom: 20 }}>
                                <span style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                                    Renovar novamente em quantos dias?
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
                            <div key={item.student.id + idx} className="form-card" style={{ padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: item.status === 'missing' ? '4px solid #f59e0b' : '4px solid #ef4444' }}>
                                <div>
                                    <div style={{ fontWeight: 'bold', fontSize: '1.1em' }}>{item.student.name}</div>
                                    {item.status === 'missing' ? (
                                        <div style={{ fontSize: 13, color: '#d97706', display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <span>⚠️</span> Nunca respondeu
                                        </div>
                                    ) : (
                                        <div style={{ fontSize: 13, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <span>⏰</span> Venceu em {new Date(item.dueDate!).toLocaleDateString()}
                                        </div>
                                    )}
                                </div>
                                <button 
                                    className="btn" 
                                    style={{ background: item.status === 'missing' ? '#0f172a' : '#ef4444' }}
                                    onClick={() => navigate(`/protocols/anamnesis-apply?studentId=${item.student.id}`)}
                                >
                                    {item.status === 'missing' ? 'Aplicar Nova' : 'Renovar'}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
