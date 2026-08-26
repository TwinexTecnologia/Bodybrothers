import { supabase } from '../lib/supabase'

export type SupportThreadRecord = {
  id: string
  personalId: string
  status: 'open' | 'in_progress' | 'closed'
  subject: string | null
  summary: string | null
  createdAt: string
  updatedAt: string
  lastMessageAt: string
  closedAt: string | null
  closedBy: string | null
  personalName: string
  personalEmail: string
}

export type SupportMessageRecord = {
  id: string
  threadId: string
  senderId: string
  senderRole: 'personal' | 'owner'
  message: string
  createdAt: string
}

export type SupportAttachmentRecord = {
  id: string
  threadId: string
  messageId: string | null
  uploadedBy: string | null
  fileName: string
  filePath: string
  fileUrl: string
  mimeType: string | null
  sizeBytes: number | null
  retainedInSummary: boolean
  createdAt: string
}

type DbSupportThread = {
  id: string
  personal_id: string
  status: SupportThreadRecord['status']
  subject: string | null
  summary: string | null
  created_at: string
  updated_at: string
  last_message_at: string
  closed_at: string | null
  closed_by: string | null
}

type DbSupportMessage = {
  id: string
  thread_id: string
  sender_id: string
  sender_role: SupportMessageRecord['senderRole']
  message: string
  created_at: string
}

type DbSupportAttachment = {
  id: string
  thread_id: string
  message_id: string | null
  uploaded_by: string | null
  file_name: string
  file_path: string
  file_url: string
  mime_type: string | null
  size_bytes: number | null
  retained_in_summary: boolean
  created_at: string
}

type PersonalProfileRow = {
  id: string
  full_name: string | null
  email: string | null
}

function mapMessage(row: DbSupportMessage): SupportMessageRecord {
  return {
    id: row.id,
    threadId: row.thread_id,
    senderId: row.sender_id,
    senderRole: row.sender_role,
    message: row.message,
    createdAt: row.created_at,
  }
}

function mapAttachment(row: DbSupportAttachment): SupportAttachmentRecord {
  return {
    id: row.id,
    threadId: row.thread_id,
    messageId: row.message_id,
    uploadedBy: row.uploaded_by,
    fileName: row.file_name,
    filePath: row.file_path,
    fileUrl: row.file_url,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    retainedInSummary: row.retained_in_summary,
    createdAt: row.created_at,
  }
}

export async function listSupportThreads() {
  const { data, error } = await supabase
    .from('support_threads')
    .select('id, personal_id, status, subject, summary, created_at, updated_at, last_message_at, closed_at, closed_by')
    .order('status', { ascending: true })
    .order('last_message_at', { ascending: false })

  if (error) throw error

  const rows = (data || []) as DbSupportThread[]
  const personalIds = Array.from(new Set(rows.map((row) => row.personal_id).filter(Boolean)))
  const personalMap = new Map<string, PersonalProfileRow>()

  if (personalIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', personalIds)

    if (profilesError) throw profilesError

    ;((profiles || []) as PersonalProfileRow[]).forEach((profile) => {
      personalMap.set(profile.id, profile)
    })
  }

  return rows.map((row) => {
    const personal = personalMap.get(row.personal_id)
    return {
      id: row.id,
      personalId: row.personal_id,
      status: row.status,
      subject: row.subject,
      summary: row.summary,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastMessageAt: row.last_message_at,
      closedAt: row.closed_at,
      closedBy: row.closed_by,
      personalName: personal?.full_name || 'Personal sem nome',
      personalEmail: personal?.email || '',
    } satisfies SupportThreadRecord
  })
}

export async function listSupportMessages(threadId: string) {
  const { data, error } = await supabase
    .from('support_messages')
    .select('id, thread_id, sender_id, sender_role, message, created_at')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return ((data || []) as DbSupportMessage[]).map(mapMessage)
}

export async function listSupportAttachments(threadId: string) {
  const { data, error } = await supabase
    .from('support_attachments')
    .select('id, thread_id, message_id, uploaded_by, file_name, file_path, file_url, mime_type, size_bytes, retained_in_summary, created_at')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return ((data || []) as DbSupportAttachment[]).map(mapAttachment)
}

