import { useEffect, useMemo, useState } from 'react'
import { listLibraryModels, deleteModel, type AnamnesisModel } from '../../store/anamnesis'
import { supabase } from '../../lib/supabase'
import { useNavigate } from 'react-router-dom'

export default function AnamnesisModels() {
  const navigate = useNavigate()
  const [items, setItems] = useState<AnamnesisModel[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)

  async function loadData() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
        // Usa listLibraryModels para esconder os modelos personalizados dos alunos
        const list = await listLibraryModels(user.id)
        setItems(list)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  const filtered = useMemo(() => {
    const s = q.toLowerCase()
    return items.filter(m => m.name.toLowerCase().includes(s) || (m.goal || '').toLowerCase().includes(s))
  }, [items, q])

  const remove = async (id: string) => {
      if (confirm('Tem certeza que deseja excluir este modelo da biblioteca?')) {
          const ok = await deleteModel(id)
          if (ok) setItems(prev => prev.filter(x => x.id !== id))
      }
  }

  if (loading) return <div>Carregando...</div>

  return (
    <div>
      <h1>Protocolos • Anamnese (Modelos)</h1>
      <div style={{ marginBottom: 10, display: 'flex', gap: 10 }}>
        <input placeholder="Buscar por nome ou objetivo" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn" onClick={loadData}>Atualizar</button>
        <button className="btn" style={{ background: '#10b981' }} onClick={() => navigate('/protocols/anamnesis/model/create')}>+ Criar Modelo</button>
      </div>
      
      <div style={{ display: 'grid', gap: 10 }}>
        {filtered.map(m => (
            <div key={m.id} className="form-card" style={{ padding: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                <strong>{m.name}</strong>
                <div style={{ color: '#64748b' }}>{m.goal || '—'}</div>
                <div style={{ color: '#64748b' }}><small>{m.questions.length} perguntas</small></div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn" onClick={() => navigate(`/protocols/anamnesis/model/${m.id}`)} style={{ background: 'var(--personal-accent)' }}>Editar</button>
                <button className="btn" onClick={() => remove(m.id)} style={{ background: '#ef4444' }}>Excluir</button>
                </div>
            </div>
            </div>
        ))}
        {filtered.length === 0 && <div className="form-card" style={{ padding: 20, textAlign: 'center', color: '#666' }}>Nenhum modelo encontrado na biblioteca.</div>}
      </div>
    </div>
  )
}
