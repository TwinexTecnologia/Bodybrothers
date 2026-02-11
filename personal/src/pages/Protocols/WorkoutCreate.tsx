import { useMemo, useState, useEffect } from 'react'
import { addWorkout, updateWorkout, getWorkoutById, deleteWorkoutIfPersonalized } from '../../store/workouts'
import { listExercises, type Exercise as LibraryExercise } from '../../store/exercises'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd'
import { X, BookOpen, Search, Video, GripVertical } from 'lucide-react'

type ExerciseSetType = 'warmup' | 'feeder' | 'working' | 'custom';

type ExerciseSet = {
    type: ExerciseSetType;
    customLabel?: string; // Para quando for 'custom'
    series: string;
    reps: string;
    load: string;
    rest: string;
}

type Exercise = {
    // ID único para Drag and Drop (pode ser temp)
    dndId: string; 
    
    name: string; 
    group: string; 
    
    // Novo modelo flexível de séries
    sets: ExerciseSet[];

    // Mantidos para compatibilidade visual na listagem simples (pega do primeiro set 'working')
    series: string; 
    reps: string; 
    load: string; 
    rest: string; 

    // Campos legados (opcionais agora, mantidos para não quebrar banco antigo imediatamente)
    warmupSeries?: string;
    warmupReps?: string;
    warmupLoad?: string;
    warmupRest?: string;
    feederSeries?: string;
    feederReps?: string;
    feederLoad?: string;
    feederRest?: string;

    notes?: string; 
    videoUrl?: string;

    // Estado local visual
    showAdvanced?: boolean;
}

function getYouTubeId(url: string) {
    // Suporta shorts, watch, embed, youtu.be
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*).*/
    const match = url.match(regExp)
    return (match && match[2].length === 11) ? match[2] : null
}

