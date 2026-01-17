import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/useAuth'
import { ClipboardList, CheckCircle, Clock, ChevronRight, X, Save, AlertCircle } from 'lucide-react'
import Modal from '../../components/Modal'

// Tipos
type Question = {
  id: string
  text: string
  type: 'text' | 'number' | 'boolean' | 'select' | 'multi' | 'photo'
  options?: string[]
  required?: boolean
  exampleImage?: string
}

type AnamnesisModel = {
  id: string
  title: string
  questions: Question[]
  ends_at?: string
  personal_id: string
}

type AnamnesisResponse = {
  id: string
  created_at: string
  data: {
    modelId: string
    answers: Record<string, any>
  }
}

export default function ListAnamnesis() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [models, setModels] = useState<AnamnesisModel[]>([])
  const [responses, setResponses] = useState<AnamnesisResponse[]>([])
  
  // Estado do Formulário
  const [answeringModel, setAnsweringModel] = useState<AnamnesisModel | null>(null)
  const [answers, setAnswers] = useState<Record<string, any>>({})
  const [submitting, setSubmitting] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null) // Novo estado para erro

  // Estado de Visualização
  const [viewingResponse, setViewingResponse] = useState<{response: AnamnesisResponse, model?: AnamnesisModel} | null>(null)
  
  // Bloqueio de inativos
  const [isBlocked, setIsBlocked] = useState(false)

  useEffect(() => {
    if (user) loadData()
  }, [user])

  async function loadData() {
    try {
        setLoading(true)
        
        // Verificação de Status
        const { data: profile } = await supabase
             .from('profiles')
             .select('data')
             .eq('id', user?.id)
             .single()
         
        const status = profile?.data?.status || 'ativo'
        if (status !== 'ativo' && status !== 'active') {
             setIsBlocked(true)
        }

        // 1. Busca Modelos Atribuídos ao Aluno
        const { data: modelsData } = await supabase
            .from('protocols')
            .select('*')
            .eq('type', 'anamnesis_model')
            .eq('student_id', user?.id)
        
        // 2. Busca Respostas do Aluno
        const { data: responsesData } = await supabase
            .from('protocols')
            .select('*')
            .eq('type', 'anamnesis')
            .eq('student_id', user?.id)
            .order('created_at', { ascending: false })

        setModels((modelsData || []).map(d => ({
            id: d.id,
            title: d.title,
            questions: d.data?.questions || [],
            ends_at: d.ends_at,
            personal_id: d.personal_id
        })))

        setResponses((responsesData || []).map(d => ({
            id: d.id,
            created_at: d.created_at,
            data: d.data
        })))

    } catch (error) {
        console.error('Erro ao carregar anamneses:', error)
    } finally {
        setLoading(false)
    }
  }

  const handleStartAnswering = (m: AnamnesisModel) => {
    if (isBlocked) {
        setErrorMessage('Sua conta está inativa. Contate seu personal para responder.')
        return
    }
    setAnsweringModel(m)
    setAnswers({})
  }

  const handleAnswerChange = (qId: string, value: any) => {
    setAnswers(prev => ({ ...prev, [qId]: value }))
  }

  const uploadPhoto = async (file: File): Promise<string | null> => {
      try {
          const fileExt = file.name.split('.').pop()
          const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`
          const filePath = `${user?.id}/${fileName}`

          const { error: uploadError } = await supabase.storage
               .from('anamnesis-files')
               .upload(filePath, file, {
                   cacheControl: '3600',
                   upsert: false
               })

          if (uploadError) throw uploadError

          const { data } = supabase.storage
              .from('anamnesis-files')
              .getPublicUrl(filePath)
          
          return data.publicUrl
      } catch (error: any) {
            console.error('Erro upload:', error)
            setErrorMessage(`Erro ao enviar imagem: ${error.message || 'Tente novamente'}`)
            return null
        }
  }

  const handleSubmit = async () => {
    if (!answeringModel || !user) return

    // Validação simples
    const missing = answeringModel.questions.filter(q => q.required && !answers[q.id])
    if (missing.length > 0) {
        setErrorMessage(`Por favor, responda as perguntas obrigatórias. Restam ${missing.length} perguntas.`)
        return
    }

    try {
        setSubmitting(true)
        
        const { error } = await supabase.from('protocols').insert({
            personal_id: answeringModel.personal_id,
            student_id: user.id,
            type: 'anamnesis',
            title: `Resposta: ${answeringModel.title}`,
            data: {
                modelId: answeringModel.id,
                answers: answers
            },
            starts_at: new Date().toISOString()
        })

        if (error) throw error

        await loadData() // Recarrega para atualizar histórico
        setAnsweringModel(null)
        setAnswers({})
        setShowSuccess(true) // Abre modal de sucesso

    } catch (err) {
        console.error(err)
        setErrorMessage('Ocorreu um erro ao enviar suas respostas. Tente novamente.')
    } finally {
        setSubmitting(false)
    }
  }

  const handleViewResponse = (r: AnamnesisResponse) => {
    // Tenta achar o modelo original para saber as perguntas
    // Se o modelo foi deletado, teremos apenas as respostas (idealmente salvar perguntas na resposta, mas vamos buscar do array models por enqto)
    // Na verdade, a estrutura salva apenas ID do modelo. Se o modelo mudar, a resposta fica desincronizada. 
    // O ideal seria snapshot, mas vamos tentar parear pelo ID.
    const model = models.find(m => m.id === r.data.modelId)
    setViewingResponse({ response: r, model })
  }

  const getDaysLeft = (endsAt?: string) => {
      if (!endsAt) return null
      const end = new Date(endsAt).getTime()
      const now = new Date().getTime()
      const diff = end - now
      const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
      return days
  }

  if (loading) return <div style={{ padding: 24 }}>Carregando anamneses...</div>

  return (
    <>
      <div style={{ padding: 24 }}>
        <header style={{ marginBottom: 32 }}>
            <h1 style={{ fontSize: '1.8rem', color: '#0f172a', marginBottom: 8 }}>Anamneses</h1>
            <p style={{ color: '#64748b' }}>Formulários pendentes e histórico de respostas.</p>
        </header>

        <div style={{ display: 'grid', gap: 40 }}>
            
            {/* Seção Pendentes / Disponíveis */}
            <section>
                <h2 style={{ fontSize: '1.2rem', color: '#0f172a', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ClipboardList size={20} /> Disponíveis para Responder
                </h2>
                
                {models.length === 0 ? (
                    <div style={{ padding: 24, background: '#f8fafc', borderRadius: 12, color: '#64748b', textAlign: 'center' }}>
                        Nenhum formulário atribuído a você no momento.
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                        {models.map(m => {
                            const days = getDaysLeft(m.ends_at)
                            let statusColor = '#64748b'
                            let statusText = ''
                            
                            // Verifica se já foi respondida
                            const hasResponse = responses.some(r => r.data.modelId === m.id)

                            if (hasResponse) {
                                statusColor = '#16a34a'
                                statusText = 'Respondida'
                            } else if (days !== null) {
                                if (days < 0) {
                                    statusColor = '#ef4444'
                                    statusText = `Vencida há ${Math.abs(days)} dias`
                                } else if (days === 0) {
                                    statusColor = '#f59e0b'
                                    statusText = 'Vence hoje!'
                                } else {
                                    statusColor = '#16a34a'
                                    statusText = `Vence em ${days} dias`
                                }
                            }

                            return (
                                <div key={m.id} style={{ background: '#fff', padding: 20, borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                                        <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>{m.title}</h3>
                                        {statusText && (
                                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: statusColor, background: `${statusColor}20`, padding: '4px 8px', borderRadius: 4 }}>
                                                {statusText}
                                            </span>
                                        )}
                                    </div>
                                    <p style={{ margin: '0 0 16px 0', color: '#64748b', fontSize: '0.9rem' }}>
                                        {m.questions.length} perguntas
                                    </p>
                                    <button 
                                        onClick={() => handleStartAnswering(m)}
                                        style={{ 
                                            background: '#0f172a', color: '#fff', border: 'none', padding: '10px 20px', 
                                            borderRadius: 8, fontWeight: 600, cursor: 'pointer', width: '100%',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                                        }}
                                    >
                                        Responder Agora <ChevronRight size={16} />
                                    </button>
                                </div>
                            )
                        })}
                    </div>
                )}
            </section>

            {/* Seção Histórico */}
            <section>
                <h2 style={{ fontSize: '1.2rem', color: '#0f172a', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Clock size={20} /> Histórico de Envios
                </h2>

                {responses.length === 0 ? (
                    <div style={{ padding: 24, background: '#f8fafc', borderRadius: 12, color: '#64748b', textAlign: 'center' }}>
                        Nenhuma resposta enviada ainda.
                    </div>
                ) : (
                    <div style={{ display: 'grid', gap: 12 }}>
                        {responses.map(r => (
                            <div 
                                key={r.id} 
                                onClick={() => handleViewResponse(r)}
                                style={{ 
                                    background: '#fff', padding: 16, borderRadius: 12, border: '1px solid #e2e8f0',
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    cursor: 'pointer'
                                }}
                            >
                                <div>
                                    <div style={{ fontWeight: 600, color: '#0f172a' }}>
                                        {models.find(m => m.id === r.data.modelId)?.title || 'Anamnese (Modelo removido)'}
                                    </div>
                                    <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: 4 }}>
                                        Enviado em {new Date(r.created_at).toLocaleDateString('pt-BR')} às {new Date(r.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </div>
                                <div style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.9rem', fontWeight: 600 }}>
                                    <CheckCircle size={16} /> Enviado
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

        </div>

        {/* Modal de Resposta */}
        {answeringModel && (
            <div style={{ 
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
                background: 'rgba(0,0,0,0.5)', zIndex: 2000, 
                display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 24
            }}>
                <div style={{ 
                    background: '#fff', width: '100%', maxWidth: 600, maxHeight: '90vh', 
                    borderRadius: 24, overflow: 'hidden', display: 'flex', flexDirection: 'column',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
                }}>
                    <div style={{ padding: '24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff' }}>
                        <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#0f172a' }}>{answeringModel.title}</h2>
                        <button onClick={() => setAnsweringModel(null)} style={{ background: '#f1f5f9', border: 'none', width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                            <X size={20} />
                        </button>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
                        <div style={{ display: 'grid', gap: 24 }}>
                            {answeringModel.questions.map((q, i) => (
                                <div key={q.id}>
                                    <label style={{ display: 'block', fontWeight: 600, color: '#334155', marginBottom: 8 }}>
                                        {i + 1}. {q.text} {q.required && <span style={{ color: '#ef4444' }}>*</span>}
                                    </label>
                                    
                                    {q.exampleImage && (
                                        <div style={{ marginBottom: 12 }}>
                                            <p style={{ margin: '0 0 4px 0', fontSize: '0.85rem', color: '#64748b' }}>Imagem de Referência:</p>
                                            <img 
                                                src={q.exampleImage} 
                                                alt="Referência" 
                                                style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 8, border: '1px solid #e2e8f0' }}
                                                onClick={() => window.open(q.exampleImage, '_blank')}
                                            />
                                        </div>
                                    )}
                                    
                                    {q.type === 'text' && (
                                        <textarea 
                                            value={answers[q.id] || ''}
                                            onChange={e => handleAnswerChange(q.id, e.target.value)}
                                            style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #cbd5e1', minHeight: 80, fontFamily: 'inherit' }}
                                            placeholder="Sua resposta..."
                                        />
                                    )}

                                    {q.type === 'number' && (
                                        <input 
                                            type="number"
                                            value={answers[q.id] || ''}
                                            onChange={e => handleAnswerChange(q.id, e.target.value)}
                                            style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #cbd5e1' }}
                                            placeholder="0"
                                        />
                                    )}

                                    {q.type === 'boolean' && (
                                        <div style={{ display: 'flex', gap: 16 }}>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                                                <input 
                                                    type="radio" 
                                                    name={q.id}
                                                    checked={answers[q.id] === 'Sim'}
                                                    onChange={() => handleAnswerChange(q.id, 'Sim')}
                                                /> Sim
                                            </label>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                                                <input 
                                                    type="radio" 
                                                    name={q.id}
                                                    checked={answers[q.id] === 'Não'}
                                                    onChange={() => handleAnswerChange(q.id, 'Não')}
                                                /> Não
                                            </label>
                                        </div>
                                    )}

                                    {(q.type === 'select' || q.type === 'multi') && q.options && (
                                        <select 
                                            value={answers[q.id] || ''}
                                            onChange={e => handleAnswerChange(q.id, e.target.value)}
                                            style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #cbd5e1' }}
                                        >
                                            <option value="">Selecione...</option>
                                            {q.options.map(opt => (
                                                <option key={opt} value={opt}>{opt}</option>
                                            ))}
                                        </select>
                                    )}

                                    {q.type === 'photo' && (
                                        <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8, border: '1px dashed #cbd5e1' }}>
                                            {answers[q.id] ? (
                                                <div style={{ position: 'relative', display: 'inline-block' }}>
                                                    <img 
                                                        src={answers[q.id]} 
                                                        alt="Upload preview" 
                                                        style={{ maxWidth: '100%', maxHeight: 300, borderRadius: 8 }} 
                                                    />
                                                    <button 
                                                        onClick={() => handleAnswerChange(q.id, null)}
                                                        style={{ 
                                                            position: 'absolute', top: 4, right: 4, 
                                                            background: 'transparent', color: '#ef4444', border: 'none', 
                                                            cursor: 'pointer', padding: 4,
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            filter: 'drop-shadow(0 0 2px rgba(255,255,255,0.8))'
                                                        }}
                                                        title="Remover foto"
                                                    >
                                                        <X size={28} strokeWidth={3} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <input 
                                                    type="file" 
                                                    accept="image/*,.heic,.heif"
                                                    onChange={async (e) => {
                                                        const file = e.target.files?.[0]
                                                        if (file) {
                                                            const url = await uploadPhoto(file)
                                                            if (url) handleAnswerChange(q.id, url)
                                                        }
                                                    }}
                                                    style={{ width: '100%' }}
                                                />
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div style={{ padding: 24, borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                        <button onClick={() => setAnsweringModel(null)} style={{ padding: '12px 24px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontWeight: 600 }}>
                            Cancelar
                        </button>
                        <button 
                            onClick={handleSubmit}
                            disabled={submitting}
                            style={{ 
                                padding: '12px 24px', borderRadius: 8, border: 'none', background: '#0f172a', color: '#fff', 
                                cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8,
                                opacity: submitting ? 0.7 : 1
                            }}
                        >
                            <Save size={18} /> {submitting ? 'Enviando...' : 'Enviar Respostas'}
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Modal de Visualização */}
        {viewingResponse && (
            <div style={{ 
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
                background: 'rgba(0,0,0,0.5)', zIndex: 2000, 
                display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 24
            }} onClick={() => setViewingResponse(null)}>
                <div 
                    onClick={e => e.stopPropagation()}
                    style={{ 
                        background: '#fff', width: '100%', maxWidth: 600, maxHeight: '90vh', 
                        borderRadius: 24, overflow: 'hidden', display: 'flex', flexDirection: 'column',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
                    }}
                >
                    <div style={{ padding: '24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff' }}>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#0f172a' }}>Respostas Enviadas</h2>
                            <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '0.9rem' }}>
                                {new Date(viewingResponse.response.created_at).toLocaleDateString('pt-BR')}
                            </p>
                        </div>
                        <button onClick={() => setViewingResponse(null)} style={{ background: '#f1f5f9', border: 'none', width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                            <X size={20} />
                        </button>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
                        <div style={{ display: 'grid', gap: 24 }}>
                            {viewingResponse.model ? viewingResponse.model.questions.map((q, i) => (
                                <div key={q.id} style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: 16 }}>
                                    <div style={{ fontWeight: 600, color: '#334155', marginBottom: 8 }}>
                                        {q.text}
                                    </div>
                                    <div style={{ color: '#0f172a', background: '#f8fafc', padding: 12, borderRadius: 8 }}>
                                        {q.type === 'photo' && viewingResponse.response.data.answers[q.id] ? (
                                            <img 
                                                src={viewingResponse.response.data.answers[q.id]} 
                                                alt="Foto enviada"
                                                style={{ maxWidth: '100%', maxHeight: 400, borderRadius: 8 }}
                                                onClick={() => window.open(viewingResponse.response.data.answers[q.id], '_blank')}
                                            />
                                        ) : (
                                            String(viewingResponse.response.data.answers[q.id] || '-')
                                        )}
                                    </div>
                                </div>
                            )) : (
                                <div style={{ color: '#64748b' }}>
                                    O modelo original deste formulário não está mais disponível. <br/>
                                    Dados brutos:
                                    <pre style={{ background: '#f1f5f9', padding: 12, borderRadius: 8, marginTop: 12, overflowX: 'auto' }}>
                                        {JSON.stringify(viewingResponse.response.data.answers, null, 2)}
                                    </pre>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* Modal de Sucesso */}
        <Modal
            isOpen={showSuccess}
            onClose={() => setShowSuccess(false)}
            title="Sucesso!"
            type="success"
            footer={
                <button 
                    onClick={() => setShowSuccess(false)}
                    style={{
                        background: '#16a34a', color: '#fff', border: 'none',
                        padding: '10px 24px', borderRadius: 8, fontWeight: 600, cursor: 'pointer'
                    }}
                >
                    Entendido
                </button>
            }
        >
            <div style={{ textAlign: 'center', padding: 20 }}>
                <div style={{ background: '#dcfce7', width: 80, height: 80, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto' }}>
                    <CheckCircle size={48} color="#16a34a" />
                </div>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '1.25rem', color: '#166534' }}>Anamnese Enviada!</h3>
                <p style={{ color: '#64748b', fontSize: '1rem', lineHeight: 1.5 }}>
                    Obrigado por responder. Seu personal trainer já tem acesso às suas respostas e fotos atualizadas.
                </p>
            </div>
        </Modal>

        {/* Modal de Erro / Validação */}
        <Modal
            isOpen={!!errorMessage}
            onClose={() => setErrorMessage(null)}
            title="Atenção"
            type="danger"
            footer={
                <button 
                    onClick={() => setErrorMessage(null)}
                    style={{
                        background: '#ef4444', color: '#fff', border: 'none',
                        padding: '10px 24px', borderRadius: 8, fontWeight: 600, cursor: 'pointer'
                    }}
                >
                    Fechar
                </button>
            }
        >
            <div style={{ textAlign: 'center', padding: 20 }}>
                <div style={{ background: '#fee2e2', width: 64, height: 64, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto' }}>
                    <AlertCircle size={32} color="#dc2626" />
                </div>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '1.1rem', color: '#991b1b' }}>Algo precisa de atenção</h3>
                <p style={{ color: '#b91c1c', fontSize: '1rem' }}>
                    {errorMessage}
                </p>
            </div>
        </Modal>

      </div>
    </>
  )
}
