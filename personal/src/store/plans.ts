import { supabase } from '../lib/supabase'

export type PlanFrequency = 'weekly' | 'monthly' | 'bimonthly' | 'quarterly' | 'semiannual' | 'annual'

export type PlanRecord = {
  id: string
  personalId: string
  name: string
  price: number
  dueDay: number
  frequency: PlanFrequency
  createdAt: string
  active?: boolean
}

// Helpers para converter do banco
function mapFromDb(d: any): PlanRecord {
  return {
    id: d.id,
    personalId: d.personal_id,
    name: d.title,
    price: Number(d.price),
    dueDay: d.due_day,
    frequency: d.frequency || 'monthly', // Default para monthly
    createdAt: d.created_at,
    active: d.active
  }
}

export async function listPlans(personalId: string): Promise<PlanRecord[]> {
  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .eq('personal_id', personalId)
    .eq('active', true)
  
  if (error) {
      console.error('Erro ao listar planos:', error)
      return []
  }
  return (data || []).map(mapFromDb)
}

export async function addPlan(p: Omit<PlanRecord, 'id' | 'createdAt'>): Promise<PlanRecord | null> {
  const { data, error } = await supabase
    .from('plans')
    .insert({
      personal_id: p.personalId,
      title: p.name,
      price: p.price,
      due_day: p.dueDay,
      frequency: p.frequency,
      active: true
    })
    .select()
    .single()

  if (error) {
    console.error('Erro ao criar plano:', error)
    return null
  }
  return mapFromDb(data)
}

export async function deletePlan(id: string): Promise<boolean> {
  // Soft delete (inativar) é mais seguro para histórico financeiro
  const { error } = await supabase
    .from('plans')
    .update({ active: false })
    .eq('id', id)
  
  return !error
}

export async function getPlan(id: string): Promise<PlanRecord | null> {
  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) return null
  return mapFromDb(data)
}

export async function updatePlan(id: string, updates: Partial<Omit<PlanRecord, 'id' | 'createdAt' | 'personalId'>>): Promise<boolean> {
  const dbUpdates: any = {}
  if (updates.name) dbUpdates.title = updates.name
  if (updates.price !== undefined) dbUpdates.price = updates.price
  if (updates.dueDay !== undefined) dbUpdates.due_day = updates.dueDay
  if (updates.frequency) dbUpdates.frequency = updates.frequency
  if (updates.active !== undefined) dbUpdates.active = updates.active

  const { error } = await supabase
    .from('plans')
    .update(dbUpdates)
    .eq('id', id)

  if (error) {
      console.error('Erro ao atualizar plano:', error)
      return false
  }
  return true
}
