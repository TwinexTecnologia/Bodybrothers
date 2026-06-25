import { supabase } from './supabase'

const DUPLICATE_EMAIL_MESSAGE = 'Este e-mail já está cadastrado em outro acesso, tente outro email.'

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
    throw await normalizeFunctionInvokeError(error)
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
    throw await normalizeFunctionInvokeError(error)
  }
  if (data?.error) throw new Error(data.error)
}

async function normalizeFunctionInvokeError(error: unknown): Promise<Error> {
  const fallbackMessage =
    error instanceof Error ? error.message : 'Erro ao processar a requisição.'
  const response = (error as { context?: Response } | null)?.context

  let detailedMessage = ''

  if (response instanceof Response) {
    try {
      const payload = await response.clone().json()
      if (payload && typeof payload.error === 'string') {
        detailedMessage = payload.error.trim()
      }
    } catch {
      // Ignora erros de parsing e usa a mensagem padrão.
    }
  }

  const message = detailedMessage || fallbackMessage
  const normalizedMessage = message.toLowerCase()

  if (
    normalizedMessage.includes('already registered') ||
    normalizedMessage.includes('already been registered') ||
    normalizedMessage.includes('email address has already been registered')
  ) {
    return new Error(DUPLICATE_EMAIL_MESSAGE)
  }

  return new Error(message)
}
