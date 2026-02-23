import { supabase } from '../lib/supabase'

export type WorkoutExercise = {
  name: string
  group: string
  series: string
  reps: string
  load: string
  rest: string
  notes?: string
  videoUrl?: string
}

export type WorkoutRecord = {
  id: string
  personalId: string
  studentId?: string
  name: string
  goal?: string
  createdAt?: string
  validUntil?: string
  notes?: string
  exercises: WorkoutExercise[]
  status: 'ativo' | 'inativo'
  updatedAt: string
  isFavorite?: boolean
}

// Helper para converter do banco para o tipo WorkoutRecord
function mapFromDb(d: any): WorkoutRecord {
  // Migração de dados de exercícios legados
  const exercises = (d.data?.exercises || []).map((ex: any) => ({
      ...ex,
      // Se tiver 'sets', usa como 'series' (migração) APENAS se for string (legado)
      // Se for array (novo formato), series deve ser string vazia ou pega do primeiro set
      series: ex.series || (typeof ex.sets === 'string' ? ex.sets : '') || '',
      // Garante que outros campos existam
      reps: ex.reps || '',
      load: ex.load || '',
      rest: ex.rest || '',
      // Mantém campos novos se existirem, senão strings vazias se forem esperados pelo front
      warmupSeries: ex.warmupSeries || '',
      warmupReps: ex.warmupReps || '',
      warmupLoad: ex.warmupLoad || '',
      warmupRest: ex.warmupRest || '',
      feederSeries: ex.feederSeries || '',
      feederReps: ex.feederReps || '',
      feederLoad: ex.feederLoad || '',
      feederRest: ex.feederRest || ''
  }))

  return {
    id: d.id,
    personalId: d.personal_id,
    studentId: d.student_id || undefined,
    name: d.title,
    status: d.status === 'active' ? 'ativo' : 'inativo',
    createdAt: d.created_at,
    updatedAt: d.updated_at,
    goal: d.data?.goal,
    validUntil: d.data?.validUntil,
    notes: d.data?.notes,
    isFavorite: d.data?.isFavorite || false,
    exercises: exercises
  }
}

export async function listActiveWorkouts(personalId: string): Promise<WorkoutRecord[]> {
  const { data, error } = await supabase
    .from('protocols')
    .select('*')
    .eq('personal_id', personalId)
    .eq('type', 'workout')
    .eq('status', 'active')
  
  if (error) return []
  return (data || [])
    .map(mapFromDb)
    .sort((a, b) => {
        // Favoritos primeiro
        if (a.isFavorite && !b.isFavorite) return -1
        if (!a.isFavorite && b.isFavorite) return 1
        // Depois por data de atualização (mais recente primeiro)
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    })
}

export async function listLibraryWorkouts(personalId: string): Promise<WorkoutRecord[]> {
  const { data, error } = await supabase
    .from('protocols')
    .select('*')
    .eq('personal_id', personalId)
    .eq('type', 'workout')
    .eq('status', 'active')
    .is('student_id', null) // Apenas modelos gerais
  
  if (error) return []
  return (data || [])
    .map(mapFromDb)
    .sort((a, b) => {
        // Favoritos primeiro
        if (a.isFavorite && !b.isFavorite) return -1
        if (!a.isFavorite && b.isFavorite) return 1
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    })
}

export async function listArchivedWorkouts(personalId: string): Promise<WorkoutRecord[]> {
  const { data, error } = await supabase
    .from('protocols')
    .select('*')
    .eq('personal_id', personalId)
    .eq('type', 'workout')
    .neq('status', 'active') // Inativo ou arquivado
  
  if (error) return []
  return (data || []).map(mapFromDb)
}

export async function listArchivedStudentWorkouts(personalId: string, studentId: string): Promise<WorkoutRecord[]> {
  const { data, error } = await supabase
    .from('protocols')
    .select('*')
    .eq('personal_id', personalId)
    .eq('student_id', studentId)
    .eq('type', 'workout')
    .neq('status', 'active')
  
  if (error) return []
  return (data || []).map(mapFromDb)
}

export async function listAllWorkouts(personalId: string): Promise<WorkoutRecord[]> {
  const { data, error } = await supabase
    .from('protocols')
    .select('*')
    .eq('personal_id', personalId)
    .eq('type', 'workout')
  
  if (error) return []
  return (data || []).map(mapFromDb)
}

export async function addWorkout(w: Omit<WorkoutRecord, 'id' | 'status' | 'updatedAt'>): Promise<WorkoutRecord | null> {
  const { data, error } = await supabase
    .from('protocols')
    .insert({
      personal_id: w.personalId,
      student_id: w.studentId || null,
      type: 'workout',
      title: w.name,
      status: 'active',
      // Mapeia data de validade para ends_at se quiser usar o campo nativo, mas vamos manter no JSON por compatibilidade
      data: {
        goal: w.goal,
        validUntil: w.validUntil,
        notes: w.notes,
        exercises: w.exercises || []
      }
    })
    .select()
    .single()

  if (error) {
    console.error('Erro ao criar treino:', error)
    return null
  }
  return mapFromDb(data)
}

