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
  renew_in_days?: number
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
            data: d.data,
            renew_in_days: d.renew_in_days
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
                            const modelResponses = responses.filter(r => r.data.modelId === m.id)
                            const lastResponse = modelResponses[0] // responses are ordered by created_at desc

                            if (lastResponse) {
                                // Lógica de Projeção Mensal se respondida
                                if (m.ends_at) {
                                    let nextDueDate = new Date(m.ends_at)
                                    const now = new Date()

                                    // Se já venceu, projeta para o próximo mês
                                    while (nextDueDate < now) {
                                        nextDueDate.setMonth(nextDueDate.getMonth() + 1)
                                    }

                                    const diff = nextDueDate.getTime() - now.getTime()
                                    const daysLeft = Math.ceil(diff / (1000 * 60 * 60 * 24))
                                    
                                    statusColor = '#16a34a'
                                    statusText = `Vence em ${daysLeft} dias`
                                } else {
                                    statusColor = '#16a34a'
                                    statusText = 'Respondida'
                                }
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
                background: 'rgba(0,0,0,0.6)', zIndex: 2000, 
                display: 'flex', justifyContent: 'center', alignItems: 'flex-end', // Mobile first: sheet bottom
                backdropFilter: 'blur(4px)'
            }}>
                <div style={{ 
                    background: '#fff', width: '100%', maxWidth: 600, height: '95vh', // Quase tela cheia no mobile
                    borderTopLeftRadius: 24, borderTopRightRadius: 24, 
                    // Em desktop pode ser centralizado e menor, mas vamos focar na experiencia mobile aqui
                    // Vamos usar media query inline style hack ou apenas manter responsivo fluido
                    display: 'flex', flexDirection: 'column',
                    boxShadow: '0 -10px 40px rgba(0,0,0,0.2)',
                    animation: 'slideUp 0.3s ease-out'
                }}>
                    <style>{`
                        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
                        @media (min-width: 640px) {
                            div[style*="height: 95vh"] {
                                height: auto; maxHeight: 90vh;
                                border-radius: 24px;
                                align-self: center;
                            }
                        }
                    `}</style>

                    <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff' }}>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#0f172a', lineHeight: 1.2 }}>{answeringModel.title}</h2>
                            <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '0.85rem' }}>Preencha com atenção</p>
                        </div>
                        <button onClick={() => setAnsweringModel(null)} style={{ background: '#f1f5f9', border: 'none', width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}>
                            <X size={24} />
                        </button>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', padding: '24px 24px 40px 24px', background: '#fff' }}>
                        <div style={{ display: 'grid', gap: 32 }}>
                            {answeringModel.questions.map((q, i) => (
                                <div key={q.id} style={{ animation: `fadeIn 0.5s ease-out ${i * 0.05}s both` }}>
                                    <label style={{ display: 'block', fontWeight: 700, color: '#1e293b', marginBottom: 12, fontSize: '1rem', lineHeight: 1.4 }}>
                                        <span style={{ color: '#94a3b8', marginRight: 8, fontSize: '0.9rem' }}>{i + 1}.</span>
                                        {q.text} {q.required && <span style={{ color: '#ef4444', marginLeft: 4 }}>*</span>}
                                    </label>
                                    
                                    {q.exampleImage && (
                                        <div style={{ marginBottom: 16, borderRadius: 12, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                                            <div style={{ background: '#f8fafc', padding: '8px 12px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <AlertCircle size={14} color="#64748b" />
                                                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Exemplo</span>
                                            </div>
                                            <img 
                                                src={q.exampleImage} 
                                                alt="Referência" 
                                                style={{ width: '100%', maxHeight: 250, objectFit: 'contain', display: 'block', background: '#000' }}
                                                onClick={() => window.open(q.exampleImage, '_blank')}
                                            />
                                        </div>
                                    )}
                                    
                                    {q.type === 'text' && (
                                        <textarea 
                                            value={answers[q.id] || ''}
                                            onChange={e => handleAnswerChange(q.id, e.target.value)}
                                            style={{ 
                                                width: '100%', padding: 16, borderRadius: 12, border: '1px solid #cbd5e1', 
                                                minHeight: 120, fontFamily: 'inherit', fontSize: '16px', lineHeight: '1.5',
                                                backgroundColor: '#f8fafc', color: '#334155', resize: 'vertical'
                                            }}
                                            placeholder="Digite sua resposta aqui..."
                                        />
                                    )}

                                    {q.type === 'number' && (
                                        <input 
                                            type="number"
                                            value={answers[q.id] || ''}
                                            onChange={e => handleAnswerChange(q.id, e.target.value)}
                                            style={{ 
                                                width: '100%', padding: 16, borderRadius: 12, border: '1px solid #cbd5e1',
                                                fontSize: '16px', backgroundColor: '#f8fafc', color: '#334155'
                                            }}
                                            placeholder="0"
                                        />
                                    )}

                                    {q.type === 'boolean' && (
                                        <div style={{ display: 'flex', gap: 12 }}>
                                            {['Sim', 'Não'].map(opt => {
                                                const isSelected = answers[q.id] === opt
                                                return (
                                                    <button
                                                        key={opt}
                                                        type="button" // Previne submit acidental
                                                        onClick={() => handleAnswerChange(q.id, opt)}
                                                        style={{
                                                            flex: 1, padding: '14px', borderRadius: 12, fontSize: '16px', fontWeight: 600,
                                                            border: isSelected ? '2px solid #0f172a' : '1px solid #e2e8f0',
                                                            background: isSelected ? '#0f172a' : '#fff',
                                                            color: isSelected ? '#fff' : '#64748b',
                                                            cursor: 'pointer', transition: 'all 0.2s'
                                                        }}
                                                    >
                                                        {opt}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    )}

                                    {(q.type === 'select' || q.type === 'multi') && q.options && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                            <select 
                                                value={answers[q.id] || ''}
                                                onChange={e => handleAnswerChange(q.id, e.target.value)}
                                                style={{ 
                                                    width: '100%', padding: 16, borderRadius: 12, border: '1px solid #cbd5e1',
                                                    fontSize: '16px', backgroundColor: '#f8fafc', color: '#334155',
                                                    appearance: 'none', backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23007CB2%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")',
                                                    backgroundRepeat: 'no-repeat', backgroundPosition: 'right 16px top 50%', backgroundSize: '12px auto'
                                                }}
                                            >
                                                <option value="">Selecione uma opção...</option>
                                                {q.options.map(opt => (
                                                    <option key={opt} value={opt}>{opt}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    {q.type === 'photo' && (
                                        <div style={{ background: '#f8fafc', padding: 20, borderRadius: 16, border: '2px dashed #cbd5e1', textAlign: 'center' }}>
                                            {answers[q.id] ? (
                                                <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
                                                    <img 
                                                        src={answers[q.id]} 
                                                        alt="Upload preview" 
                                                        style={{ width: '100%', maxHeight: 350, objectFit: 'cover', borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} 
                                                    />
                                                    <button 
                                                        onClick={() => handleAnswerChange(q.id, null)}
                                                        style={{ 
                                                            position: 'absolute', top: 12, right: 12, 
                                                            background: 'rgba(255,255,255,0.9)', color: '#ef4444', border: 'none', 
                                                            cursor: 'pointer', padding: 8, borderRadius: '50%',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                                                        }}
                                                        title="Remover foto"
                                                    >
                                                        <X size={20} strokeWidth={2.5} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, cursor: 'pointer', padding: '20px 0' }}>
                                                    <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                                                        <ClipboardList size={28} />
                                                    </div>
                                                    <div>
                                                        <span style={{ display: 'block', fontSize: '1rem', fontWeight: 600, color: '#334155' }}>Toque para enviar foto</span>
                                                        <span style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8' }}>JPG, PNG ou HEIC</span>
                                                    </div>
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
                                                        style={{ display: 'none' }}
                                                    />
                                                </label>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div style={{ 
                        padding: '20px 24px', borderTop: '1px solid #f1f5f9', background: '#fff', 
                        display: 'flex', justifyContent: 'space-between', gap: 16,
                        boxShadow: '0 -4px 20px rgba(0,0,0,0.05)'
                    }}>
                        <button onClick={() => setAnsweringModel(null)} style={{ padding: '16px', borderRadius: 12, border: 'none', background: '#f1f5f9', color: '#64748b', cursor: 'pointer', fontWeight: 600, fontSize: '1rem' }}>
                            Cancelar
                        </button>
                        <button 
                            onClick={handleSubmit}
                            disabled={submitting}
                            style={{ 
                                flex: 1,
                                padding: '16px', borderRadius: 12, border: 'none', background: '#0f172a', color: '#fff', 
                                cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                                fontSize: '1rem', opacity: submitting ? 0.7 : 1,
                                boxShadow: '0 4px 12px rgba(15, 23, 42, 0.2)'
                            }}
                        >
                            <Save size={20} /> {submitting ? 'Enviando...' : 'Enviar Respostas'}
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
