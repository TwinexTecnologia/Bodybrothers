import { useEffect, useMemo, useState } from 'react'
import { listLibraryWorkouts, setWorkoutStatus, updateWorkout, type WorkoutRecord } from '../../store/workouts'
import { supabase } from '../../lib/supabase'

export default function WorkoutsActive() {
  const [items, setItems] = useState<WorkoutRecord[]>([])
  const [q, setQ] = useState('')
  const [editingId, setEditingId] = useState('')
  const [eName, setEName] = useState('')
  const [eGoal, setEGoal] = useState('')
  const [eCreatedAt, setECreatedAt] = useState('')
  const [eValidUntil, setEValidUntil] = useState('')
  const [eNotes, setENotes] = useState('')
  const [eExercises, setEExercises] = useState<Array<WorkoutRecord['exercises'][number]>>([])
  const [loading, setLoading] = useState(true)
  const [personalId, setPersonalId] = useState('')

  async function loadData() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
        setPersonalId(user.id)
        const list = await listLibraryWorkouts(user.id)
        setItems(list)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  const filtered = useMemo(() => {
    const s = q.toLowerCase()
    return items.filter(w => {
      const exNames = w.exercises.map(e => `${e.name} ${e.group}`).join(' ').toLowerCase()
      return (
        w.name.toLowerCase().includes(s) ||
        (w.goal || '').toLowerCase().includes(s) ||
        (w.notes || '').toLowerCase().includes(s) ||
        exNames.includes(s)
      )
    })
  }, [items, q])

  const archive = async (w: WorkoutRecord) => {
    await setWorkoutStatus(w.id, 'inativo')
    setItems(prev => prev.filter(x => x.id !== w.id))
  }

  const startEdit = (w: WorkoutRecord) => {
    setEditingId(w.id)
    setEName(w.name)
    setEGoal(w.goal || '')
    setECreatedAt(w.createdAt || '')
    setEValidUntil(w.validUntil || '')
    setENotes(w.notes || '')
    setEExercises(w.exercises.slice())
  }

  const cancelEdit = () => {
    setEditingId('')
    setEName('')
    setEGoal('')
    setECreatedAt('')
    setEValidUntil('')
    setENotes('')
    setEExercises([])
  }

  const updateEx = (idx: number, patch: Partial<WorkoutRecord['exercises'][number]>) => {
    const next = eExercises.slice()
    next[idx] = { ...next[idx], ...patch }
    setEExercises(next)
  }

  const addEx = () => setEExercises([...eExercises, { name: '', group: '', series: '', reps: '', load: '', rest: '' }])
  const removeEx = (idx: number) => setEExercises(eExercises.filter((_, i) => i !== idx))

  const onUpload = (idx: number, file?: File) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => updateEx(idx, { videoUrl: String(reader.result) })
    reader.readAsDataURL(file)
  }

  const saveEdit = async () => {
    if (!editingId) return
    const rec = await updateWorkout(editingId, {
      name: eName.trim(),
      goal: eGoal || undefined,
      createdAt: eCreatedAt || undefined,
      validUntil: eValidUntil || undefined,
      notes: eNotes || undefined,
      exercises: eExercises,
    })
    if (rec) {
        setItems(prev => prev.map(x => x.id === rec.id ? rec : x))
    }
    cancelEdit()
  }

  if (loading) return <div>Carregando...</div>

  return (
    <div>
      <h1>Protocolos • Treinos Ativos</h1>
      <div style={{ marginBottom: 10, display: 'flex', gap: 10 }}>
        <input placeholder="Buscar por nome, objetivo ou exercício" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn" onClick={loadData}>Atualizar</button>
      </div>
      <div style={{ display: 'grid', gap: 10 }}>
        {filtered.map(w => (
          <div key={w.id} className="form-card" style={{ padding: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 8, alignItems: 'center' }}>
              <div>
                <strong>{w.name}</strong>
                <div style={{ color: '#64748b' }}>{w.goal || '—'}</div>
              </div>
              <div>
                <div><small>Criado</small>: {w.createdAt ? new Date(w.createdAt).toLocaleDateString() : '—'}</div>
                <div><small>Validade</small>: {w.validUntil ? new Date(w.validUntil).toLocaleDateString() : '—'}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn" onClick={() => startEdit(w)} style={{ background: 'var(--personal-accent)' }}>Editar</button>
                <button className="btn" onClick={() => archive(w)} style={{ background: '#ef4444' }}>Arquivar</button>
              </div>
            </div>
            {w.notes && <div style={{ marginTop: 6 }}>{w.notes}</div>}
            <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
              <div style={{ fontWeight: 600 }}>Exercícios</div>
              {w.exercises.map((e, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 0.8fr 0.8fr 0.8fr', gap: 8 }}>
                  <div>{e.name} • {e.group}</div>
                  <div>Séries: {e.series}</div>
                  <div>Reps: {e.reps}</div>
                  <div>Carga: {e.load}</div>
                  <div>Desc.: {e.rest}</div>
                </div>
              ))}
            </div>

            {editingId === w.id && (
              <div className="form-section" style={{ marginTop: 12 }}>
                <div className="form-title">Editar Treino</div>
                <div className="form-grid">
                  <label className="label">
                    Nome do treino
                    <input className="input" value={eName} onChange={(e) => setEName(e.target.value)} />
                  </label>
                  <label className="label">
                    Objetivo
                    <input className="input" value={eGoal} onChange={(e) => setEGoal(e.target.value)} />
                  </label>
                  <label className="label">
                    Data de criação
                    <input className="input" type="date" value={eCreatedAt} onChange={(e) => setECreatedAt(e.target.value)} />
                  </label>
                  <label className="label">
                    Validade (opcional)
                    <input className="input" type="date" value={eValidUntil} onChange={(e) => setEValidUntil(e.target.value)} />
                  </label>
                </div>
                <label className="label">
                  Observações
                  <textarea className="input" value={eNotes} onChange={(e) => setENotes(e.target.value)} />
                </label>

                <div className="form-section">
                  <div className="form-title">Exercícios</div>
                  <div className="form-actions" style={{ marginBottom: 10 }}>
                    <button className="btn" onClick={addEx}>Adicionar exercício</button>
                  </div>
                  <div className="form-grid" style={{ gridTemplateColumns: '1fr', gap: 12 }}>
                    {eExercises.map((ex, idx) => (
                      <div key={idx} className="form-card" style={{ padding: 12 }}>
                        <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                          <label className="label">
                            Nome
                            <input className="input" value={ex.name} onChange={(e) => updateEx(idx, { name: e.target.value })} />
                          </label>
                          <label className="label">
                            Grupo muscular
                            <input className="input" value={ex.group} onChange={(e) => updateEx(idx, { group: e.target.value })} />
                          </label>
                          <label className="label">
                            Séries
                            <input className="input" value={ex.series} onChange={(e) => updateEx(idx, { series: e.target.value })} />
                          </label>
                          <label className="label">
                            Repetições
                            <input className="input" value={ex.reps} onChange={(e) => updateEx(idx, { reps: e.target.value })} />
                          </label>
                          <label className="label">
                            Carga
                            <input className="input" value={ex.load} onChange={(e) => updateEx(idx, { load: e.target.value })} />
                          </label>
                          <label className="label">
                            Descanso
                            <input className="input" value={ex.rest} onChange={(e) => updateEx(idx, { rest: e.target.value })} />
                          </label>
                        </div>

                        <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                          <label className="label">
                            Vídeo (URL)
                            <input className="input" value={ex.videoUrl || ''} onChange={(e) => updateEx(idx, { videoUrl: e.target.value })} placeholder="https://..." />
                          </label>
                          <label className="label">
                            Upload de vídeo
                            <input className="input" type="file" accept="video/*" onChange={(e) => onUpload(idx, e.target.files?.[0])} />
                          </label>
                        </div>
                        {ex.videoUrl && (
                          <div style={{ marginTop: 8, display: 'grid', placeItems: 'center' }}>
                            <video src={ex.videoUrl} controls style={{ width: '100%', maxWidth: 480, aspectRatio: '16 / 9', borderRadius: 8, background: '#000' }} />
                          </div>
                        )}

                        <div className="form-actions" style={{ marginTop: 8 }}>
                          <button className="btn" onClick={() => removeEx(idx)} style={{ background: '#ef4444' }}>Remover</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="form-actions" style={{ marginTop: 10 }}>
                  <button className="btn" onClick={saveEdit}>Salvar alterações</button>
                  <button className="btn" onClick={cancelEdit} style={{ background: '#e5e7eb', color: '#000' }}>Cancelar</button>
                </div>
              </div>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="form-card" style={{ padding: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <strong>Nenhum treino ativo</strong>
                <div style={{ color: '#64748b' }}>Crie um treino ou atualize a lista.</div>
              </div>
              <a href="/protocols/workout-create" className="btn">Criar Treino</a>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
