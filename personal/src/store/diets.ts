import { supabase } from '../lib/supabase'

export type DietSubstitute = {
  name: string
  quantity: string
  unit: string
}

export type DietFood = {
  name: string
  quantity: string
  unit: string
  notes?: string
  substitutes?: DietSubstitute[]
  // Macros e Metadados
  calories?: string
  protein?: string
  carbs?: string
  fat?: string
  sodium?: string
  food_id?: string
  base_calories_100g?: string
  base_protein_100g?: string
  base_carbs_100g?: string
  base_fat_100g?: string
  base_sodium_100g?: string
  base_unit_weight?: number // Peso em gramas de 1 unidade (se aplicável)
}

export type DietMeal = {
  title: string
  time: string
  foods: DietFood[]
  notes?: string
}

export type DietVariant = {
  id: string
  name: string
  meals: DietMeal[]
}

export type DietRecord = {
  id: string
  personalId: string
  studentId?: string
  name: string
  goal?: string
  startDate?: string
  endDate?: string
  meals: DietMeal[]
  variants?: DietVariant[]
  supplements?: DietFood[]
  notes?: string
  status: 'ativa' | 'inativa'
  updatedAt: string
  isFavorite?: boolean
}

// Helpers para converter do banco para o tipo DietRecord
function mapFromDb(d: any): DietRecord {
  return {
    id: d.id,
    personalId: d.personal_id,
    studentId: d.student_id || undefined,
    name: d.title,
    status: d.status === 'active' ? 'ativa' : 'inativa',
    startDate: d.starts_at,
    endDate: d.ends_at,
    updatedAt: d.updated_at,
    goal: d.data?.goal,
    meals: d.data?.meals || [],
    variants: d.data?.variants || [],
    supplements: d.data?.supplements || [],
    notes: d.data?.notes,
    isFavorite: d.data?.isFavorite || false
  }
}

export async function listActiveDiets(personalId: string): Promise<DietRecord[]> {
  const { data, error } = await supabase
    .from('protocols')
    .select('*')
    .eq('personal_id', personalId)
    .eq('type', 'diet')
    .eq('status', 'active')
  
  if (error) return []
  return (data || [])
    .map(mapFromDb)
    .sort((a, b) => {
        if (a.isFavorite && !b.isFavorite) return -1
        if (!a.isFavorite && b.isFavorite) return 1
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    })
}

export async function listArchivedDiets(personalId: string): Promise<DietRecord[]> {
  const { data, error } = await supabase
    .from('protocols')
    .select('*')
    .eq('personal_id', personalId)
    .eq('type', 'diet')
    .neq('status', 'active') // Inativa ou arquivada
  
  if (error) return []
  return (data || []).map(mapFromDb)
}

export async function listArchivedStudentDiets(personalId: string, studentId: string): Promise<DietRecord[]> {
  const { data, error } = await supabase
    .from('protocols')
    .select('*')
    .eq('personal_id', personalId)
    .eq('student_id', studentId)
    .eq('type', 'diet')
    .neq('status', 'active')
  
  if (error) return []
  return (data || []).map(mapFromDb)
}

export async function addDiet(d: Omit<DietRecord, 'id' | 'status' | 'updatedAt'>): Promise<DietRecord | null> {
  const { data, error } = await supabase
    .from('protocols')
    .insert({
      personal_id: d.personalId,
      student_id: d.studentId || null,
      type: 'diet',
      title: d.name,
      status: 'active',
      starts_at: d.startDate || null,
      ends_at: d.endDate || null,
      data: {
        goal: d.goal,
        meals: d.meals || [],
        variants: d.variants || [],
        supplements: d.supplements || [],
        notes: d.notes
      }
    })
    .select()
    .single()

  if (error) {
    console.error('Erro ao criar dieta:', error)
    return null
  }
  return mapFromDb(data)
}