async function createSupportAttachment(params: {
  threadId: string
  uploadedBy: string
  file: File
  messageId?: string | null
  retainedInSummary?: boolean
}) {
  const cleanName = params.file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const filePath = `support-chat/${params.threadId}/${Date.now()}_${Math.random().toString(36).slice(2)}_${cleanName}`

  const { error: uploadError } = await supabase.storage
    .from('anamnesis-files')
    .upload(filePath, params.file, { upsert: false })

  if (uploadError) throw uploadError

  const { data: publicData } = supabase.storage.from('anamnesis-files').getPublicUrl(filePath)

  const { data, error } = await supabase
    .from('support_attachments')
    .insert({
      thread_id: params.threadId,
      message_id: params.messageId || null,
      uploaded_by: params.uploadedBy,
      file_name: params.file.name,
      file_path: filePath,
      file_url: publicData.publicUrl,
      mime_type: params.file.type || null,
      size_bytes: params.file.size,
      retained_in_summary: !!params.retainedInSummary,
    })
    .select('id, thread_id, message_id, uploaded_by, file_name, file_path, file_url, mime_type, size_bytes, retained_in_summary, created_at')
    .single<DbSupportAttachment>()

  if (error) throw error
  return mapAttachment(data)
}

export async function sendOwnerSupportMessage(threadId: string, message: string, files: File[] = []) {
  const trimmedMessage = message.trim()
  if (!trimmedMessage && files.length === 0) return

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError) throw userError
  if (!user) throw new Error('Sessao expirada. Entre novamente para responder o atendimento.')

  const now = new Date().toISOString()
  let messageId: string | null = null

  if (trimmedMessage) {
    const { data: insertedMessage, error } = await supabase
      .from('support_messages')
      .insert({
        thread_id: threadId,
        sender_id: user.id,
        sender_role: 'owner',
        message: trimmedMessage,
      })
      .select('id')
      .single<{ id: string }>()

    if (error) throw error
    messageId = insertedMessage.id
  }

  for (const file of files) {
    await createSupportAttachment({
      threadId,
      uploadedBy: user.id,
      file,
      messageId,
    })
  }

  const { error: threadError } = await supabase
    .from('support_threads')
    .update({
      status: 'in_progress',
      updated_at: now,
      last_message_at: now,
    })
    .eq('id', threadId)

  if (threadError) throw threadError
}

export async function uploadOwnerSupportAttachment(threadId: string, file: File) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError) throw userError
  if (!user) throw new Error('Sessao expirada. Entre novamente para enviar anexos.')

  const now = new Date().toISOString()
  const attachment = await createSupportAttachment({
    threadId,
    uploadedBy: user.id,
    file,
  })

  const { error: threadError } = await supabase
    .from('support_threads')
    .update({
      status: 'in_progress',
      updated_at: now,
      last_message_at: now,
    })
    .eq('id', threadId)

  if (threadError) throw threadError

  return attachment
}

export async function finalizeSupportThread(threadId: string, subject: string, summary: string, files: File[] = []) {
  const trimmedSubject = subject.trim()
  const trimmedSummary = summary.trim()

  if (!trimmedSubject) throw new Error('Informe o assunto antes de finalizar.')
  if (!trimmedSummary) throw new Error('Informe a descricao antes de finalizar.')

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError) throw userError
  if (!user) throw new Error('Sessao expirada. Entre novamente para finalizar o atendimento.')

  const now = new Date().toISOString()

  for (const file of files) {
    await createSupportAttachment({
      threadId,
      uploadedBy: user.id,
      file,
      retainedInSummary: true,
    })
  }

  const { error: threadError } = await supabase
    .from('support_threads')
    .update({
      status: 'closed',
      subject: trimmedSubject,
      summary: trimmedSummary,
      updated_at: now,
      closed_at: now,
      closed_by: user.id,
    })
    .eq('id', threadId)

  if (threadError) throw threadError

  const { error: attachmentsError } = await supabase
    .from('support_attachments')
    .update({ retained_in_summary: true })
    .eq('thread_id', threadId)

  if (attachmentsError) throw attachmentsError

  const { error: deleteMessagesError } = await supabase
    .from('support_messages')
    .delete()
    .eq('thread_id', threadId)

  if (deleteMessagesError) throw deleteMessagesError
}
