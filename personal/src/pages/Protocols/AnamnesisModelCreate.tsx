import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { addModel, updateModel, getModelById, deleteModel, type AnamnesisQuestion } from '../../store/anamnesis'

export default function AnamnesisModelCreate() {
  const { id } = useParams()
  const navigate = useNavigate()
  
  const [personalId, setPersonalId] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  
  const [name, setName] = useState('')
  const [goal, setGoal] = useState('')
  const [questions, setQuestions] = useState<AnamnesisQuestion[]>([])
  
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) setPersonalId(user.id)
        
        if (id) {
            const m = await getModelById(id)
            if (m) {
                setEditId(m.id)
                setName(m.name)
                setGoal(m.goal || '')
                setQuestions(m.questions || [])
            }
        }
        setLoading(false)
    }
    load()
  }, [id])

  const addQuestion = () => {
      setQuestions([...questions, {
          id: crypto.randomUUID(),
          text: '',
          type: 'text',
          required: false
      }])
  }

  const updateQuestion = (idx: number, patch: Partial<AnamnesisQuestion>) => {
      const next = questions.slice()
      next[idx] = { ...next[idx], ...patch }
      setQuestions(next)
  }

  const removeQuestion = (idx: number) => {
      setQuestions(questions.filter((_, i) => i !== idx))
  }

  const handleImageUpload = (qIdx: number, file: File) => {
      const reader = new FileReader()
      reader.onload = (e) => {
          const base64 = e.target?.result as string
          updateQuestion(qIdx, { exampleImage: base64 })
      }
      reader.readAsDataURL(file)
  }

  const save = async () => {
      if (!name.trim()) {
          setMsg('Nome do modelo é obrigatório')
          return
      }
      setLoading(true)
      try {
          if (editId) {
              await updateModel(editId, { name, goal, questions })
              setMsg('Modelo atualizado com sucesso!')
          } else {
              const rec = await addModel({
                  personalId,
                  name,
                  goal,
                  questions
              })
              if (rec) {
                  setMsg('Modelo criado com sucesso!')
                  if (!editId) {
                      setName('')
                      setGoal('')
                      setQuestions([])
                  }
              }
          }
      } catch (err) {
          console.error(err)
          setMsg('Erro ao salvar modelo')
      } finally {
          setLoading(false)
      }
  }

  if (loading) return <div>Carregando...</div>

  return (
    <div style={{ maxWidth: 860 }}>
      <h1>Protocolos • {editId ? 'Editar Modelo de Anamnese' : 'Criar Modelo de Anamnese'}</h1>
      
      <div className="form-card">
        <div className="form-title">Dados do Modelo</div>
        <div className="form-grid">
            <label className="label">
                Nome do Modelo
                <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Anamnese Inicial" />
            </label>
            <label className="label">
                Objetivo
                <input className="input" value={goal} onChange={e => setGoal(e.target.value)} placeholder="Ex: Conhecer histórico de saúde" />
            </label>
        </div>

        <div className="form-section">
            <div className="form-title">Perguntas</div>
            <div className="form-actions" style={{ marginBottom: 10 }}>
                <button className="btn" onClick={addQuestion}>+ Adicionar Pergunta</button>
            </div>
            
            <div style={{ display: 'grid', gap: 12 }}>
                {questions.map((q, idx) => (
                    <div key={q.id} className="form-card" style={{ padding: 12, border: '1px solid #e5e7eb' }}>
                        <div className="form-grid" style={{ gridTemplateColumns: '3fr 1fr 1fr auto' }}>
                            <label className="label">
                                Pergunta
                                <input className="input" value={q.text} onChange={e => updateQuestion(idx, { text: e.target.value })} />
                            </label>
                            <label className="label">
                                Tipo
                                <select className="select" value={q.type} onChange={e => updateQuestion(idx, { type: e.target.value as any })}>
                                    <option value="text">Texto Curto</option>
                                    <option value="number">Número</option>
                                    <option value="boolean">Sim/Não</option>
                                    <option value="select">Seleção Única</option>
                                    <option value="multi">Múltipla Seleção</option>
                                    <option value="photo">Foto</option>
                                </select>
                            </label>
                            <label className="label" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 24 }}>
                                <input type="checkbox" checked={q.required} onChange={e => updateQuestion(idx, { required: e.target.checked })} />
                                Obrigatória
                            </label>
                            <button className="btn" style={{ background: '#ef4444', marginTop: 24 }} onClick={() => removeQuestion(idx)}>X</button>
                        </div>
                        
                        {(q.type === 'select' || q.type === 'multi') && (
                            <div style={{ marginTop: 8 }}>
                                <label className="label">
                                    Opções (separadas por vírgula)
                                    <input 
                                        className="input" 
                                        value={q.options?.join(', ') || ''} 
                                        onChange={e => updateQuestion(idx, { options: e.target.value.split(',').map(s => s.trim()) })} 
                                        placeholder="Opção 1, Opção 2, Opção 3"
                                    />
                                </label>
                            </div>
                        )}

                        {q.type === 'photo' && (
                            <div style={{ marginTop: 10, background: '#f9fafb', padding: 10, borderRadius: 8, border: '1px dashed #ccc' }}>
                                <label className="label" style={{ marginBottom: 8, display: 'block' }}>Imagem de Exemplo (Opcional)</label>
                                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                    <input type="file" accept="image/*" onChange={e => e.target.files?.[0] && handleImageUpload(idx, e.target.files[0])} />
                                    {q.exampleImage && (
                                        <div style={{ position: 'relative' }}>
                                            <img src={q.exampleImage} alt="Exemplo" style={{ height: 80, borderRadius: 4, border: '1px solid #ccc', objectFit: 'contain', background: '#fff' }} />
                                            <button 
                                                onClick={() => updateQuestion(idx, { exampleImage: undefined })}
                                                style={{ position: 'absolute', top: -8, right: -8, background: 'red', color: 'white', borderRadius: '50%', width: 20, height: 20, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8em', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}
                                            >✕</button>
                                        </div>
                                    )}
                                </div>
                                <div style={{ fontSize: '0.85em', color: '#666', marginTop: 6, fontStyle: 'italic' }}>
                                    Dica: Envie uma foto de referência (ex: frente, costas, perfil) para ajudar o aluno a tirar a foto corretamente.
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>

        {msg && <div className="form-success">{msg}</div>}
        <div className="form-actions">
            <button className="btn" onClick={save}>Salvar Modelo</button>
            <button className="btn" style={{ background: '#e5e7eb', color: '#000' }} onClick={() => navigate('/protocols/anamnesis-models')}>Voltar</button>
        </div>
      </div>
    </div>
  )
}