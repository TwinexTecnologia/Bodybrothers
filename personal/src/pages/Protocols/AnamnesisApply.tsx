import { useEffect, useMemo, useState } from 'react'
import { listModels, getModelById, addResponse, listResponsesByStudent, type AnamnesisModel, type AnamnesisQuestion, type AnamnesisResponse } from '../../store/anamnesis'
import { listStudentsByPersonal, type StudentRecord } from '../../store/students'
import { supabase } from '../../lib/supabase'
import { useSearchParams } from 'react-router-dom'

export default function AnamnesisApply() {
  const [searchParams] = useSearchParams()
  const [students, setStudents] = useState<StudentRecord[]>([])
  const [models, setModels] = useState<AnamnesisModel[]>([])
  const [studentId, setStudentId] = useState('')
  const [modelId, setModelId] = useState('')
  const [answers, setAnswers] = useState<Record<string, string | string[] | boolean | number>>({})
  const [customDrafts, setCustomDrafts] = useState<Record<string, string>>({})
  const [renewEveryDays, setRenewEveryDays] = useState<number>(0)
  const [countFromDate, setCountFromDate] = useState<string>('')
  const [msg, setMsg] = useState('')
  
  const [currentModel, setCurrentModel] = useState<AnamnesisModel | null>(null)
  const [responses, setResponses] = useState<AnamnesisResponse[]>([])
  
  const [personalId, setPersonalId] = useState('')
  const [loading, setLoading] = useState(true)

  async function loadInitialData() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
        setPersonalId(user.id)
        const sList = await listStudentsByPersonal(user.id)
        const mList = await listModels(user.id)
        setStudents(sList)
        setModels(mList)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadInitialData()
  }, [])

  useEffect(() => {
    const sid = searchParams.get('studentId')
    if (sid) setStudentId(sid)
  }, [searchParams])

  // Carrega modelo selecionado
  useEffect(() => {
      if (!modelId) {
          setCurrentModel(null)
          return
      }
      getModelById(modelId).then(m => setCurrentModel(m || null))
  }, [modelId])

  // Carrega respostas do aluno
  useEffect(() => {
      if (!personalId || !studentId) {
          setResponses([])
          return
      }
      listResponsesByStudent(personalId, studentId).then(setResponses)
  }, [personalId, studentId])

  const setAnswer = (q: AnamnesisQuestion, value: string | string[] | boolean | number) => {
    setAnswers({ ...answers, [q.id]: value })
  }

  const canSave = useMemo(() => {
    if (!studentId || !currentModel) return false
    for (const q of currentModel.questions) {
      if (q.required) {
        const v = answers[q.id]
        if (v === undefined || v === '' || (Array.isArray(v) && v.length === 0)) return false
      }
    }
    return true
  }, [studentId, currentModel, answers])

  const save = async () => {
    if (!studentId || !currentModel) return
    let dueDate: string | undefined = undefined
    if (renewEveryDays && countFromDate) {
      const d = new Date(countFromDate)
      if (!isNaN(d.getTime())) {
        const dd = new Date(d)
        dd.setDate(dd.getDate() + Math.max(0, renewEveryDays))
        dueDate = dd.toISOString()
      }
    }
    
    await addResponse({ personalId, studentId, modelId: currentModel.id, answers, renewEveryDays, countFromDate: countFromDate || undefined, dueDate })
    
    setMsg('Anamnese registrada com sucesso!')
    setAnswers({})
    setRenewEveryDays(0)
    setCountFromDate('')
    
    // Atualiza lista
    listResponsesByStudent(personalId, studentId).then(setResponses)
  }

  // Helper para buscar nome do modelo na lista (evita request extra)
  const getModelName = (id: string) => models.find(m => m.id === id)?.name || 'Modelo desconhecido'

  if (loading) return <div>Carregando...</div>

  return (
    <div>
      <h1>Protocolos • Aplicar Anamnese em um Aluno</h1>
      <div className="form-card" style={{ padding: 12 }}>
        <div className="form-grid">
          <label className="label">
            Aluno
            <select className="select" value={studentId} onChange={(e) => { setStudentId(e.target.value); setAnswers({}); setCustomDrafts({}); setRenewEveryDays(0); setCountFromDate('') }}>
              <option value="">Selecione um aluno</option>
              {students.map(s => <option key={s.id} value={s.id}>{s.name} • {s.email}</option>)}
            </select>
          </label>
          <label className="label">
            Modelo de anamnese
            <select className="select" value={modelId} onChange={(e) => { setModelId(e.target.value); setAnswers({}); setCustomDrafts({}); setRenewEveryDays(0); setCountFromDate('') }}>
              <option value="">Selecione um modelo</option>
              {models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </label>
        </div>
      </div>

      <div className="form-card" style={{ padding: 12, marginTop: 10 }}>
        <div className="form-grid">
          <label className="label">
            Prazo de renovação (dias)
            <input className="input" type="number" min={0} value={renewEveryDays || 0} onChange={(e) => setRenewEveryDays(Number(e.target.value) || 0)} />
          </label>
          <label className="label">
            Contar a partir de
            <input className="input" type="date" value={countFromDate} onChange={(e) => setCountFromDate(e.target.value)} />
          </label>
        </div>
      </div>

      {currentModel && (
        <div className="form-card" style={{ padding: 12, marginTop: 10 }}>
          <div className="form-title">{currentModel.name}</div>
          <div className="form-grid" style={{ gridTemplateColumns: '1fr', gap: 10 }}>
            {currentModel.questions.map(q => (
              <label key={q.id} className="label">
                {q.text}
                {q.type === 'text' && (
                  <input className="input" value={String(answers[q.id] || '')} onChange={(e) => setAnswer(q, e.target.value)} />
                )}
                {q.type === 'number' && (
                  <input className="input" type="number" value={Number(answers[q.id] || 0) || ''} onChange={(e) => setAnswer(q, Number(e.target.value))} />
                )}
                {q.type === 'boolean' && (
                  <select className="select" value={String(Boolean(answers[q.id]))} onChange={(e) => setAnswer(q, e.target.value === 'true')}>
                    <option value="false">Não</option>
                    <option value="true">Sim</option>
                  </select>
                )}
                {q.type === 'select' && (
                  <select className="select" value={String(answers[q.id] || '')} onChange={(e) => setAnswer(q, e.target.value)}>
                    <option value="">Selecione</option>
                    {(q.options || []).map(op => <option key={op} value={op}>{op}</option>)}
                  </select>
                )}
                {q.type === 'multi' && (
                  <div style={{ display: 'grid', gap: 6 }}>
                    {(q.options || []).map(op => {
                      const arr = Array.isArray(answers[q.id]) ? (answers[q.id] as string[]) : []
                      const checked = arr.includes(op)
                      return (
                        <label key={op} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <input type="checkbox" checked={checked} onChange={(e) => {
                            const next = new Set(arr)
                            if (e.target.checked) next.add(op); else next.delete(op)
                            setAnswer(q, Array.from(next))
                          }} />
                          <span>{op}</span>
                        </label>
                      )
                    })}
                    {q.allowCustom && (
                      <div style={{ display: 'grid', gap: 6, marginTop: 6 }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <input
                            className="input"
                            placeholder="Adicionar item"
                            value={customDrafts[q.id] || ''}
                            onChange={(e) => setCustomDrafts({ ...customDrafts, [q.id]: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const v = (customDrafts[q.id] || '').trim()
                                const arr = Array.isArray(answers[q.id]) ? (answers[q.id] as string[]) : []
                                if (v) {
                                  setAnswer(q, [...arr, v])
                                  setCustomDrafts({ ...customDrafts, [q.id]: '' })
                                }
                              }
                            }}
                          />
                          <button
                            className="btn"
                            onClick={() => {
                              const v = (customDrafts[q.id] || '').trim()
                              const arr = Array.isArray(answers[q.id]) ? (answers[q.id] as string[]) : []
                              if (v) {
                                setAnswer(q, [...arr, v])
                                setCustomDrafts({ ...customDrafts, [q.id]: '' })
                              }
                            }}
                          >Adicionar</button>
                        </div>
                        {(() => {
                          const arr = Array.isArray(answers[q.id]) ? (answers[q.id] as string[]) : []
                          const opts = q.options || []
                          const customIndexes = arr.reduce<number[]>((acc, v, i) => { if (!opts.includes(v)) acc.push(i); return acc }, [])
                          const customItems = customIndexes.map(i => arr[i])
                          return customItems.map((item, ci) => (
                            <div key={ci} style={{ display: 'flex', gap: 6 }}>
                              <input
                                className="input"
                                value={item}
                                onChange={(e) => {
                                  const arr0 = Array.isArray(answers[q.id]) ? (answers[q.id] as string[]) : []
                                  const idx = customIndexes[ci]
                                  const next = arr0.map((v, i) => (i === idx ? e.target.value : v))
                                  setAnswer(q, next)
                                }}
                              />
                              <button
                                className="btn"
                                style={{ background: '#ef4444' }}
                                onClick={() => {
                                  const arr0 = Array.isArray(answers[q.id]) ? (answers[q.id] as string[]) : []
                                  const idx = customIndexes[ci]
                                  const next = arr0.filter((_, i) => i !== idx)
                                  setAnswer(q, next)
                                }}
                              >Remover</button>
                            </div>
                          ))
                        })()}
                      </div>
                    )}
                  </div>
                )}
                {q.type === 'photo' && (
                  <div style={{ display: 'grid', gap: 8 }}>
                    {!q.multiple && (
                      <div style={{ display: 'grid', gap: 6 }}>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={async (e) => {
                            const f = e.target.files?.[0]
                            if (!f) { setAnswer(q, ''); return }
                            const reader = new FileReader()
                            reader.onload = () => setAnswer(q, String(reader.result || ''))
                            reader.readAsDataURL(f)
                          }}
                        />
                        {typeof answers[q.id] === 'string' && String(answers[q.id]).length > 0 && (
                          <div style={{ display: 'grid', gap: 6 }}>
                            <img src={String(answers[q.id])} alt="Foto" style={{ maxWidth: 220, borderRadius: 8, border: '1px solid var(--personal-border)' }} />
                            <button className="btn" style={{ background: '#ef4444' }} onClick={() => setAnswer(q, '')}>Remover</button>
                          </div>
                        )}
                      </div>
                    )}
                    {q.multiple && (
                      <div style={{ display: 'grid', gap: 10 }}>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={async (e) => {
                            const files = Array.from(e.target.files || [])
                            if (files.length === 0) return
                            const arr = Array.isArray(answers[q.id]) ? (answers[q.id] as string[]) : []
                            const readers = files.map(f => new Promise<string>((resolve) => {
                              const r = new FileReader()
                              r.onload = () => resolve(String(r.result || ''))
                              r.readAsDataURL(f)
                            }))
                            const images = await Promise.all(readers)
                            setAnswer(q, [...arr, ...images])
                          }}
                        />
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
                          {(Array.isArray(answers[q.id]) ? (answers[q.id] as string[]) : []).map((src, i) => (
                            <div key={i} style={{ display: 'grid', gap: 6 }}>
                              <img src={src} alt={`Foto ${i+1}`} style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', borderRadius: 8, border: '1px solid var(--personal-border)' }} />
                              <button
                                className="btn"
                                style={{ background: '#ef4444' }}
                                onClick={() => {
                                  const arr0 = Array.isArray(answers[q.id]) ? (answers[q.id] as string[]) : []
                                  const next = arr0.filter((_, idx) => idx !== i)
                                  setAnswer(q, next)
                                }}
                              >Remover</button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </label>
            ))}
          </div>
          <div className="form-actions" style={{ marginTop: 8 }}>
            <button className="btn" onClick={save} disabled={!canSave}>Registrar</button>
            {msg && <div className="form-success" style={{ marginLeft: 10 }}>{msg}</div>}
          </div>
        </div>
      )}

      {studentId && (
        <div className="form-card" style={{ padding: 12, marginTop: 10 }}>
          <div className="form-title">Histórico de anamneses</div>
          <div className="form-grid" style={{ gridTemplateColumns: '1fr', gap: 10 }}>
            {responses.map(r => (
              <div key={r.id} className="form-card" style={{ padding: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <strong>{getModelName(r.modelId)}</strong>
                    <div style={{ color: '#64748b' }}>Aplicada em: {new Date(r.createdAt).toLocaleString()}</div>
                    {r.dueDate && <div style={{ color: '#dc2626', fontSize: 12 }}>Vence em: {new Date(r.dueDate).toLocaleDateString()}</div>}
                  </div>
                </div>
              </div>
            ))}
            {responses.length === 0 && <div>Nenhum registro.</div>}
          </div>
        </div>
      )}
    </div>
  )
}
        <div className="form-card" style={{ padding: 12, marginTop: 10 }}>
          <div className="form-grid">
            <label className="label">
              Prazo de renovação (dias)
              <input className="input" type="number" min={0} value={0} onChange={() => {}} />
            </label>
            <label className="label">
              Contar a partir de
              <input className="input" type="date" value={''} onChange={() => {}} />
            </label>
          </div>
        </div>
