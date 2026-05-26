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

  if (error) throw error
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

  if (error) throw error
  if (data?.error) throw new Error(data.error)
}