export default function WorkoutCreate() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  // Pega o ID da rota (useParams) ou da query string (searchParams)
  const workoutId = id || searchParams.get('id')
  
  const [personalId, setPersonalId] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [studentId, setStudentId] = useState<string | undefined>(undefined)
  
  const [name, setName] = useState('')
  const [goal, setGoal] = useState('')
  const [createdAt, setCreatedAt] = useState(new Date().toISOString().split('T')[0])
  const [validUntil, setValidUntil] = useState('')
  const [notes, setNotes] = useState('')
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(true)
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null)
  const [library, setLibrary] = useState<LibraryExercise[]>([])
  
  // Seletor de Exercícios (Modal)
  const [selectorOpen, setSelectorOpen] = useState<number | null>(null)
  const [selectorSearch, setSelectorSearch] = useState('')

  useEffect(() => {
    async function load() {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
            setPersonalId(user.id)
            listExercises(user.id).then(setLibrary).catch(console.error)
        }
        
        if (workoutId) {
            const w = await getWorkoutById(workoutId)
            if (w) {
                setEditId(w.id)
                setStudentId(w.studentId)
                setName(w.name)
                setGoal(w.goal || '')
                setCreatedAt(w.createdAt ? new Date(w.createdAt).toISOString().split('T')[0] : '')
                setValidUntil(w.validUntil ? new Date(w.validUntil).toISOString().split('T')[0] : '')
                setNotes(w.notes || '')
                
                // Mapeia exercícios e define showAdvanced se tiver dados de aquecimento
                const mappedEx = (w.exercises || []).map(e => {
                    // Migração de dados antigos para nova estrutura de 'sets' se não existir
                    let sets: ExerciseSet[] = e.sets || []
                    
                    if (sets.length === 0) {
                        // Tenta reconstruir sets a partir dos campos antigos
                        if (e.warmupSeries || e.warmupReps) {
                            sets.push({ type: 'warmup', series: e.warmupSeries || '', reps: e.warmupReps || '', load: e.warmupLoad || '', rest: e.warmupRest || '' })
                        }
                        if (e.feederSeries || e.feederReps) {
                            sets.push({ type: 'feeder', series: e.feederSeries || '', reps: e.feederReps || '', load: e.feederLoad || '', rest: e.feederRest || '' })
                        }
                        // Set de trabalho padrão
                        sets.push({ type: 'working', series: e.series || '', reps: e.reps || '', load: e.load || '', rest: e.rest || '' })
                    }

                    return {
                        ...e,
                        dndId: Math.random().toString(36).substr(2, 9),
                        sets,
                        showAdvanced: !!(e.warmupSeries || e.warmupReps || e.feederSeries || e.feederReps || sets.length > 1)
                    }
                })
                setExercises(mappedEx)
            }
        }
        setLoading(false)
    }
    load()
  }, [workoutId])

  const addExercise = () => setExercises([...exercises, {
      dndId: Math.random().toString(36).substr(2, 9),
      name: '', 
      group: '', 
      series: '', 
      reps: '', 
      load: '', 
      rest: '', 
      sets: [
          { type: 'working', series: '', reps: '', load: '', rest: '' }
      ],
      showAdvanced: false 
  }])
  
  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return

    const items = Array.from(exercises)
    const [reorderedItem] = items.splice(result.source.index, 1)
    items.splice(result.destination.index, 0, reorderedItem)

    setExercises(items)
  }

  const updateExercise = (idx: number, patch: Partial<Exercise>) => {
    const next = exercises.slice()
    next[idx] = { ...next[idx], ...patch }
    setExercises(next)
  }

  const updateSet = (exIdx: number, setIdx: number, field: keyof ExerciseSet, value: string) => {
      const next = exercises.slice()
      const ex = next[exIdx]
      const nextSets = [...ex.sets]
      nextSets[setIdx] = { ...nextSets[setIdx], [field]: value }
      ex.sets = nextSets
      
      // Sincroniza campos legados para compatibilidade
      if (nextSets[setIdx].type === 'working') {
          ex.series = nextSets[setIdx].series
          ex.reps = nextSets[setIdx].reps
          ex.load = nextSets[setIdx].load
          ex.rest = nextSets[setIdx].rest
      }
      
      setExercises(next)
  }

  const addSet = (exIdx: number, type: ExerciseSetType = 'working') => {
      const next = exercises.slice()
      next[exIdx].sets.push({ type, series: '', reps: '', load: '', rest: '' })
      setExercises(next)
  }

  const removeSet = (exIdx: number, setIdx: number) => {
      const next = exercises.slice()
      next[exIdx].sets.splice(setIdx, 1)
      setExercises(next)
  }
  
  const removeExercise = (idx: number) => setExercises(exercises.filter((_, i) => i !== idx))
  
  const toggleAdvanced = (idx: number) => {
      const next = exercises.slice()
      next[idx].showAdvanced = !next[idx].showAdvanced
      setExercises(next)
  }

  const handleUpload = async (idx: number, file?: File) => {
    if (!file) return
    
    if (file.size > 50 * 1024 * 1024) {
        alert('O vídeo deve ter no máximo 50MB.')
        return
    }

    try {
        setUploadingIdx(idx)
        const fileExt = file.name.split('.').pop()
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`
        const filePath = `exercises/${fileName}`

        const { error: uploadError } = await supabase.storage
            .from('videos')
            .upload(filePath, file)

        if (uploadError) throw uploadError

        const { data } = supabase.storage.from('videos').getPublicUrl(filePath)
        updateExercise(idx, { videoUrl: data.publicUrl })
    } catch (error: any) {
        console.error('Erro no upload:', error)
        alert('Erro ao fazer upload. Verifique se existe um bucket chamado "videos" no Storage do Supabase configurado como público.')
    } finally {
        setUploadingIdx(null)
    }
  }

  const handleSelectLibraryExercise = (idx: number, libId: string) => {
      const libEx = library.find(e => e.id === libId)
      if (libEx) {
          updateExercise(idx, {
              name: libEx.name,
              group: libEx.muscle_group || '',
              videoUrl: libEx.video_url || ''
          })
      }
  }

  const save = async () => {
      if (!personalId) {
          alert('Erro: Personal ID não encontrado. Tente fazer login novamente.')
          return
      }
      
      if (!name.trim()) {
          setMsg('Erro: Nome do treino é obrigatório.')
          return
      }

      setLoading(true)
      // Limpa campos internos antes de salvar (remove showAdvanced e dndId)
      const cleanExercises = exercises.map(({ showAdvanced, dndId, ...rest }) => rest)

      try {
        if (editId) {
            const rec = await updateWorkout(editId, {
                name: name.trim(),
                goal: goal || undefined,
                createdAt: createdAt || undefined,
                validUntil: validUntil || undefined,
                notes: notes || undefined,
                exercises: cleanExercises,
            })
            if (rec) setMsg(`Treino atualizado: ${rec.name}`)
        } else {
            const rec = await addWorkout({
                personalId,
                name: name.trim(),
                goal: goal || undefined,
                createdAt: createdAt || undefined,
                validUntil: validUntil || undefined,
                notes: notes || undefined,
                exercises: cleanExercises,
            })
            if (rec) {
                setMsg(`Treino criado: ${rec.name}`)
                if (!editId) {
                    setName('')
                    setGoal('')
                    setExercises([])
                }
            }
        }
      } catch (err: any) {
          console.error('Erro ao salvar treino:', err)
          setMsg(`Erro ao salvar: ${err.message}`)
      } finally {
          setLoading(false)
      }
  }

  const deletePersonalized = async () => {
    if (!editId || !studentId) return
    if (!confirm('Tem certeza?')) return
    const ok = await deleteWorkoutIfPersonalized(editId)
    if (ok) {
        setMsg('Treino personalizado excluído')
        setTimeout(() => navigate('/students/list'), 1000)
    } else {
        setMsg('Não é possível excluir um treino fixo')
    }
  }

  if (loading) return <div>Carregando...</div>

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', paddingBottom: 100 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ margin: 0 }}>{editId ? 'Editar Treino' : 'Novo Treino'}</h1>
        <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn" onClick={addExercise} style={{ background: '#0f172a' }}>+ Adicionar Exercício</button>
            <button className="btn" onClick={save} style={{ background: 'var(--personal-primary)' }}>Salvar</button>
        </div>
      </div>

      {/* Card de Informações Gerais */}
      <div className="form-card" style={{ padding: 20, marginBottom: 24, borderLeft: '4px solid var(--personal-primary)' }}>
        <div className="workout-header-grid">
            <label className="label">
                Nome do Treino
                <input className="input" style={{ fontSize: '1.1em', fontWeight: 600 }} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Treino A - Peito e Tríceps" />
            </label>
            <label className="label">
                Objetivo
                <input className="input" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Ex: Hipertrofia" />
            </label>
            <div className="form-grid">
                <label className="label">
                    Data
                    <input className="input" type="date" value={createdAt} onChange={(e) => setCreatedAt(e.target.value)} />
                </label>
                <label className="label">
                    Validade
                    <input className="input" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
                </label>
            </div>
        </div>
        <div style={{ marginTop: 12 }}>
            <label className="label">
                Observações Gerais
                <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Instruções gerais para o aluno..." />
            </label>
        </div>
      </div>

      {/* Lista de Exercícios */}
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="exercises-list">
            {(provided) => (
                <div 
                    {...provided.droppableProps} 
                    ref={provided.innerRef} 
                    style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
                >
                    {exercises.map((ex, idx) => (
                    <Draggable key={ex.dndId} draggableId={ex.dndId} index={idx}>
                        {(provided) => (
                            <div 
                                key={idx} 
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className="form-card" 
                                style={{ 
                                    ...provided.draggableProps.style, // Estilos essenciais para o DND
                                    padding: 0, overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' 
                                }}
                            >
                                
                                {/* Header do Exercício */}
                                <div style={{ padding: '16px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flex: 1 }}>
                                        {/* Handle para arrastar */}
                                        <div {...provided.dragHandleProps} style={{ cursor: 'grab', display: 'flex', alignItems: 'center', color: '#94a3b8', marginRight: -4 }}>
                                            <GripVertical size={20} />
                                        </div>

                                        <div style={{ width: 28, height: 28, background: '#cbd5e1', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: '#475569', fontSize: '0.9em' }}>
                                            {idx + 1}
                                        </div>
                                        
                                        {/* Nome e Biblioteca */}
                                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <input 
                                                className="input" 
                                                value={ex.name} 
                                                onChange={(e) => updateExercise(idx, { name: e.target.value })} 
                                                placeholder="Nome do Exercício"
                                                style={{ flex: 1, fontWeight: 600, fontSize: '1.05em', border: '1px solid transparent', background: 'transparent' }}
                                                onFocus={(e) => e.target.style.background = '#fff'}
                                                onBlur={(e) => e.target.style.background = 'transparent'}
                                            />
                                            {library.length > 0 && (
                                                <button 
                                                    onClick={() => {
                                                        setSelectorOpen(idx)
                                                        setSelectorSearch('')
                                                    }}
                                                    style={{ 
                                                        background: '#e0f2fe', border: '1px solid #bae6fd', borderRadius: 6, 
                                                        padding: '6px 10px', cursor: 'pointer', color: '#0369a1', 
                                                        display: 'flex', alignItems: 'center', gap: 6, 
                                                        fontSize: '0.85em', fontWeight: 600, whiteSpace: 'nowrap'
                                                    }}
                                                    title="Selecionar da Biblioteca"
                                                >
                                                    <BookOpen size={16} /> Biblioteca
                                                </button>
                                            )}
                                        </div>

                                        <input 
                                            className="input" 
                                            value={ex.group} 
                                            onChange={(e) => updateExercise(idx, { group: e.target.value })} 
                                            placeholder="Grupo Muscular"
                                            style={{ width: 150, fontSize: '0.9em', border: '1px solid transparent', background: 'transparent', textAlign: 'right', color: '#64748b' }}
                                            onFocus={(e) => e.target.style.background = '#fff'}
                                            onBlur={(e) => e.target.style.background = 'transparent'}
                                        />
                                    </div>
                                    <button 
                                        onClick={() => removeExercise(idx)}
                                        style={{ marginLeft: 16, background: 'transparent', border: 'none', color: '#ef4444', fontSize: '1.2em', cursor: 'pointer', padding: 4 }}
                                        title="Remover exercício"
                                    >
                                        ✕
                                    </button>
                                </div>

                                <div style={{ padding: 20 }}>
                                    {/* Cabeçalho da Tabela de Sets */}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(100px, 1.2fr) 0.6fr 0.8fr 0.8fr 0.6fr 40px', gap: 10, alignItems: 'center', marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid #f1f5f9' }}>
                                        <div style={{ fontSize: '0.7em', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.05em' }}>TIPO</div>
                                        <div style={{ fontSize: '0.7em', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.05em' }}>SÉRIES</div>
                                        <div style={{ fontSize: '0.7em', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.05em' }}>REPS</div>
                                        <div style={{ fontSize: '0.7em', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.05em' }}>CARGA</div>
                                        <div style={{ fontSize: '0.7em', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.05em' }}>DESC.</div>
                                        <div></div>
                                    </div>

                                    {/* Lista de Sets Dinâmicos */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        {ex.sets.map((set, setIdx) => (
                                            <div key={setIdx} style={{ display: 'grid', gridTemplateColumns: 'minmax(100px, 1.2fr) 0.6fr 0.8fr 0.8fr 0.6fr 40px', gap: 10, alignItems: 'center' }}>
                                                {/* Seletor de Tipo ou Input Customizado */}
                                                {set.type === 'custom' ? (
                                                    <input 
                                                        className="input"
                                                        value={set.customLabel || ''}
                                                        onChange={(e) => updateSet(idx, setIdx, 'customLabel', e.target.value)}
                                                        placeholder="Nome do Tipo"
                                                        autoFocus
                                                        style={{ 
                                                            padding: '6px 8px', fontSize: '0.85em', fontWeight: 600,
                                                            color: '#7c3aed', borderColor: '#ddd6fe', background: '#f5f3ff',
                                                            width: '100%'
                                                        }}
                                                    />
                                                ) : (
                                                    <select 
                                                        className="input"
                                                        value={set.type}
                                                        onChange={(e) => updateSet(idx, setIdx, 'type', e.target.value)}
                                                        style={{ 
                                                            padding: '6px 8px', fontSize: '0.85em', fontWeight: 600,
                                                            color: set.type === 'warmup' ? '#ea580c' : set.type === 'feeder' ? '#0284c7' : '#16a34a',
                                                            borderColor: set.type === 'warmup' ? '#fed7aa' : set.type === 'feeder' ? '#bae6fd' : '#bbf7d0',
                                                            background: set.type === 'warmup' ? '#fff7ed' : set.type === 'feeder' ? '#f0f9ff' : '#f0fdf4',
                                                            width: '100%'
                                                        }}
                                                    >
                                                        <option value="warmup">Aquecimento</option>
                                                        <option value="feeder">Preparação</option>
                                                        <option value="working">Trabalho</option>
                                                        <option value="custom">Outro...</option>
                                                    </select>
                                                )}

                                                <input className="input" style={{ width: '100%', minWidth: 0, padding: '6px 8px' }} value={set.series} onChange={(e) => updateSet(idx, setIdx, 'series', e.target.value)} placeholder="-" />
                                                <input className="input" style={{ width: '100%', minWidth: 0, padding: '6px 8px' }} value={set.reps} onChange={(e) => updateSet(idx, setIdx, 'reps', e.target.value)} placeholder="-" />
                                                <input className="input" style={{ width: '100%', minWidth: 0, padding: '6px 8px' }} value={set.load} onChange={(e) => updateSet(idx, setIdx, 'load', e.target.value)} placeholder="kg" />
                                                <input className="input" style={{ width: '100%', minWidth: 0, padding: '6px 8px' }} value={set.rest} onChange={(e) => updateSet(idx, setIdx, 'rest', e.target.value)} placeholder="s" />
                                                
                                                <button 
                                                    onClick={() => removeSet(idx, setIdx)}
                                                    style={{ background: '#fee2e2', border: 'none', color: '#ef4444', width: 24, height: 24, borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                    title="Remover série"
                                                >
                                                    <X size={14} />
                                                </button>
                                                {set.type === 'custom' && (
                                                    <button 
                                                        onClick={() => updateSet(idx, setIdx, 'type', 'working')}
                                                        style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', marginLeft: -30, marginRight: 10 }}
                                                        title="Cancelar"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    {/* Botões para Adicionar Sets */}
                                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                                        <button onClick={() => addSet(idx, 'warmup')} style={{ fontSize: '0.75em', padding: '4px 8px', background: '#fff7ed', color: '#ea580c', border: '1px solid #fed7aa', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}>+ Aquecimento</button>
                                        <button onClick={() => addSet(idx, 'feeder')} style={{ fontSize: '0.75em', padding: '4px 8px', background: '#f0f9ff', color: '#0284c7', border: '1px solid #bae6fd', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}>+ Preparação</button>
                                        <button onClick={() => addSet(idx, 'working')} style={{ fontSize: '0.75em', padding: '4px 8px', background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}>+ Trabalho</button>
                                        <button onClick={() => addSet(idx, 'custom')} style={{ fontSize: '0.75em', padding: '4px 8px', background: '#f5f3ff', color: '#7c3aed', border: '1px solid #ddd6fe', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}>+ Outro</button>
                                    </div>

                                    {/* Footer do Card: Toggle Avançado, Obs e Vídeo */}
                                    <div style={{ display: 'flex', gap: 20, paddingTop: 16, marginTop: 16, borderTop: '1px solid #f1f5f9' }}>
                                        
                                        {/* Botão Toggle Avançado */}
                                        {/* (Removido pois agora é sempre visível/dinâmico) */}

                                        {/* Obs e Video Inputs */}
                                        <div style={{ flex: 1, display: 'grid', gap: 10 }}>
                                            <input 
                                                className="input" 
                                                style={{ fontSize: '0.9em' }} 
                                                value={ex.notes || ''} 
                                                onChange={(e) => updateExercise(idx, { notes: e.target.value })} 
                                                placeholder="Observações do exercício..." 
                                            />
                                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                                <input 
                                                    className="input" 
                                                    style={{ fontSize: '0.9em', flex: 1 }} 
                                                    value={ex.videoUrl || ''} 
                                                    onChange={(e) => updateExercise(idx, { videoUrl: e.target.value })} 
                                                    placeholder="Link ou Upload..." 
                                                />
                                                <label 
                                                    style={{ 
                                                        cursor: 'pointer', 
                                                        background: '#f1f5f9', 
                                                        padding: '8px 12px', 
                                                        borderRadius: '6px', 
                                                        border: '1px solid #cbd5e1',
                                                        display: 'flex', 
                                                        alignItems: 'center', 
                                                        gap: 6,
                                                        fontSize: '0.9em',
                                                        color: '#475569',
                                                        whiteSpace: 'nowrap'
                                                    }}
                                                    title="Fazer upload de vídeo"
                                                >
                                                    {uploadingIdx === idx ? '⏳...' : '📁 Upload'}
                                                    <input 
                                                        type="file" 
                                                        accept="video/*" 
                                                        style={{ display: 'none' }} 
                                                        onChange={(e) => handleUpload(idx, e.target.files?.[0])}
                                                        disabled={uploadingIdx !== null}
                                                    />
                                                </label>
                                            </div>
                                            
                                            {/* Preview do Vídeo (Expansível) */}
                                            {ex.videoUrl && (
                                                <div style={{ marginTop: 8, position: 'relative', width: 'fit-content' }}>
                                                    <button 
                                                        onClick={() => updateExercise(idx, { videoUrl: '' })}
                                                        style={{
                                                            position: 'absolute', top: -10, right: -10, zIndex: 10,
                                                            background: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%',
                                                            width: 24, height: 24, cursor: 'pointer', fontWeight: 'bold',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                                        }}
                                                        title="Remover vídeo"
                                                    >
                                                        ✕
                                                    </button>

                                                    {getYouTubeId(ex.videoUrl) ? (
                                                        <div style={{ background: '#000', borderRadius: 8, overflow: 'hidden' }}>
                                                            <iframe
                                                                width="320"
                                                                height="180"
                                                                src={`https://www.youtube.com/embed/${getYouTubeId(ex.videoUrl)}`}
                                                                frameBorder="0"
                                                                allowFullScreen
                                                            ></iframe>
                                                        </div>
                                                    ) : ex.videoUrl.match(/\.(mp4|mov|webm)$/i) || ex.videoUrl.includes('supabase.co') ? (
                                                        <video 
                                                            src={ex.videoUrl} 
                                                            controls 
                                                            style={{ width: 320, borderRadius: 8, background: '#000' }}
                                                        />
                                                    ) : (
                                                        <div style={{ width: 320, padding: 10, background: '#000', borderRadius: 8, color: 'white', textAlign: 'center' }}>
                                                            <a href={ex.videoUrl} target="_blank" rel="noreferrer" style={{ color: '#60a5fa' }}>Abrir Vídeo Externo ↗</a>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                            </div>
                        )}
                    </Draggable>
                    ))}
                    {provided.placeholder}
                </div>
            )}
        </Droppable>
      </DragDropContext>

      {exercises.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8', border: '2px dashed #e2e8f0', borderRadius: 12 }}>
              Nenhum exercício adicionado. Clique no botão acima para começar.
          </div>
      )}

      {msg && <div className="form-success" style={{ marginTop: 20 }}>{msg}</div>}
      
      {/* Modal de Seleção de Exercício */}
      {selectorOpen !== null && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: '#fff', borderRadius: 12, width: '90%', maxWidth: 500, maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
                <div style={{ padding: 16, borderBottom: '1px solid #e2e8f0', display: 'flex', gap: 10, alignItems: 'center' }}>
                    <Search size={20} color="#94a3b8" />
                    <input 
                        autoFocus
                        value={selectorSearch}
                        onChange={e => setSelectorSearch(e.target.value)}
                        placeholder="Buscar exercício..."
                        style={{ border: 'none', outline: 'none', fontSize: '1.1em', flex: 1 }}
                    />
                    <button onClick={() => setSelectorOpen(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                        <X size={24} />
                    </button>
                </div>
                <div style={{ overflowY: 'auto', padding: 8 }}>
                    {library
                        .filter(ex => ex.name.toLowerCase().includes(selectorSearch.toLowerCase()) || ex.muscle_group?.toLowerCase().includes(selectorSearch.toLowerCase()))
                        .map(ex => (
                        <div 
                            key={ex.id}
                            onClick={() => {
                                handleSelectLibraryExercise(selectorOpen, ex.id)
                                setSelectorOpen(null)
                            }}
                            style={{ 
                                padding: '12px 16px', borderRadius: 8, cursor: 'pointer',
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                transition: 'background 0.2s',
                                borderBottom: '1px solid #f1f5f9'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                            <div>
                                <div style={{ fontWeight: 600, color: '#334155' }}>{ex.name}</div>
                                {ex.muscle_group && <div style={{ fontSize: '0.85em', color: '#64748b' }}>{ex.muscle_group}</div>}
                            </div>
                            {ex.video_url && <Video size={16} color="#3b82f6" />}
                        </div>
                    ))}
                    {library.filter(ex => ex.name.toLowerCase().includes(selectorSearch.toLowerCase()) || ex.muscle_group?.toLowerCase().includes(selectorSearch.toLowerCase())).length === 0 && (
                        <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8' }}>Nenhum exercício encontrado</div>
                    )}
                </div>
            </div>
        </div>
      )}

      <div className="form-actions" style={{ marginTop: 30, padding: 20, background: '#fff', position: 'sticky', bottom: 0, boxShadow: '0 -4px 6px -1px rgba(0,0,0,0.1)', borderTop: '1px solid #e2e8f0', zIndex: 10 }}>
          <button className="btn" onClick={save} style={{ flex: 1, padding: 14, fontSize: '1.1em' }}>
            {editId ? 'Salvar Alterações' : 'Criar Treino'}
          </button>
          {editId && studentId && (
            <button
              className="btn"
              style={{ background: '#fee2e2', color: '#ef4444', border: '1px solid #fecaca' }}
              onClick={deletePersonalized}
            >
              Excluir Personalizado
            </button>
          )}
      </div>
    </div>
  )
}
