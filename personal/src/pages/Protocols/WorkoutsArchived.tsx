import { useEffect, useMemo, useState } from 'react'
import { listArchivedWorkouts, setWorkoutStatus, deleteWorkout, type WorkoutRecord } from '../../store/workouts'
import { supabase } from '../../lib/supabase'
import ConfirmModal from '../../components/ConfirmModal'

export default function WorkoutsArchived() {
  const [items, setItems] = useState<WorkoutRecord[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [workoutToDelete, setWorkoutToDelete] = useState<WorkoutRecord | null>(null)

  async function loadData() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
        const list = await listArchivedWorkouts(user.id)
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

  const restore = async (w: WorkoutRecord) => {
    await setWorkoutStatus(w.id, 'ativo')
    setItems(prev => prev.filter(x => x.id !== w.id))
  }

  const handleDeleteClick = (w: WorkoutRecord) => {
      setWorkoutToDelete(w)
      setIsModalOpen(true)
  }

  const confirmDelete = async () => {
    if (!workoutToDelete) return
    const success = await deleteWorkout(workoutToDelete.id)
    if (success) {
        setItems(prev => prev.filter(x => x.id !== workoutToDelete.id))
    } else {
        alert('Erro ao excluir treino.')
    }
    setIsModalOpen(false)
    setWorkoutToDelete(null)
  }

  if (loading) return <div>Carregando...</div>

  return (
    <div>
      <ConfirmModal
        isOpen={isModalOpen}
        title="Excluir Permanentemente?"
        description={`Você está prestes a excluir o treino "${workoutToDelete?.name}". Esta ação NÃO pode ser desfeita e você perderá este histórico para sempre. Se quiser apenas ocultar, mantenha-o arquivado.`}
        confirmText="Sim, excluir para sempre"
        cancelText="Manter arquivado"
        onConfirm={confirmDelete}
        onCancel={() => setIsModalOpen(false)}
        isDanger={true}
      />

      <h1>Protocolos • Treinos Inativos/Arquivados</h1>
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
                <button className="btn" onClick={() => restore(w)} style={{ background: 'var(--personal-primary)' }}>Reativar</button>
                <button className="btn" onClick={() => handleDeleteClick(w)} style={{ background: '#ef4444' }}>Excluir</button>
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
          </div>
        ))}
        {filtered.length === 0 && <div>Nenhum treino arquivado.</div>}
      </div>
    </div>
  )
}
