import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ClipboardEvent } from 'react'
import { MessageCircle, Paperclip, Send, X } from 'lucide-react'
import {
  ensureCurrentPersonalSupportThread,
  getCurrentPersonalSupportThread,
  listSupportAttachments,
  listSupportMessages,
  sendPersonalSupportMessage,
  type SupportAttachmentRecord,
  type SupportMessageRecord,
  type SupportThreadRecord,
} from '../store/support'

const POLL_MS = 8000

function getClipboardImageFiles(event: ClipboardEvent<HTMLTextAreaElement>) {
  const items = Array.from(event.clipboardData?.items || [])
  return items
    .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
    .map((item, index) => {
      const file = item.getAsFile()
      if (!file) return null

      const extension = file.type.split('/')[1] || 'png'
      const safeName = file.name && file.name !== 'image.png' ? file.name : `imagem-colada-${Date.now()}-${index}.${extension}`
      return new File([file], safeName, { type: file.type })
    })
    .filter((file): file is File => !!file)
}

export default function SupportChatWidget() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [thread, setThread] = useState<SupportThreadRecord | null>(null)
  const [messages, setMessages] = useState<SupportMessageRecord[]>([])
  const [attachments, setAttachments] = useState<SupportAttachmentRecord[]>([])
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  async function loadThreadData(forceEnsure = false) {
    setLoading(true)
    setError('')

    try {
      const currentThread = forceEnsure
        ? await ensureCurrentPersonalSupportThread()
        : thread || await getCurrentPersonalSupportThread()

      setThread(currentThread)

      if (!currentThread) {
        setMessages([])
        setAttachments([])
        return
      }

      const [nextMessages, nextAttachments] = await Promise.all([
        listSupportMessages(currentThread.id),
        listSupportAttachments(currentThread.id),
      ])

      setMessages(nextMessages)
      setAttachments(nextAttachments)
    } catch (loadError) {
      console.error('Erro ao carregar atendimento:', loadError)
      setError(loadError instanceof Error ? loadError.message : 'Nao foi possivel carregar o atendimento.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!open) return

    void loadThreadData(false)

    const intervalId = window.setInterval(() => {
      void loadThreadData(false)
    }, POLL_MS)

    return () => window.clearInterval(intervalId)
  }, [open])

  useEffect(() => {
    if (!open) return
    const container = document.getElementById('support-chat-messages')
    if (container) {
      container.scrollTop = container.scrollHeight
    }
  }, [attachments.length, messages.length, open])

  const headerLabel = useMemo(() => {
    if (thread?.status === 'open') return 'Aguardando sua primeira mensagem'
    if (thread?.status === 'in_progress') return 'Conversa em andamento com o suporte'
    return 'Duvidas ou problemas'
  }, [thread?.status])

  const timelineItems = useMemo(() => {
    const attachmentsByMessageId = new Map<string, SupportAttachmentRecord[]>()
    const orphanAttachments: SupportAttachmentRecord[] = []

    attachments.forEach((attachment) => {
      if (attachment.messageId) {
        const current = attachmentsByMessageId.get(attachment.messageId) || []
        current.push(attachment)
        attachmentsByMessageId.set(attachment.messageId, current)
        return
      }

      orphanAttachments.push(attachment)
    })

    const items = [
      ...messages.map((message) => ({
        type: 'message' as const,
        createdAt: message.createdAt,
        message,
        attachments: attachmentsByMessageId.get(message.id) || [],
      })),
      ...orphanAttachments.map((attachment) => ({
        type: 'attachment' as const,
        createdAt: attachment.createdAt,
        attachment,
      })),
    ]

    return items.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  }, [attachments, messages])

  async function handleSendMessage() {
    const trimmed = draft.trim()
    if ((!trimmed && pendingFiles.length === 0) || sending) return

    setSending(true)
    setError('')

    try {
      const currentThread = thread || await ensureCurrentPersonalSupportThread()
      setThread(currentThread)
      await sendPersonalSupportMessage(currentThread.id, trimmed, pendingFiles)
      setDraft('')
      setPendingFiles([])
      if (fileInputRef.current) fileInputRef.current.value = ''
      await loadThreadData(false)
    } catch (sendError) {
      console.error('Erro ao enviar mensagem:', sendError)
      setError(sendError instanceof Error ? sendError.message : 'Nao foi possivel enviar a mensagem.')
    } finally {
      setSending(false)
    }
  }

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || [])
    if (!files.length) return

    setError('')
    setPendingFiles((current) => [...current, ...files])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handlePasteImage(event: ClipboardEvent<HTMLTextAreaElement>) {
    const files = getClipboardImageFiles(event)
    if (!files.length) return

    event.preventDefault()
    setError('')
    setPendingFiles((current) => [...current, ...files])
  }

  return (
    <>
      {open && (
        <div
          style={{
            position: 'fixed',
            right: 24,
            bottom: 96,
            width: 'min(380px, calc(100vw - 32px))',
            maxHeight: 'min(70vh, 640px)',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 20,
            boxShadow: '0 24px 48px rgba(15, 23, 42, 0.18)',
            zIndex: 4000,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '16px 18px',
              background: 'linear-gradient(135deg, #0f172a 0%, #1d4ed8 100%)',
              color: '#fff',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: 12,
            }}
          >
            <div>
              <div style={{ fontSize: '1rem', fontWeight: 700 }}>Duvidas ou problemas?</div>
              <div style={{ fontSize: '0.82rem', opacity: 0.9, marginTop: 4 }}>{headerLabel}</div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}
              aria-label="Fechar atendimento"
            >
              <X size={18} />
            </button>
          </div>

          {error && (
            <div style={{ margin: 16, padding: 12, borderRadius: 12, background: '#fef2f2', color: '#b91c1c', fontSize: '0.84rem' }}>
              {error}
            </div>
          )}

          <div
            id="support-chat-messages"
            style={{
              padding: 16,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              minHeight: 220,
            }}
          >
            {loading && messages.length === 0 && attachments.length === 0 ? (
              <div style={{ color: '#64748b', textAlign: 'center', padding: '32px 0' }}>Carregando atendimento...</div>
            ) : (
              <>
                {timelineItems.map((item) => {
                  if (item.type === 'attachment') {
                    return (
                      <a
                        key={item.attachment.id}
                        href={item.attachment.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          alignSelf: 'flex-start',
                          maxWidth: '90%',
                          minWidth: 0,
                          textDecoration: 'none',
                          color: '#1d4ed8',
                          border: '1px solid #bfdbfe',
                          background: '#eff6ff',
                          borderRadius: 14,
                          padding: '10px 12px',
                          boxSizing: 'border-box',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, minWidth: 0 }}>
                          <span style={{ flexShrink: 0 }}>📎</span>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '0.82rem', fontWeight: 600, wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                              {item.attachment.fileName}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 4 }}>
                              Anexo · {new Date(item.attachment.createdAt).toLocaleString()}
                            </div>
                          </div>
                        </div>
                      </a>
                    )
                  }

                  const isMine = item.message.senderRole === 'personal'
                  return (
                    <div
                      key={item.message.id}
                      style={{
                        alignSelf: isMine ? 'flex-end' : 'flex-start',
                        maxWidth: '85%',
                        background: isMine ? '#dbeafe' : '#f1f5f9',
                        color: '#0f172a',
                        borderRadius: 16,
                        padding: '12px 14px',
                      }}
                    >
                      <div style={{ fontSize: '0.92rem', whiteSpace: 'pre-wrap' }}>{item.message.message}</div>
                      {item.attachments.length > 0 && (
                        <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                          {item.attachments.map((attachment) => (
                            <a
                              key={attachment.id}
                              href={attachment.fileUrl}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                display: 'block',
                                textDecoration: 'none',
                                color: '#1d4ed8',
                                border: '1px solid #93c5fd',
                                background: 'rgba(255,255,255,0.7)',
                                borderRadius: 12,
                                padding: '8px 10px',
                                minWidth: 0,
                                boxSizing: 'border-box',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, minWidth: 0 }}>
                                <span style={{ flexShrink: 0 }}>📎</span>
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontSize: '0.82rem', fontWeight: 600, wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                                    {attachment.fileName}
                                  </div>
                                </div>
                              </div>
                            </a>
                          ))}
                        </div>
                      )}
                      <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 6 }}>
                        {isMine ? 'Voce' : 'Especialista'} · {new Date(item.message.createdAt).toLocaleString()}
                      </div>
                    </div>
                  )
                })}

                {messages.length === 0 && attachments.length === 0 && !loading && (
                  <div style={{ color: '#64748b', textAlign: 'center', padding: '24px 8px' }}>
                    Explique sua duvida aqui e envie anexos se precisar.
                  </div>
                )}
              </>
            )}
          </div>

          <div style={{ padding: 16, borderTop: '1px solid #e2e8f0', background: '#fff' }}>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onPaste={handlePasteImage}
              placeholder="Descreva sua duvida ou problema..."
              rows={3}
              style={{
                width: '100%',
                borderRadius: 12,
                border: '1px solid #cbd5e1',
                padding: 12,
                resize: 'none',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
              }}
            />
            <div style={{ marginTop: 8, color: '#64748b', fontSize: '0.76rem' }}>
              Voce pode anexar arquivo ou colar imagem com `Ctrl + V`.
            </div>

            {pendingFiles.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                {pendingFiles.map((file, index) => (
                  <div
                    key={`${file.name}-${index}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      background: '#eff6ff',
                      color: '#1d4ed8',
                      border: '1px solid #bfdbfe',
                      borderRadius: 999,
                      padding: '6px 10px',
                      fontSize: '0.78rem',
                    }}
                  >
                    <span style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {file.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPendingFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))}
                      style={{ background: 'transparent', border: 'none', color: '#1d4ed8', cursor: 'pointer', padding: 0 }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginTop: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '1 1 150px', minWidth: 0 }}>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleUpload}
                  style={{ display: 'none' }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={sending}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    borderRadius: 999,
                    border: '1px solid #cbd5e1',
                    background: '#fff',
                    padding: '10px 14px',
                    cursor: 'pointer',
                    width: '100%',
                  }}
                >
                  <Paperclip size={16} />
                  Anexar
                </button>
              </div>

              <button
                type="button"
                onClick={() => void handleSendMessage()}
                disabled={sending || (!draft.trim() && pendingFiles.length === 0)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  flex: '1 1 140px',
                  minWidth: 0,
                  borderRadius: 999,
                  border: 'none',
                  background: '#1d4ed8',
                  color: '#fff',
                  padding: '10px 16px',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                <Send size={16} />
                {sending ? 'Enviando...' : 'Enviar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        style={{
          position: 'fixed',
          right: 24,
          bottom: 24,
          zIndex: 4001,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 10,
          border: 'none',
          borderRadius: 999,
          padding: '14px 18px',
          background: 'linear-gradient(135deg, #1d4ed8 0%, #0f172a 100%)',
          color: '#fff',
          boxShadow: '0 18px 32px rgba(29, 78, 216, 0.25)',
          cursor: 'pointer',
          fontWeight: 700,
        }}
      >
        <MessageCircle size={18} />
        Duvidas e problemas
      </button>
    </>
  )
}
