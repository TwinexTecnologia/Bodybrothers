import { supabase } from './supabase'

type CreateStudentAuthInput = {
  personalId: string
  name: string
  email: string
  password: string
  profileData: Record<string, unknown>
}

type UpdateStudentAuthInput = {
  studentId: string
  email?: string
  password?: string
}

type StudentAuthResponse = {
  userId: string
}

export async function createStudentAuthUser(input: CreateStudentAuthInput): Promise<StudentAuthResponse> {
  const { data, error } = await supabase.functions.invoke('manage-student-auth', {
    body: {
      action: 'create',
      ...input,
    },
  })

  if (error) {
    throw new Error(await extractFunctionErrorMessage(error, 'Não foi possível criar o aluno.'))
  }
  if (data?.error) throw new Error(data.error)
  if (!data?.userId) throw new Error('Resposta inválida ao criar aluno.')

  return data as StudentAuthResponse
}

export async function updateStudentAuthCredentials(input: UpdateStudentAuthInput): Promise<void> {
  const payload: Record<string, unknown> = {
    action: 'update_credentials',
    studentId: input.studentId,
  }

  if (input.email) payload.email = input.email
  if (input.password) payload.password = input.password

  const { data, error } = await supabase.functions.invoke('manage-student-auth', {
    body: payload,
  })

  if (error) {
    throw new Error(await extractFunctionErrorMessage(error, 'Não foi possível atualizar as credenciais do aluno.'))
  }
  if (data?.error) throw new Error(data.error)
}

async function extractFunctionErrorMessage(error: unknown, fallback: string): Promise<string> {
  if (error instanceof Error && error.message && !error.message.includes('non-2xx')) {
    return error.message
  }

  const context = (error as { context?: Response })?.context
  if (context && typeof context.json === 'function') {
    const payload = await context.json().catch(() => null) as { error?: string } | null
    if (payload?.error) return payload.error
  }

  if (error instanceof Error && error.message) {
    return error.message
  }

  return fallback
}
