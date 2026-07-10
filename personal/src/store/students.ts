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

type StudentToggleResult = {
  success: boolean
  error?: string
}

type PersonalSubscriptionRow = {
  student_limit?: number | null
}

type PersonalProfileRow = {
  data?: {
    saas?: {
      studentLimit?: number
    }
  } | null
}

function normalizeStudentStatus(status: unknown): 'ativo' | 'inativo' {
  return status === 'inativo' ? 'inativo' : 'ativo'
}

async function getPersonalStudentLimit(personalId: string): Promise<number | null> {
  const { data: subscriptionData } = await supabase
    .from('personal_subscriptions')
    .select('student_limit')
    .eq('personal_id', personalId)
    .maybeSingle<PersonalSubscriptionRow>()

  if (typeof subscriptionData?.student_limit === 'number') {
    return subscriptionData.student_limit
  }

  const { data: profileData } = await supabase
    .from('profiles')
    .select('data')
    .eq('id', personalId)
    .maybeSingle<PersonalProfileRow>()

  const fallbackLimit = profileData?.data?.saas?.studentLimit
  return typeof fallbackLimit === 'number' ? fallbackLimit : null
}

async function countActiveStudentsByPersonal(personalId: string): Promise<number> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, data')
    .eq('personal_id', personalId)
    .eq('role', 'aluno')

  if (error) throw error

  return (data || []).filter((student: any) => normalizeStudentStatus(student?.data?.status) === 'ativo').length
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
    status: normalizeStudentStatus(d.data?.status),
    createdAt: d.created_at,
    lastAccess: d.data?.last_app_access_at,
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
  // Busca o dado RAW completo para não perder campos não mapeados (ex: config)
  const { data: rawCurrent, error: fetchErr } = await supabase
      .from('profiles')
      .select('data, full_name, email')
      .eq('id', id)
      .single()
  
  if (fetchErr) throw fetchErr

  const currentData = rawCurrent.data || {}

  const dbUpdates: any = {
    updated_at: new Date(),
    data: {
      ...currentData, // Mantém TUDO que já existe (incluindo config)
      ...(updates.address ? { address: updates.address } : {}),
      ...(updates.planId ? { planId: updates.planId } : {}),
      ...(updates.planStartDate ? { planStartDate: updates.planStartDate } : {}),
      ...(updates.dueDay ? { dueDay: updates.dueDay } : {}),
      ...(updates.workoutIds !== undefined ? { workoutIds: updates.workoutIds } : {}),
      ...(updates.workoutSchedule ? { workoutSchedule: updates.workoutSchedule } : {}),
      ...(updates.dietIds ? { dietIds: updates.dietIds } : {}),
      ...(updates.tempPassword ? { tempPassword: updates.tempPassword } : {}),
      ...(updates.email ? { email: updates.email } : {}),
      ...(updates.avatarUrl ? { avatarUrl: updates.avatarUrl } : {}), 
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
    status: normalizeStudentStatus(data.data?.status),
    createdAt: data.created_at,
    lastAccess: data.data?.last_app_access_at,
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

export async function toggleStudentActive(id: string, newStatus: 'ativo' | 'inativo'): Promise<StudentToggleResult> {
  const { data: current, error: fetchErr } = await supabase
      .from('profiles')
      .select('personal_id, data')
      .eq('id', id)
      .single()
  
  if (fetchErr) {
    return { success: false, error: 'Não foi possível localizar o aluno.' }
  }

  const currentStatus = normalizeStudentStatus(current?.data?.status)
  const personalId = typeof current?.personal_id === 'string' ? current.personal_id : ''

  if (newStatus === 'ativo' && currentStatus !== 'ativo' && personalId) {
    const studentLimit = await getPersonalStudentLimit(personalId)

    if (typeof studentLimit === 'number') {
      const activeStudents = await countActiveStudentsByPersonal(personalId)

      if (activeStudents >= studentLimit) {
        return {
          success: false,
          error: `Seu plano atual permite até ${studentLimit} alunos ativos. Faça upgrade para ativar mais alunos.`
        }
      }
    }
  }

  const newData = {
      ...current.data,
      status: newStatus
  }

  const { error } = await supabase
      .from('profiles')
      .update({ data: newData })
      .eq('id', id)
  
  if (error) {
    return { success: false, error: 'Não foi possível atualizar o status do aluno.' }
  }

  return { success: true }
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
        .select('student_id, finished_at') // Traz data para contar dias únicos
        .in('student_id', studentIds)
        .gte('finished_at', startOfWeek.toISOString())

    if (error) {
        console.error('Erro ao buscar frequência:', error)
        return {}
    }

    const freq: Record<string, number> = {}
    const studentDays: Record<string, Set<string>> = {}

    data.forEach(row => {
        if (!studentDays[row.student_id]) {
            studentDays[row.student_id] = new Set()
        }
        // Extrai apenas a data (YYYY-MM-DD) para contar dias únicos
        if (row.finished_at) {
            const date = new Date(row.finished_at).toISOString().split('T')[0]
            studentDays[row.student_id].add(date)
        }
    })

    // Converte Sets em contagem
    Object.keys(studentDays).forEach(sid => {
        freq[sid] = studentDays[sid].size
    })
    
    return freq
}