export async function updateDiet(id: string, patch: Partial<DietRecord>): Promise<DietRecord | null> {
  // Precisa buscar o atual para mergear o data JSON se necessário?
  // Supabase update em JSONB substitui o objeto inteiro se passar direto.
  // Vamos buscar primeiro para garantir integridade do campo data.
  const { data: current } = await supabase.from('protocols').select('*').eq('id', id).single()
  if (!current) return null

  const currentData = current.data || {}
  
  const updates: any = {
    updated_at: new Date().toISOString()
  }
  if (patch.name) updates.title = patch.name
  if (patch.studentId !== undefined) updates.student_id = patch.studentId || null
  if (patch.status) updates.status = patch.status === 'ativa' ? 'active' : 'archived'
  if (patch.startDate !== undefined) updates.starts_at = patch.startDate || null
  if (patch.endDate !== undefined) updates.ends_at = patch.endDate || null
  
  // Merge data
  if (patch.goal || patch.meals || patch.variants || patch.supplements || patch.notes) {
    updates.data = {
      ...currentData,
      ...(patch.goal ? { goal: patch.goal } : {}),
      ...(patch.meals ? { meals: patch.meals } : {}),
      ...(patch.variants ? { variants: patch.variants } : {}),
      ...(patch.supplements ? { supplements: patch.supplements } : {}),
      ...(patch.notes ? { notes: patch.notes } : {})
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

export async function setDietStatus(id: string, status: 'ativa' | 'inativa'): Promise<DietRecord | null> {
  return updateDiet(id, { status })
}

export async function getDietById(id: string): Promise<DietRecord | undefined> {
  const { data, error } = await supabase
    .from('protocols')
    .select('*')
    .eq('id', id)
    .single()
  
  if (error || !data) return undefined
  return mapFromDb(data)
}

export async function deleteDietIfPersonalized(id: string): Promise<boolean> {
  const diet = await getDietById(id)
  if (!diet || !diet.studentId) return false
  
  const { error } = await supabase.from('protocols').delete().eq('id', id)
  return !error
}

export async function deleteDiet(id: string): Promise<boolean> {
  const { error } = await supabase.from('protocols').delete().eq('id', id)
  return !error
}

export async function listStudentDiets(personalId: string, studentId: string): Promise<DietRecord[]> {
  const { data, error } = await supabase
    .from('protocols')
    .select('*')
    .eq('personal_id', personalId)
    .eq('student_id', studentId)
    .eq('type', 'diet')
    .eq('status', 'active')
  
  if (error) return []
  return (data || []).map(mapFromDb)
}

export async function duplicateDiet(originalId: string, studentId: string): Promise<DietRecord | null> {
  const original = await getDietById(originalId)
  if (!original) return null

  let finalTitle = `${original.name}`

  // Adiciona nome do aluno para identificar fácil na lista geral
  if (studentId) {
      const { data: student } = await supabase.from('profiles').select('full_name').eq('id', studentId).single()
      if (student?.full_name) {
          const firstName = student.full_name.split(' ')[0]
          const suffix = ` - ${firstName}`
          
          // Evita duplicação do sufixo
          if (original.name.endsWith(suffix)) {
              finalTitle = original.name
          } else {
              finalTitle = `${original.name}${suffix}`
          }
      }
  }

  // Cria cópia vinculada ao aluno
  return addDiet({
      personalId: original.personalId,
      studentId: studentId,
      name: finalTitle,
      goal: original.goal,
      meals: original.meals,
      variants: original.variants,
      supplements: original.supplements,
      notes: original.notes,
      startDate: new Date().toISOString().split('T')[0]
  })
}

export async function toggleDietFavorite(id: string): Promise<DietRecord | null> {
    const d = await getDietById(id)
    if (!d) return null
    
    const newStatus = !d.isFavorite
    
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

export async function listAllDietsByPersonal(personalId: string): Promise<DietRecord[]> {
  const { data, error } = await supabase
    .from('protocols')
    .select('*')
    .eq('personal_id', personalId)
    .eq('type', 'diet')
    .eq('status', 'active')
  
  if (error) return []
  return (data || []).map(mapFromDb)
}

// Funções deprecated (Local Storage Clean up helpers, não usadas no Supabase)
export function hasUnknownDiets() { return false }
export function claimUnknownDiets() {}
