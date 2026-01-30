import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listActiveWorkouts, setWorkoutStatus, updateWorkout, toggleWorkoutFavorite, duplicateWorkout, type WorkoutRecord } from '../../store/workouts'
import { supabase } from '../../lib/supabase'
import { Star, Copy } from 'lucide-react'
import Modal from '../../components/Modal'

export default function WorkoutsActive() {
  const navigate = useNavigate()
  const [items, setItems] = useState<WorkoutRecord[]>([])
  const [studentNames, setStudentNames] = useState<Record<string, string>>({})
  const [filterType, setFilterType] = useState<'all' | 'library' | 'student'>('all')
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [q, setQ] = useState('')
  
  const [loading, setLoading] = useState(true)
  const [personalId, setPersonalId] = useState('')

  const [assignModalOpen, setAssignModalOpen] = useState(false)
  const [selectedWorkoutForAssign, setSelectedWorkoutForAssign] = useState<WorkoutRecord | null>(null)
  const [assignStudentId, setAssignStudentId] = useState('')
  
  // Modal de Confirmação
  const [smartLinkState, setSmartLinkState] = useState<{
      itemId: string;
      itemName: string;
      targetStudentId: string;
  } | null>(null)

  async function loadData() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
        setPersonalId(user.id)
        // Agora busca TODOS os ativos (incluindo de alunos)
        const list = await listActiveWorkouts(user.id)
        setItems(list)

        // 2. Carrega nomes de TODOS os alunos disponíveis
        // Filtra roles student/aluno para não mostrar admins/personais
        const { data: students } = await supabase
          .from('profiles')
          .select('id, full_name')
          .or('role.eq.student,role.eq.aluno')
        
        const names: Record<string, string> = {}
        students?.forEach(s => {
            names[s.id] = s.full_name
        })
        setStudentNames(names)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  const filtered = useMemo(() => {
    const s = q.toLowerCase()
    const result = items.filter(w => {
      // Filtros
      if (filterType === 'library' && w.studentId) return false
      if (filterType === 'student' && !w.studentId) return false
      if (selectedStudentId && w.studentId !== selectedStudentId) return false

      const exNames = w.exercises.map(e => `${e.name} ${e.group}`).join(' ').toLowerCase()
      return (
        w.name.toLowerCase().includes(s) ||
        (w.goal || '').toLowerCase().includes(s) ||
        (w.notes || '').toLowerCase().includes(s) ||
        exNames.includes(s)
      )
    })
    
    // Garante ordenação: Favoritos > Data
    return result.sort((a, b) => {
        if (a.isFavorite && !b.isFavorite) return -1
        if (!a.isFavorite && b.isFavorite) return 1
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    })
  }, [items, q, filterType, selectedStudentId])

  const archive = async (w: WorkoutRecord) => {
    await setWorkoutStatus(w.id, 'inativo')
    setItems(prev => prev.filter(x => x.id !== w.id))
  }

  const toggleFav = async (w: WorkoutRecord) => {
      // Atualiza UI otimista
      setItems(prev => prev.map(item => item.id === w.id ? { ...item, isFavorite: !item.isFavorite } : item))
      
      // Persiste no banco
      const updated = await toggleWorkoutFavorite(w.id)
      
      // Sincroniza estado real
      if (updated) {
          setItems(prev => prev.map(item => item.id === w.id ? updated : item))
      }
  }

  const startEdit = (w: WorkoutRecord) => {
    navigate(`/protocols/workout-create?id=${w.id}`)
  }

  const openAssignModal = (w: WorkoutRecord) => {
      setSelectedWorkoutForAssign(w)
      setAssignStudentId('')
      setAssignModalOpen(true)
  }

  const handleAssign = async () => {
      if (!selectedWorkoutForAssign || !assignStudentId) return
      
      setLoading(true)
      
      // Lógica de Duplicação Inteligente:
      // 1. Se o treino JÁ É do aluno selecionado -> Não faz nada ou avisa (mas aqui vamos assumir que o usuário sabe o que faz e duplicaria se quisesse, mas a regra é "editar")
      // Mas o botão é "Vincular/Duplicar".
      // A regra pedida:
      // "se for o treino dele ja ele so editar nao criar novo" -> Isso é o botão EDITAR que já existe na lista.
      // "se for de um aluno diferente ele cria um novo com o nome do aluno que foi aplicado" -> Isso é o duplicateWorkout.
      
      // Se o treino selecionado JÁ pertence ao aluno escolhido:
      if (selectedWorkoutForAssign.studentId === assignStudentId) {
          alert('Este treino já pertence a este aluno. Use o botão "Editar" para modificá-lo.')
          setLoading(false)
          return
      }

      // Verifica se é um item da biblioteca que PARECE ser do aluno (ex: "Treino - Alex")
      // e oferece a opção de VINCULAR (Mover) ao invés de DUPLICAR
      const studentName = studentNames[assignStudentId]
      const firstName = studentName ? studentName.split(' ')[0] : ''
      
      let shouldMove = false
      if (!selectedWorkoutForAssign.studentId && firstName && selectedWorkoutForAssign.name.toLowerCase().includes(firstName.toLowerCase())) {
          shouldMove = true
      }

      if (shouldMove) {
          setSmartLinkState({
              itemId: selectedWorkoutForAssign.id,
              itemName: selectedWorkoutForAssign.name,
              targetStudentId: assignStudentId
          })
          setAssignModalOpen(false)
          setLoading(false)
          return
      }

      // Se for de OUTRO aluno ou da Biblioteca (e não moveu) -> CRIA CÓPIA
      const newWorkout = await duplicateWorkout(selectedWorkoutForAssign.id, assignStudentId)
      
      if (newWorkout) {
          // Adiciona na lista
          setItems(prev => [newWorkout, ...prev])
          setAssignModalOpen(false)
          setSelectedWorkoutForAssign(null)
          setAssignStudentId('')
      }
      
      setLoading(false)
  }

  const confirmSmartLink = async (action: 'link' | 'copy') => {
      if (!smartLinkState) return
      setLoading(true)
      
      const { itemId, targetStudentId } = smartLinkState
      
      if (action === 'link') {
          await updateWorkout(itemId, { studentId: targetStudentId })
          // Atualiza lista localmente
          setItems(prev => prev.map(w => w.id === itemId ? { ...w, studentId: targetStudentId } : w))
      } else {
          const newWorkout = await duplicateWorkout(itemId, targetStudentId)
          if (newWorkout) {
              setItems(prev => [newWorkout, ...prev])
          }
      }
      
      setSmartLinkState(null)
      setSelectedWorkoutForAssign(null)
      setAssignStudentId('')
      setLoading(false)
  }

  if (loading) return <div>Carregando...</div>

  return (
    <div>
      <h1>Protocolos • Treinos Ativos</h1>
      <div style={{ marginBottom: 20, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', background: '#fff', padding: 12, borderRadius: 12, border: '1px solid #f1f5f9' }}>
        
        {/* Filtro de Tipo (Pills) */}
        <div style={{ display: 'flex', gap: 8 }}>
            {[
                { id: 'all', label: 'Todos' },
                { id: 'library', label: '📚 Biblioteca' },
                { id: 'student', label: '👤 Alunos' }
            ].map(opt => (
                <button
                    key={opt.id}
                    onClick={() => {
                        setFilterType(opt.id as any)
                        if (opt.id !== 'student') setSelectedStudentId('')
                    }}
                    style={{
                        padding: '8px 16px',
                        borderRadius: '20px',
                        border: filterType === opt.id ? 'none' : '1px solid #e2e8f0',
                        background: filterType === opt.id ? '#0f172a' : '#fff',
                        color: filterType === opt.id ? '#fff' : '#64748b',
                        cursor: 'pointer',
                        fontWeight: 500,
                        fontSize: '0.9rem',
                        transition: 'all 0.2s',
                        boxShadow: filterType === opt.id ? '0 2px 4px rgba(15,23,42,0.2)' : 'none'
                    }}
                >
                    {opt.label}
                </button>
            ))}
        </div>

        {/* Divisor Vertical */}
        <div style={{ width: 1, height: 24, background: '#e2e8f0' }}></div>

        {/* Filtro de Aluno (Select) */}
        <div style={{ flex: 1, display: 'flex', gap: 10 }}>
            {filterType === 'student' && (
                <div style={{ position: 'relative', minWidth: 200 }}>
                    <select 
                        className="select" 
                        style={{ 
                            padding: '8px 32px 8px 12px', 
                            width: '100%', 
                            borderRadius: 8,
                            borderColor: '#cbd5e1',
                            background: '#f8fafc',
                            fontSize: '0.9rem'
                        }}
                        value={selectedStudentId} 
                        onChange={e => setSelectedStudentId(e.target.value)}
                    >
                        <option value="">Todos os Alunos</option>
                        {Object.entries(studentNames).sort((a,b) => a[1].localeCompare(b[1])).map(([id, name]) => (
                            <option key={id} value={id}>{name}</option>
                        ))}
                    </select>
                    <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#64748b', fontSize: '0.8rem' }}>▼</div>
                </div>
            )}

            <input 
                placeholder="🔍 Buscar por nome, objetivo..." 
                value={q} 
                onChange={(e) => setQ(e.target.value)} 
                style={{ 
                    flex: 1, 
                    padding: '8px 12px', 
                    borderRadius: 8, 
                    border: '1px solid #cbd5e1',
                    fontSize: '0.9rem'
                }} 
            />
        </div>
      </div>
      <div style={{ display: 'grid', gap: 10 }}>
        {filtered.map(w => (
          <div key={w.id} className="form-card" style={{ padding: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 8, alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button 
                    onClick={(e) => { e.stopPropagation(); toggleFav(w); }}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4 }}
                    title={w.isFavorite ? "Remover dos favoritos" : "Favoritar"}
                >
                    <Star size={20} fill={w.isFavorite ? "#eab308" : "none"} color={w.isFavorite ? "#eab308" : "#94a3b8"} />
                </button>
                <div>
                  <strong style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      {w.name}
                      {w.studentId ? (
                          <span style={{ 
                              fontSize: '0.75em', 
                              backgroundColor: '#eff6ff', 
                              color: '#3b82f6', 
                              padding: '2px 8px', 
                              borderRadius: 12, 
                              fontWeight: 600,
                              border: '1px solid #dbeafe',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4
                          }}>
                              👤 {studentNames[w.studentId] || 'Aluno'}
                          </span>
                      ) : (
                          <span style={{ 
                              fontSize: '0.75em', 
                              backgroundColor: '#f1f5f9', 
                              color: '#64748b', 
                              padding: '2px 8px', 
                              borderRadius: 12, 
                              fontWeight: 600,
                              border: '1px solid #e2e8f0',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4
                          }}>
                              📚 Biblioteca
                          </span>
                      )}
                  </strong>
                  <div style={{ color: '#64748b' }}>{w.goal || '—'}</div>
                </div>
              </div>
              <div>
                <div><small>Criado</small>: {w.createdAt ? new Date(w.createdAt).toLocaleDateString() : '—'}</div>
                <div><small>Validade</small>: {w.validUntil ? new Date(w.validUntil).toLocaleDateString() : '—'}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button 
                    className="btn" 
                    onClick={() => openAssignModal(w)} 
                    style={{ background: '#3b82f6', display: 'flex', alignItems: 'center', gap: 6 }}
                    title="Duplicar para um aluno"
                >
                    <Copy size={16} /> Vincular
                </button>
                <button className="btn" onClick={() => startEdit(w)} style={{ background: 'var(--personal-accent)' }}>Editar</button>
                <button className="btn" onClick={() => archive(w)} style={{ background: '#ef4444' }}>Arquivar</button>
              </div>
            </div>
            {w.notes && <div style={{ marginTop: 6 }}>{w.notes}</div>}
            <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
              <div style={{ fontWeight: 600 }}>Exercícios</div>
              {w.exercises.map((e, i) => (
                <div key={i} className="workout-exercise-row">
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

      <Modal
          isOpen={assignModalOpen}
          onClose={() => setAssignModalOpen(false)}
          title="Vincular Treino a Aluno"
          footer={
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button className="btn" style={{ background: '#e2e8f0', color: '#1e293b' }} onClick={() => setAssignModalOpen(false)}>Cancelar</button>
                  <button className="btn" style={{ background: '#0f172a', color: '#fff' }} onClick={handleAssign} disabled={!assignStudentId}>Confirmar</button>
              </div>
          }
      >
          <div style={{ padding: 10 }}>
              <p style={{ color: '#64748b', marginBottom: 16 }}>
                  Selecione o aluno para quem deseja copiar este treino.
                  <br/>
                  <small>Será criada uma cópia independente com o nome do aluno.</small>
              </p>
              
              <label className="label">
                  Selecione o Aluno
                  <select 
                      className="select" 
                      style={{ width: '100%' }}
                      value={assignStudentId} 
                      onChange={e => setAssignStudentId(e.target.value)}
                  >
                      <option value="">Selecione...</option>
                      {Object.entries(studentNames)
                          .sort((a,b) => a[1].localeCompare(b[1]))
                          .map(([id, name]) => (
                              <option key={id} value={id}>{name}</option>
                          ))
                      }
                  </select>
              </label>
          </div>
      </Modal>

      <Modal
        isOpen={!!smartLinkState}
        onClose={() => setSmartLinkState(null)}
        title="Vincular ou Copiar?"
        footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                <button className="btn" style={{ background: '#e2e8f0', color: '#1e293b' }} onClick={() => setSmartLinkState(null)}>Cancelar</button>
                <button className="btn" style={{ background: '#fff', color: '#0f172a', border: '1px solid #cbd5e1' }} onClick={() => confirmSmartLink('copy')}>Criar Cópia</button>
                <button className="btn" style={{ background: '#0f172a', color: '#fff' }} onClick={() => confirmSmartLink('link')}>Vincular (Mover)</button>
            </div>
        }
      >
        <div style={{ textAlign: 'center', padding: 10 }}>
            <div style={{ fontSize: '3rem', marginBottom: 16 }}>🔄</div>
            <h3 style={{ color: '#1e293b', marginBottom: 12 }}>Item encontrado na Biblioteca</h3>
            <p style={{ color: '#64748b', fontSize: '1.05em', marginBottom: 20 }}>
                O item <strong>"{smartLinkState?.itemName}"</strong> parece já pertencer ao aluno selecionado.
            </p>
            <div style={{ textAlign: 'left', background: '#f8fafc', padding: 16, borderRadius: 8, fontSize: '0.95em', color: '#475569' }}>
                <p style={{ margin: '0 0 10px 0' }}><strong>O que você deseja fazer?</strong></p>
                <ul style={{ paddingLeft: 20, margin: 0 }}>
                    <li style={{ marginBottom: 8 }}>
                        <strong>Vincular (Mover):</strong> Retira da biblioteca e atribui ao aluno.
                    </li>
                    <li>
                        <strong>Criar Cópia:</strong> Mantém o original na biblioteca e cria um novo para o aluno.
                    </li>
                </ul>
            </div>
        </div>
      </Modal>
    </div>
  )
}
