import { supabase } from '../lib/supabase'

export type StudentRecord = {
  id: string
  personalId: string
  name: string
  email: string
  whatsapp?: string // Adicionado
  tempPassword?: string
  passwordNeedsReset?: boolean
  address?: {
    cep: string
    street: string
    neighborhood: string
    city: string
    state: string
    number?: string
    complement?: string
  }
  planId?: string
  planStartDate?: string // Data de início do plano atual (YYYY-MM-DD)
  dueDay?: number // Dia de vencimento personalizado do aluno
  workoutIds?: string[] // Mantido para compatibilidade, mas o vínculo real é via protocols table
  workoutSchedule?: Record<string, string[]> // { workoutId: ['seg', 'qua'] }
  dietIds?: string[]
  avatarUrl?: string
  status: 'ativo' | 'inativo'
  createdAt: string
  lastAccess?: string
}

export async function listStudentsByPersonal(personalId: string): Promise<StudentRecord[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('personal_id', personalId)
    .eq('role', 'aluno')
  
  if (error) {
    console.error('Erro ao listar alunos:', error)
    return []
  }

  return (data || []).map((d: any) => ({
    id: d.id,
    personalId: d.personal_id,
    name: d.full_name || '',
    email: d.email || d.data?.email || '',
    status: d.data?.status || 'ativo',
    createdAt: d.created_at,
    lastAccess: d.last_login_at,
    address: d.data?.address,
    planId: d.plan_id || d.data?.planId, // Prioriza coluna real
    planStartDate: d.data?.planStartDate,
    dueDay: d.due_day || d.data?.dueDay, // Prioriza coluna real
    workoutIds: d.data?.workoutIds,
    workoutSchedule: d.data?.workoutSchedule, // Mapeia do banco
    dietIds: d.data?.dietIds,
    avatarUrl: d.data?.avatarUrl,
    tempPassword: d.data?.tempPassword
  }))
}

export async function addStudent(s: Omit<StudentRecord, 'id' | 'createdAt' | 'status'>): Promise<StudentRecord | null> {
  console.warn('Criação de aluno via frontend requer Admin API.')
  return null
}

export async function updateStudent(id: string, updates: Partial<Omit<StudentRecord, 'id' | 'personalId' | 'status' | 'createdAt' | 'lastAccess'>>) {
  const current = await getStudent(id)
  const currentData = current ? { 
      address: current.address, 
      planId: current.planId, 
      planStartDate: current.planStartDate,
      dueDay: current.dueDay,
      workoutIds: current.workoutIds,
      workoutSchedule: current.workoutSchedule,
      dietIds: current.dietIds,
      tempPassword: current.tempPassword,
      status: current.status,
      avatarUrl: current.avatarUrl, // MANTEM A FOTO
      whatsapp: current.whatsapp // Mantém whatsapp
  } : {}

  const dbUpdates: any = {
    updated_at: new Date(),
    data: {
      ...currentData,
      ...(updates.address ? { address: updates.address } : {}),
      ...(updates.planId ? { planId: updates.planId } : {}),
      ...(updates.planStartDate ? { planStartDate: updates.planStartDate } : {}),
      ...(updates.dueDay ? { dueDay: updates.dueDay } : {}),
      ...(updates.workoutIds ? { workoutIds: updates.workoutIds } : {}),
      ...(updates.workoutSchedule ? { workoutSchedule: updates.workoutSchedule } : {}),
      ...(updates.dietIds ? { dietIds: updates.dietIds } : {}),
      ...(updates.tempPassword ? { tempPassword: updates.tempPassword } : {}),
      ...(updates.email ? { email: updates.email } : {}),
      ...(updates.avatarUrl ? { avatarUrl: updates.avatarUrl } : {}), // Atualiza se vier novo
      ...(updates.whatsapp !== undefined ? { whatsapp: updates.whatsapp } : {})
    }
  }

  if (updates.name) dbUpdates.full_name = updates.name
  if (updates.email) dbUpdates.email = updates.email

  const { error } = await supabase
    .from('profiles')
    .update(dbUpdates)
    .eq('id', id)
  
  if (error) throw error
}

export async function getStudent(id: string): Promise<StudentRecord | undefined> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) return undefined

  return {
    id: data.id,
    personalId: data.personal_id,
    name: data.full_name,
    email: data.email,
    whatsapp: data.data?.whatsapp,
    status: data.data?.status || 'ativo',
    createdAt: data.created_at,
    lastAccess: data.last_login_at,
    address: data.data?.address,
    planId: data.plan_id || data.data?.planId, // Prioriza coluna real
    planStartDate: data.data?.planStartDate,
    dueDay: data.due_day || data.data?.dueDay, // Prioriza coluna real
    workoutIds: data.data?.workoutIds,
    workoutSchedule: data.data?.workoutSchedule,
    dietIds: data.data?.dietIds,
    avatarUrl: data.data?.avatarUrl,
    tempPassword: data.data?.tempPassword
  }
}

export async function toggleStudentActive(id: string, newStatus: 'ativo' | 'inativo'): Promise<boolean> {
  const { data: current, error: fetchErr } = await supabase
      .from('profiles')
      .select('data')
      .eq('id', id)
      .single()
  
  if (fetchErr) return false

  const newData = {
      ...current.data,
      status: newStatus
  }

  const { error } = await supabase
      .from('profiles')
      .update({ data: newData })
      .eq('id', id)
  
  return !error
}

export async function getStudentsWeeklyFrequency(studentIds: string[]): Promise<Record<string, number>> {
    if (studentIds.length === 0) return {}
    
    // Pega o início da semana (Domingo)
    const today = new Date()
    const startOfWeek = new Date(today)
    startOfWeek.setDate(today.getDate() - today.getDay())
    startOfWeek.setHours(0,0,0,0)

    const { data, error } = await supabase
        .from('workout_history')
        .select('student_id')
        .in('student_id', studentIds)
        .gte('finished_at', startOfWeek.toISOString())

    if (error) {
        console.error('Erro ao buscar frequência:', error)
        return {}
    }

    const freq: Record<string, number> = {}
    data.forEach(row => {
        freq[row.student_id] = (freq[row.student_id] || 0) + 1
    })
    
    return freq
}