import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { ArrowLeft, Calendar, User } from 'lucide-react'

export default function ViewAnamnesis() {
    const { id } = useParams()
    const navigate = useNavigate()
    const [data, setData] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [marking, setMarking] = useState(false)

    useEffect(() => {
        if (!id) return
        load()
    }, [id])

    async function load() {
        try {
            // 1. Busca a anamnese pura (sem join complexo)
            const { data: protocol, error } = await supabase
                .from('protocols')
                .select('*')
                .eq('id', id)
                .single()
            
            if (error) {
                console.error('Erro Supabase:', error)
                throw error
            }

            // 2. Busca o nome do aluno
            let studentName = 'Aluno'
            if (protocol.student_id) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('full_name')
                    .eq('id', protocol.student_id)
                    .single()
                if (profile) studentName = profile.full_name
            }

            // 3. SE as perguntas não estiverem salvas na resposta, tenta buscar do modelo original
            let finalProtocol = { ...protocol }
            const content = protocol.content || protocol.data || {} // Tenta 'content' ou 'data'
            
            // Normaliza para sempre usar 'content' no estado
            finalProtocol.content = content

            if (!content.questions && content.modelId) {
                console.log('Perguntas não encontradas na resposta. Buscando modelo original:', content.modelId)
                const { data: model, error: modelError } = await supabase
                    .from('protocols')
                    .select('*') // Busca tudo
                    .eq('id', content.modelId)
                    .single()
                
                if (modelError) console.error('Erro ao buscar modelo original:', modelError)

                if (model) {
                    const modelData = model.content || model.data || {}
                    console.log('Dados do modelo recuperado:', modelData)
                    
                    if (modelData.questions) {
                        console.log('Perguntas recuperadas do modelo:', modelData.questions.length)
                        finalProtocol.content.questions = modelData.questions
                    } else {
                        console.warn('Modelo encontrado, mas não possui campo questions no JSON.')
                    }
                }
            }
            
            console.log('Protocolo Final:', finalProtocol)

            // Monta o objeto final
            setData({ ...finalProtocol, profiles: { full_name: studentName } })

        } catch (err: any) {
            console.error(err)
            // Mostra o erro real na tela se possível, ou alerta genérico
            alert(`Erro ao carregar: ${err.message || 'Tente novamente'}`)
        } finally {
            setLoading(false)
        }
    }

    const handleMarkAsReviewed = async () => {
        if (!confirm('Marcar esta anamnese como analisada/concluída?')) return
        setMarking(true)
        try {
            const currentData = data.content || {}
            const newData = { ...currentData, reviewed_at: new Date().toISOString() }
            
            const { error } = await supabase
                .from('protocols')
                .update({ 
                    data: newData,
                    content: newData 
                })
                .eq('id', id)

            if (error) throw error

            alert('Anamnese marcada como concluída!')
            navigate(-1) // Volta para a lista
        } catch (err: any) {
            alert('Erro: ' + err.message)
        } finally {
            setMarking(false)
        }
    }

    if (loading) return <div style={{ padding: 20 }}>Carregando...</div>
    if (!data) return <div style={{ padding: 20 }}>Anamnese não encontrada.</div>

    const content = data.content || {}
    // Adaptação para diferentes estruturas de dados
    const questions = Array.isArray(content) ? content : (content.questions || [])
    const answers = content.answers || {}
    const isReviewed = !!content.reviewed_at

    // Se questions estiver vazio, pode ser que o conteúdo seja apenas respostas chave-valor
    const hasQuestions = questions.length > 0

    return (
        <div style={{ maxWidth: 800, margin: '0 auto', padding: '20px', paddingBottom: 100 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <button 
                    onClick={() => navigate(-1)} 
                    style={{ 
                        display: 'flex', alignItems: 'center', gap: 8, 
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: '#64748b', fontWeight: 600 
                    }}
                >
                    <ArrowLeft size={20} /> Voltar
                </button>

                {!isReviewed && (
                    <button 
                        onClick={handleMarkAsReviewed}
                        disabled={marking}
                        className="btn"
                        style={{ 
                            background: '#16a34a', color: '#fff', border: 'none', 
                            padding: '10px 20px', borderRadius: 8, fontWeight: 600,
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                            boxShadow: '0 4px 6px -1px rgba(22, 163, 74, 0.3)'
                        }}
                    >
                        {marking ? 'Salvando...' : '✅ Marcar como Concluída'}
                    </button>
                )}
            </div>

            <div style={{ background: '#fff', borderRadius: 12, padding: 32, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: 20, marginBottom: 24 }}>
                    <h1 style={{ margin: '0 0 12px 0', fontSize: '1.8rem', color: '#0f172a' }}>Resposta: {data.title}</h1>
                    <div style={{ display: 'flex', gap: 24, color: '#64748b', fontSize: '0.95rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Calendar size={18} />
                            {new Date(data.created_at).toLocaleDateString('pt-BR')} às {new Date(data.created_at).toLocaleTimeString('pt-BR')}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <User size={18} />
                            {data.profiles?.full_name || 'Aluno'}
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    {!hasQuestions && Object.keys(answers).length === 0 && (
                        <div style={{ padding: 20, background: '#f8fafc', borderRadius: 8, color: '#64748b' }}>
                            Sem conteúdo visualizável.
                            <br/><br/>
                            <details>
                                <summary>Dados Brutos (Debug)</summary>
                                <pre>{JSON.stringify(content, null, 2)}</pre>
                            </details>
                        </div>
                    )}

                    {hasQuestions ? (
                        questions.map((q: any, index: number) => {
                            // Se questions for array direto de perguntas respondidas
                            const questionText = q.text || q.question || `Pergunta ${index + 1}`
                            // Tenta pegar resposta do objeto answers OU do próprio objeto q (se estiver embutido)
                            const answer = answers[q.id] || q.answer || q.value

                            return (
                                <div key={q.id || index} style={{ background: '#f8fafc', padding: 20, borderRadius: 8, border: '1px solid #f1f5f9' }}>
                                    <div style={{ fontWeight: 600, color: '#334155', marginBottom: 12, fontSize: '1.05rem' }}>
                                        {index + 1}. {questionText}
                                    </div>
                                    
                                    {q.type === 'photo' ? (
                                        answer ? (
                                            <div style={{ marginTop: 8 }}>
                                                <img 
                                                    src={answer} 
                                                    alt="Resposta" 
                                                    style={{ maxWidth: '100%', maxHeight: 400, borderRadius: 8, border: '1px solid #e2e8f0' }} 
                                                />
                                            </div>
                                        ) : (
                                            <div style={{ color: '#94a3b8', fontStyle: 'italic' }}>Sem foto enviada.</div>
                                        )
                                    ) : (
                                        <div style={{ 
                                            color: '#0f172a', fontSize: '1rem', lineHeight: 1.6,
                                            background: '#fff', padding: 12, borderRadius: 6, border: '1px solid #e2e8f0'
                                        }}>
                                            {Array.isArray(answer) ? answer.join(', ') : (answer ? String(answer) : <span style={{ color: '#94a3b8' }}>Sem resposta</span>)}
                                        </div>
                                    )}
                                </div>
                            )
                        })
                    ) : (
                        // Fallback melhorado para exibir imagens mesmo sem perguntas
                        Object.entries(answers).map(([key, value]: any, index) => {
                             // Tenta achar a pergunta se conseguimos carregar parcialmente
                             const q = questions.find((x: any) => x.id === key)
                             const label = q ? q.text : `Pergunta ${index + 1} (ID: ${key.substring(0, 8)}...)`
                             
                             const isImage = typeof value === 'string' && (value.includes('/storage/v1/object/') || value.match(/\.(jpeg|jpg|gif|png|webp)$/i))

                             return (
                                <div key={key} style={{ background: '#f8fafc', padding: 20, borderRadius: 8, border: '1px solid #f1f5f9' }}>
                                    <div style={{ fontWeight: 600, color: '#334155', marginBottom: 12, fontSize: '1.05rem' }}>
                                        {label}
                                    </div>
                                    
                                    {isImage ? (
                                        <div style={{ marginTop: 8 }}>
                                            <img 
                                                src={value} 
                                                alt="Resposta Visual"
                                                style={{ maxWidth: '100%', maxHeight: 400, borderRadius: 8, border: '1px solid #e2e8f0', cursor: 'pointer' }}
                                                onClick={() => window.open(value, '_blank')}
                                            />
                                        </div>
                                    ) : (
                                        <div style={{ color: '#0f172a', whiteSpace: 'pre-wrap' }}>
                                            {Array.isArray(value) ? value.join(', ') : String(value)}
                                        </div>
                                    )}
                                </div>
                             )
                        })
                    )}
                </div>
            </div>
        </div>
    )
}