export async function updateWorkout(id: string, patch: Partial<WorkoutRecord>): Promise<WorkoutRecord | null> {
  // Busca atual para merge
  const { data: current } = await supabase.from('protocols').select('*').eq('id', id).single()
  if (!current) return null

  const currentData = current.data || {}
  
  const updates: any = {
    updated_at: new Date().toISOString()
  }
  if (patch.name) updates.title = patch.name
  if (patch.studentId !== undefined) updates.student_id = patch.studentId || null
  if (patch.status) updates.status = patch.status === 'ativo' ? 'active' : 'archived'
  
  // Merge data
  if (patch.goal || patch.validUntil || patch.notes || patch.exercises) {
    updates.data = {
      ...currentData,
      ...(patch.goal ? { goal: patch.goal } : {}),
      ...(patch.validUntil ? { validUntil: patch.validUntil } : {}),
      ...(patch.notes ? { notes: patch.notes } : {}),
      ...(patch.exercises ? { exercises: patch.exercises } : {})
    }
  }

  const { data, error } = await supabase
    .from('protocols')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return null
  return mapFromDb(data)
}

export async function setWorkoutStatus(id: string, status: 'ativo' | 'inativo'): Promise<WorkoutRecord | null> {
  return updateWorkout(id, { status })
}

export async function getWorkoutById(id: string): Promise<WorkoutRecord | undefined> {
  const { data, error } = await supabase
    .from('protocols')
    .select('*')
    .eq('id', id)
    .single()
  
  if (error || !data) return undefined
  return mapFromDb(data)
}

export async function deleteWorkoutIfPersonalized(id: string): Promise<boolean> {
  const w = await getWorkoutById(id)
  if (!w || !w.studentId) return false
  
  const { error } = await supabase.from('protocols').delete().eq('id', id)
  return !error
}

export async function deleteWorkout(id: string): Promise<boolean> {
  const { error } = await supabase.from('protocols').delete().eq('id', id)
  return !error
}

export async function duplicateWorkout(originalId: string, studentId: string, newTitle?: string): Promise<WorkoutRecord | null> {
  const original = await getWorkoutById(originalId)
  if (!original) return null

  let finalTitle = newTitle || original.name

  // LIMPEZA DE NOME: Se o treino original pertencia a outro aluno, tenta remover o sufixo " - Nome" antigo
  if (!newTitle && original.studentId && original.studentId !== studentId) {
      try {
        const { data: oldStudent } = await supabase.from('profiles').select('full_name').eq('id', original.studentId).single()
        if (oldStudent?.full_name) {
            const oldFirstName = oldStudent.full_name.split(' ')[0]
            const oldSuffix = ` - ${oldFirstName}`
            // Verifica se termina com " - NomeAntigo"
            if (finalTitle.endsWith(oldSuffix)) {
                finalTitle = finalTitle.slice(0, -oldSuffix.length)
            }
        }
      } catch (err) {
        console.warn('Erro ao limpar nome antigo do treino:', err)
      }
  }

  // Se não foi passado um título novo e estamos vinculando a um aluno,
  // adiciona o nome do aluno ao título para fácil identificação
  if (!newTitle && studentId) {
      const { data: student } = await supabase.from('profiles').select('full_name').eq('id', studentId).single()
      if (student?.full_name) {
          const firstName = student.full_name.split(' ')[0]
          const suffix = ` - ${firstName}`
          
          // Evita duplicação do sufixo (ex: "Treino - Alex - Alex")
          if (original.name.endsWith(suffix)) {
              finalTitle = original.name
          } else {
              finalTitle = `${original.name}${suffix}`
          }
      }
  }

  return addWorkout({
    personalId: original.personalId,
    studentId: studentId, // Vincula ao aluno
    name: finalTitle,
    goal: original.goal,
    validUntil: original.validUntil,
    notes: original.notes,
    exercises: original.exercises // Copia exercícios
  })
}

export async function toggleWorkoutFavorite(id: string): Promise<WorkoutRecord | null> {
    const w = await getWorkoutById(id)
    if (!w) return null
    
    // Toggle
    const newStatus = !w.isFavorite
    
    // Atualiza apenas o campo isFavorite dentro do JSON data
    // Precisa buscar o raw data atual para não perder outros campos
    const { data: current } = await supabase.from('protocols').select('data').eq('id', id).single()
    const currentData = current?.data || {}
    
    const { data, error } = await supabase
        .from('protocols')
        .update({
            data: { ...currentData, isFavorite: newStatus },
            updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single()

    if (error) return null
    return mapFromDb(data)
}

// Funções legadas (sem uso no Supabase)
export function hasUnknownWorkouts() { return false }
export function claimUnknownWorkouts() {}
