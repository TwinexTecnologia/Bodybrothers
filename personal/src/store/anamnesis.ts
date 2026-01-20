import { supabase } from '../lib/supabase'

export type AnamnesisQuestion = {
  id: string
  text: string
  type: 'text' | 'number' | 'boolean' | 'select' | 'multi' | 'photo'
  options?: string[]
  allowCustom?: boolean
  multiple?: boolean
  required?: boolean
  exampleImage?: string // Imagem de exemplo/referência para a pergunta
}

export type AnamnesisModel = {
  id: string
  personalId: string
  studentId?: string
  name: string
  goal?: string
  questions: AnamnesisQuestion[]
  validUntil?: string
  updatedAt: string
}

export type AnamnesisResponse = {
  id: string
  personalId: string
  studentId: string
  modelId: string
  createdAt: string
  answers: Record<string, string | string[] | boolean | number>
  renewEveryDays?: number
  countFromDate?: string
  dueDate?: string
}

// Helpers para mapear do Banco
function mapModelFromDb(d: any): AnamnesisModel {
  return {
    id: d.id,
    personalId: d.personal_id,
    studentId: d.student_id,
    name: d.title || 'Sem título',
    goal: d.data?.goal,
    questions: d.data?.questions || [],
    validUntil: d.ends_at,
    updatedAt: d.updated_at
  }
}

export async function listAllAnamnesis(personalId: string): Promise<AnamnesisModel[]> {
  const { data, error } = await supabase
    .from('protocols')
    .select('*')
    .eq('personal_id', personalId)
    .eq('type', 'anamnesis_model')
  
  if (error) return []
  return (data || []).map(mapModelFromDb)
}

export async function listPendingAnamneses(personalId: string): Promise<AnamnesisResponse[]> {
  const today = new Date().toISOString().split('T')[0]
  const { data, error } = await supabase
    .from('protocols')
    .select('*')
    .eq('personal_id', personalId)
    .eq('type', 'anamnesis')
    .not('ends_at', 'is', null)
    .lt('ends_at', today)

  if (error) return []
  return (data || []).map(mapResponseFromDb)
}

function mapResponseFromDb(d: any): AnamnesisResponse {
    return {
        id: d.id,
        personalId: d.personal_id,
        studentId: d.student_id,
        modelId: d.data?.modelId || '',
        createdAt: d.created_at,
        answers: d.data?.answers || {},
        renewEveryDays: d.renew_in_days,
        countFromDate: d.starts_at,
        dueDate: d.ends_at
    }
}

export async function listModels(personalId: string): Promise<AnamnesisModel[]> {
  const { data, error } = await supabase
    .from('protocols')
    .select('*')
    .eq('personal_id', personalId)
    .eq('type', 'anamnesis_model')
  
  if (error) return []
  return (data || []).map(mapModelFromDb)
}

export async function getModelById(id: string): Promise<AnamnesisModel | undefined> {
  const { data, error } = await supabase
    .from('protocols')
    .select('*')
    .eq('id', id)
    .single()
  
  if (error || !data) return undefined
  return mapModelFromDb(data)
}

export async function addModel(m: Omit<AnamnesisModel, 'id' | 'updatedAt'>): Promise<AnamnesisModel | null> {
  const { data, error } = await supabase
    .from('protocols')
    .insert({
        personal_id: m.personalId,
        type: 'anamnesis_model',
        title: m.name,
        data: {
            goal: m.goal,
            questions: m.questions
        }
    })
    .select()
    .single()

  if (error) return null
  return mapModelFromDb(data)
}

export async function updateModel(id: string, patch: Partial<AnamnesisModel>): Promise<AnamnesisModel | null> {
  // Busca atual para merge
  const { data: current } = await supabase.from('protocols').select('data').eq('id', id).single()
  const currentData = current?.data || {}
  
  const updates: any = { updated_at: new Date().toISOString() }
  if (patch.name) updates.title = patch.name
  if (patch.studentId !== undefined) updates.student_id = patch.studentId || null
  
  if (patch.goal || patch.questions) {
      updates.data = {
          ...currentData,
          ...(patch.goal ? { goal: patch.goal } : {}),
          ...(patch.questions ? { questions: patch.questions } : {})
      }
  }

  const { data, error } = await supabase
    .from('protocols')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return null
  return mapModelFromDb(data)
}

export async function deleteModel(id: string): Promise<boolean> {
  const { error } = await supabase.from('protocols').delete().eq('id', id)
  return !error
}

export async function listResponsesByStudent(personalId: string, studentId: string): Promise<AnamnesisResponse[]> {
  const { data, error } = await supabase
    .from('protocols')
    .select('*')
    .eq('personal_id', personalId)
    .eq('student_id', studentId)
    .eq('type', 'anamnesis')

  if (error) return []
  return (data || []).map(mapResponseFromDb)
}

