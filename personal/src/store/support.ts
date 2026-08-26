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

function mapThread(row: DbSupportThread): SupportThreadRecord {
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
  }
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

export async function getCurrentPersonalSupportThread() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError) throw userError
  if (!user) return null

  const { data, error } = await supabase
    .from('support_threads')
    .select('id, personal_id, status, subject, summary, created_at, updated_at, last_message_at, closed_at')
    .eq('personal_id', user.id)
    .in('status', ['open', 'in_progress'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<DbSupportThread>()

  if (error) throw error
  return data ? mapThread(data) : null
}

export async function createPersonalSupportThread() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError) throw userError
  if (!user) throw new Error('Sessao expirada. Entre novamente para falar com o suporte.')

  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('support_threads')
    .insert({
      personal_id: user.id,
      status: 'open',
      updated_at: now,
      last_message_at: now,
    })
    .select('id, personal_id, status, subject, summary, created_at, updated_at, last_message_at, closed_at')
    .single<DbSupportThread>()

  if (error) throw error
  return mapThread(data)
}

export async function ensureCurrentPersonalSupportThread() {
  const current = await getCurrentPersonalSupportThread()
  if (current) return current
  return createPersonalSupportThread()
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
    })
    .select('id, thread_id, message_id, uploaded_by, file_name, file_path, file_url, mime_type, size_bytes, retained_in_summary, created_at')
    .single<DbSupportAttachment>()

  if (error) throw error
  return mapAttachment(data)
}

export async function sendPersonalSupportMessage(threadId: string, message: string, files: File[] = []) {
  const trimmedMessage = message.trim()
  if (!trimmedMessage && files.length === 0) return

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError) throw userError
  if (!user) throw new Error('Sessao expirada. Entre novamente para falar com o suporte.')

  const now = new Date().toISOString()
  let messageId: string | null = null

  if (trimmedMessage) {
    const { data: insertedMessage, error } = await supabase
      .from('support_messages')
      .insert({
        thread_id: threadId,
        sender_id: user.id,
        sender_role: 'personal',
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

export async function uploadPersonalSupportAttachment(threadId: string, file: File) {
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