export async function listResponsesByPersonal(personalId: string): Promise<AnamnesisResponse[]> {
  const { data, error } = await supabase
    .from('protocols')
    .select('*')
    .eq('personal_id', personalId)
    .eq('type', 'anamnesis')

  if (error) return []
  return (data || []).map(mapResponseFromDb)
}

export async function addResponse(r: Omit<AnamnesisResponse, 'id' | 'createdAt'>): Promise<AnamnesisResponse | null> {
  const { data, error } = await supabase
    .from('protocols')
    .insert({
        personal_id: r.personalId,
        student_id: r.studentId,
        type: 'anamnesis',
        title: 'Anamnese Aplicada', // Título genérico ou data
        renew_in_days: r.renewEveryDays,
        starts_at: r.countFromDate || null,
        ends_at: r.dueDate || null,
        data: {
            modelId: r.modelId,
            answers: r.answers
        }
    })
    .select()
    .single()

  if (error) return null
  return mapResponseFromDb(data)
}

export async function getResponseById(id: string): Promise<AnamnesisResponse | undefined> {
  const { data, error } = await supabase
    .from('protocols')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) return undefined
  return mapResponseFromDb(data)
}

export async function duplicateModel(originalId: string, studentId: string, daysValid: number = 90): Promise<AnamnesisModel | null> {
  const original = await getModelById(originalId)
  if (!original) return null

  const validDate = new Date()
  validDate.setDate(validDate.getDate() + daysValid)

  const { data, error } = await supabase
    .from('protocols')
    .insert({
        personal_id: original.personalId,
        student_id: studentId, // Vínculo exclusivo
        type: 'anamnesis_model',
        title: `${original.name}`,
        ends_at: validDate.toISOString().split('T')[0],
        data: {
            goal: original.goal,
            questions: original.questions
        }
    })
    .select()
    .single()

  if (error) {
    console.error('Erro ao duplicar anamnese:', error)
    return null
  }
  return mapModelFromDb(data)
}

export async function listStudentModels(personalId: string, studentId: string): Promise<AnamnesisModel[]> {
  const { data, error } = await supabase
    .from('protocols')
    .select('*')
    .eq('personal_id', personalId)
    .eq('student_id', studentId) // Busca modelos específicos do aluno
    .eq('type', 'anamnesis_model')
    .eq('status', 'active') // Apenas ativos
  
  if (error) return []
  return (data || []).map(mapModelFromDb)
}

export async function listArchivedStudentModels(personalId: string, studentId: string): Promise<AnamnesisModel[]> {
  const { data, error } = await supabase
    .from('protocols')
    .select('*')
    .eq('personal_id', personalId)
    .eq('student_id', studentId)
    .eq('type', 'anamnesis_model')
    .neq('status', 'active')
  
  if (error) return []
  return (data || []).map(mapModelFromDb)
}

export async function listLibraryModels(personalId: string): Promise<AnamnesisModel[]> {
  // Lista modelos da biblioteca (sem student_id) + modelos de ALUNOS INATIVOS que não foram deletados
  // Na verdade, a biblioteca deve mostrar:
  // 1. Modelos sem student_id (Padrão)
  // 2. Modelos com student_id mas que você quer reaproveitar? Geralmente não.
  // O pedido foi: "quando eu tirar do aluno ele vira biblioteca mas fica arquivado"
  // E "não deixa como ativo nao se nao fica muito poluido"
  // Então listLibraryModels deve trazer APENAS os ativos sem student_id.
  
  // Se o usuário quiser resgatar um "arquivado", ele precisaria de uma tela de "Arquivados".
  // OU, podemos fazer com que ao desvincular, ele vire 'ativo' porem sem student_id?
  // O usuário disse: "vira biblioteca mas fica arquivado ok ? nao deixa como ativo nao"
  // Isso significa status = 'inativo'.
  
  // Então listLibraryModels só pega status = 'ativo' e student_id is null.
  // Isso já é o padrão.
  
  const { data, error } = await supabase
    .from('protocols')
    .select('*')
    .eq('personal_id', personalId)
    .eq('type', 'anamnesis_model')
    .is('student_id', null)
    .eq('status', 'active') // Garante que inativos não apareçam
    .order('title')
  
  if (error) {
    console.error('Erro ao listar biblioteca anamnese:', error)
    return []
  }

  return (data || []).map(mapModelFromDb)
}

export async function reloadLibraryAnamnesis() {
  // Função auxiliar para recarregar se necessário, mas o hook no componente já faz
}
