import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ClipboardEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  finalizeSupportThread,
  listSupportAttachments,
  listSupportMessages,
  listSupportThreads,
  sendOwnerSupportMessage,
  type SupportAttachmentRecord,
  type SupportMessageRecord,
  type SupportThreadRecord,
} from '../../store/support'

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

export default function SupportInbox() {
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedThreadId = searchParams.get('id')

  const [threads, setThreads] = useState<SupportThreadRecord[]>([])
  const [messages, setMessages] = useState<SupportMessageRecord[]>([])
  const [attachments, setAttachments] = useState<SupportAttachmentRecord[]>([])
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [loadingThreads, setLoadingThreads] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [closing, setClosing] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [q, setQ] = useState('')
  const [subject, setSubject] = useState('')
  const [summary, setSummary] = useState('')
  const [pendingClosingFiles, setPendingClosingFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const closingFileInputRef = useRef<HTMLInputElement | null>(null)

  const selectedThread = useMemo(
    () => threads.find((thread) => thread.id === selectedThreadId) || null,
    [selectedThreadId, threads],
  )
  const canFinalize = !!selectedThread && selectedThread.status !== 'closed' && !!subject.trim() && !!summary.trim() && !closing

  const filteredThreads = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return threads
    return threads.filter((thread) =>
      thread.personalName.toLowerCase().includes(term) ||
      thread.personalEmail.toLowerCase().includes(term) ||
      (thread.subject || '').toLowerCase().includes(term) ||
      (thread.summary || '').toLowerCase().includes(term),
    )
  }, [q, threads])

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

  async function loadThreads() {
    setLoadingThreads(true)
    try {
      const nextThreads = await listSupportThreads()
      setThreads(nextThreads)

      if (!selectedThreadId && nextThreads.length > 0) {
        setSearchParams({ id: nextThreads[0].id })
      }
    } catch (loadError) {
      console.error('Erro ao carregar atendimentos:', loadError)
      setError(loadError instanceof Error ? loadError.message : 'Nao foi possivel carregar os atendimentos.')
    } finally {
      setLoadingThreads(false)
    }
  }

  async function loadDetails(threadId: string) {
    setLoadingDetail(true)
    try {
      const [nextMessages, nextAttachments] = await Promise.all([
        listSupportMessages(threadId),
        listSupportAttachments(threadId),
      ])
      setMessages(nextMessages)
      setAttachments(nextAttachments)
    } catch (loadError) {
      console.error('Erro ao carregar conversa:', loadError)
      setError(loadError instanceof Error ? loadError.message : 'Nao foi possivel carregar a conversa.')
    } finally {
      setLoadingDetail(false)
    }
  }

  useEffect(() => {
    void loadThreads()
  }, [])

  useEffect(() => {
    if (!selectedThreadId) {
      setMessages([])
      setAttachments([])
      setSubject('')
      setSummary('')
      setPendingClosingFiles([])
      return
    }

    setError('')
    void loadDetails(selectedThreadId)
  }, [selectedThreadId])

  useEffect(() => {
    if (!selectedThreadId) return

    const intervalId = window.setInterval(() => {
      void loadThreads()
      void loadDetails(selectedThreadId)
    }, POLL_MS)

    return () => window.clearInterval(intervalId)
  }, [selectedThreadId])

  useEffect(() => {
    setSubject(selectedThread?.subject || '')
    setSummary(selectedThread?.summary || '')
    setPendingClosingFiles([])
    if (closingFileInputRef.current) closingFileInputRef.current.value = ''
  }, [selectedThread?.id, selectedThread?.subject, selectedThread?.summary])

  useEffect(() => {
    const container = document.getElementById('owner-support-messages')
    if (container) {
      container.scrollTop = container.scrollHeight
    }
  }, [attachments.length, messages.length])

  async function handleSendMessage() {
    if (!selectedThread || (!draft.trim() && pendingFiles.length === 0) || sending) return

    setSending(true)
    setError('')
    setSuccess('')

    try {
      await sendOwnerSupportMessage(selectedThread.id, draft, pendingFiles)
      setDraft('')
      setPendingFiles([])
      if (fileInputRef.current) fileInputRef.current.value = ''
      await loadThreads()
      await loadDetails(selectedThread.id)
    } catch (sendError) {
      console.error('Erro ao responder atendimento:', sendError)
      setError(sendError instanceof Error ? sendError.message : 'Nao foi possivel enviar a resposta.')
    } finally {
      setSending(false)
    }
  }

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || [])
    if (!files.length) return

    setError('')
    setSuccess('')
    setPendingFiles((current) => [...current, ...files])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleFinalize() {
    if (!selectedThread || closing) return

    setClosing(true)
    setError('')
    setSuccess('')

    try {
      await finalizeSupportThread(selectedThread.id, subject, summary, pendingClosingFiles)
      setDraft('')
      setPendingClosingFiles([])
      if (closingFileInputRef.current) closingFileInputRef.current.value = ''
      await loadThreads()
      await loadDetails(selectedThread.id)
      setSuccess('Atendimento finalizado. Ficaram salvos apenas assunto, descricao e anexos.')
    } catch (closeError) {
      console.error('Erro ao finalizar atendimento:', closeError)
      setError(closeError instanceof Error ? closeError.message : 'Nao foi possivel finalizar o atendimento.')
    } finally {
      setClosing(false)
    }
  }

  function handleClosingFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || [])
    if (!files.length) return

    setPendingClosingFiles((current) => [...current, ...files])
    if (closingFileInputRef.current) closingFileInputRef.current.value = ''
  }

  function handleClosingPaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const files = getClipboardImageFiles(event)
    if (!files.length) return

    event.preventDefault()
    setError('')
    setSuccess('')
    setPendingClosingFiles((current) => [...current, ...files])
  }

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.8rem', color: '#0f172a', margin: 0 }}>Atendimentos do suporte</h1>
        <p style={{ color: '#64748b', marginTop: 6 }}>
          Converse com os personais em tempo real e, ao fechar, mantenha apenas assunto, descricao e anexos.
        </p>
      </div>

      {(error || success) && (
        <div
          style={{
            marginBottom: 16,
            padding: 14,
            borderRadius: 12,
            background: error ? '#fef2f2' : '#ecfdf5',
            color: error ? '#b91c1c' : '#166534',
          }}
        >
          {error || success}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '360px minmax(0, 1fr)', gap: 20, alignItems: 'start' }}>
        <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 18, overflow: 'hidden' }}>
          <div style={{ padding: 18, borderBottom: '1px solid #eef2ff' }}>
            <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>Fila de atendimento</div>
            <input
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Buscar personal ou resumo..."
              style={{
                width: '100%',
                borderRadius: 10,
                border: '1px solid #cbd5e1',
                padding: '10px 12px',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ maxHeight: '72vh', overflowY: 'auto' }}>
            {loadingThreads ? (
              <div style={{ padding: 24, color: '#64748b' }}>Carregando atendimentos...</div>
            ) : filteredThreads.length === 0 ? (
              <div style={{ padding: 24, color: '#94a3b8' }}>Nenhum atendimento encontrado.</div>
            ) : (
              filteredThreads.map((thread) => {
                const active = thread.id === selectedThreadId
                const isClosed = thread.status === 'closed'

                return (
                  <button
                    key={thread.id}
                    type="button"
                    onClick={() => setSearchParams({ id: thread.id })}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: 16,
                      border: 'none',
                      borderBottom: '1px solid #f1f5f9',
                      background: active ? '#eff6ff' : '#fff',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>{thread.personalName}</div>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          padding: '4px 8px',
                          borderRadius: 999,
                          background: isClosed ? '#dcfce7' : '#dbeafe',
                          color: isClosed ? '#166534' : '#1d4ed8',
                        }}
                      >
                        {thread.status === 'closed' ? 'Fechado' : 'Aberto'}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: 4 }}>{thread.personalEmail}</div>
                    <div style={{ fontSize: '0.85rem', color: '#334155', marginTop: 10 }}>
                      {thread.subject || thread.summary || 'Sem resumo final ainda'}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: 10 }}>
                      Ultima atividade em {new Date(thread.lastMessageAt).toLocaleString()}
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </section>

        <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 18, overflow: 'hidden' }}>
          {!selectedThread ? (
            <div style={{ padding: 48, textAlign: 'center', color: '#64748b' }}>
              Selecione um atendimento para responder.
            </div>
          ) : (
            <>
              <div
                style={{
                  padding: 20,
                  borderBottom: '1px solid #eef2ff',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 16,
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: '1rem' }}>💬</span>
                    <strong style={{ color: '#0f172a' }}>{selectedThread.personalName}</strong>
                  </div>
                  <div style={{ color: '#64748b', fontSize: '0.85rem', marginTop: 6 }}>{selectedThread.personalEmail}</div>
                </div>
                <div style={{ color: '#64748b', fontSize: '0.8rem' }}>
                  Criado em {new Date(selectedThread.createdAt).toLocaleString()}
                </div>
              </div>

              <div
                id="owner-support-messages"
                style={{
                  minHeight: 260,
                  maxHeight: 360,
                  overflowY: 'auto',
                  padding: 20,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  background: '#f8fafc',
                }}
              >
                {loadingDetail ? (
                  <div style={{ color: '#64748b' }}>Carregando conversa...</div>
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
                              maxWidth: '85%',
                              minWidth: 0,
                              textDecoration: 'none',
                              background: '#fff',
                              border: '1px solid #e2e8f0',
                              borderRadius: 14,
                              padding: '10px 12px',
                              color: '#1d4ed8',
                              boxSizing: 'border-box',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, minWidth: 0 }}>
                              <span style={{ flexShrink: 0 }}>📎</span>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontWeight: 600, fontSize: '0.82rem', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                                  {item.attachment.fileName}
                                </div>
                                <div style={{ color: '#64748b', fontSize: '0.72rem', marginTop: 4 }}>
                                  {item.attachment.retainedInSummary ? 'Anexo salvo no fechamento' : 'Anexo do atendimento'}
                                </div>
                              </div>
                            </div>
                          </a>
                        )
                      }

                      const isOwner = item.message.senderRole === 'owner'
                      return (
                        <div
                          key={item.message.id}
                          style={{
                            alignSelf: isOwner ? 'flex-end' : 'flex-start',
                            maxWidth: '80%',
                            background: isOwner ? '#dbeafe' : '#fff',
                            border: `1px solid ${isOwner ? '#bfdbfe' : '#e2e8f0'}`,
                            borderRadius: 16,
                            padding: '12px 14px',
                          }}
                        >
                          <div style={{ whiteSpace: 'pre-wrap', color: '#0f172a' }}>{item.message.message}</div>
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
                                    background: 'rgba(255,255,255,0.72)',
                                    borderRadius: 12,
                                    padding: '8px 10px',
                                    minWidth: 0,
                                    boxSizing: 'border-box',
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, minWidth: 0 }}>
                                    <span style={{ flexShrink: 0 }}>📎</span>
                                    <div style={{ minWidth: 0 }}>
                                      <div style={{ fontWeight: 600, fontSize: '0.82rem', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                                        {attachment.fileName}
                                      </div>
                                    </div>
                                  </div>
                                </a>
                              ))}
                            </div>
                          )}
                          <div style={{ color: '#64748b', fontSize: '0.72rem', marginTop: 6 }}>
                            {isOwner ? 'Owner' : 'Personal'} · {new Date(item.message.createdAt).toLocaleString()}
                          </div>
                        </div>
                      )
                    })}

                    {messages.length === 0 && attachments.length === 0 && (
                      <div style={{ color: '#94a3b8' }}>Sem mensagens no momento.</div>
                    )}
                  </>
                )}
              </div>

              <div style={{ padding: 20, borderTop: '1px solid #eef2ff' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: 20 }}>
                  <div>
                    <textarea
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      placeholder="Responder o personal..."
                      rows={4}
                      disabled={selectedThread.status === 'closed'}
                      style={{
                        width: '100%',
                        borderRadius: 12,
                        border: '1px solid #cbd5e1',
                        padding: 12,
                        resize: 'none',
                        boxSizing: 'border-box',
                        fontFamily: 'inherit',
                      }}
                    />

                    {pendingFiles.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10, maxHeight: 88, overflowY: 'auto', paddingRight: 4 }}>
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

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'stretch', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input ref={fileInputRef} type="file" multiple onChange={handleUpload} style={{ display: 'none' }} />
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={selectedThread.status === 'closed'}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 8,
                            borderRadius: 999,
                            border: '1px solid #cbd5e1',
                            background: '#fff',
                            padding: '10px 14px',
                            cursor: 'pointer',
                            minHeight: 44,
                          }}
                        >
                          <span>📎</span>
                          Anexar arquivo
                        </button>
                        <span style={{ color: '#64748b', fontSize: '0.76rem' }}>Os anexos finais ficam salvos.</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => void handleSendMessage()}
                        disabled={selectedThread.status === 'closed' || sending || (!draft.trim() && pendingFiles.length === 0)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 8,
                          borderRadius: 999,
                          border: 'none',
                          background: '#0f172a',
                          color: '#fff',
                          padding: '10px 16px',
                          cursor: 'pointer',
                          fontWeight: 700,
                          minHeight: 44,
                        }}
                      >
                        <span>➤</span>
                        {sending ? 'Enviando...' : 'Responder'}
                      </button>
                    </div>
                  </div>

                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 14, padding: 16 }}>
                    <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>Fechamento do atendimento</div>
                    <label style={{ display: 'grid', gap: 6, marginBottom: 12 }}>
                      <span style={{ color: '#475569', fontSize: '0.84rem' }}>Assunto *</span>
                      <input
                        value={subject}
                        onChange={(event) => setSubject(event.target.value)}
                        placeholder="Ex: problema de login"
                        style={{
                          borderRadius: 10,
                          border: '1px solid #cbd5e1',
                          padding: '10px 12px',
                        }}
                      />
                    </label>

                    <label style={{ display: 'grid', gap: 6 }}>
                      <span style={{ color: '#475569', fontSize: '0.84rem' }}>Descricao final *</span>
                      <textarea
                        value={summary}
                        onChange={(event) => setSummary(event.target.value)}
                        onPaste={handleClosingPaste}
                        placeholder="Resumo do problema e da solucao aplicada"
                        rows={7}
                        style={{
                          borderRadius: 10,
                          border: '1px solid #cbd5e1',
                          padding: 12,
                          resize: 'none',
                          fontFamily: 'inherit',
                        }}
                      />
                    </label>
                    <div style={{ marginTop: 8, color: '#64748b', fontSize: '0.76rem' }}>
                      Para finalizar, preencha `Assunto` e `Descricao final`.
                    </div>
                    <div style={{ marginTop: 4, color: '#64748b', fontSize: '0.76rem' }}>
                      Voce tambem pode colar imagem com `Ctrl + V` para virar evidencia.
                    </div>

                    <div style={{ marginTop: 12 }}>
                      <div style={{ color: '#475569', fontSize: '0.84rem', marginBottom: 8 }}>Evidencias do fechamento</div>
                      <input
                        ref={closingFileInputRef}
                        type="file"
                        multiple
                        onChange={handleClosingFiles}
                        style={{ display: 'none' }}
                      />
                      <button
                        type="button"
                        onClick={() => closingFileInputRef.current?.click()}
                        disabled={closing || selectedThread.status === 'closed'}
                        style={{
                          width: '100%',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 8,
                          borderRadius: 10,
                          border: '1px solid #cbd5e1',
                          background: '#fff',
                          color: '#334155',
                          padding: '10px 12px',
                          cursor: selectedThread.status === 'closed' ? 'not-allowed' : 'pointer',
                          fontWeight: 600,
                        }}
                      >
                        <span>📎</span>
                        Anexar evidencias
                      </button>

                      {pendingClosingFiles.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10, maxHeight: 88, overflowY: 'auto', paddingRight: 4 }}>
                          {pendingClosingFiles.map((file, index) => (
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
                              <span style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {file.name}
                              </span>
                              <button
                                type="button"
                                onClick={() => setPendingClosingFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))}
                                style={{ background: 'transparent', border: 'none', color: '#1d4ed8', cursor: 'pointer', padding: 0 }}
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => void handleFinalize()}
                      disabled={!canFinalize}
                      style={{
                        width: '100%',
                        marginTop: 14,
                        border: 'none',
                        borderRadius: 12,
                        background: canFinalize ? '#16a34a' : '#94a3b8',
                        color: '#fff',
                        padding: '12px 14px',
                        fontWeight: 700,
                        cursor: canFinalize ? 'pointer' : 'not-allowed',
                        opacity: canFinalize ? 1 : 0.9,
                      }}
                    >
                      {selectedThread.status === 'closed'
                        ? 'Atendimento ja finalizado'
                        : closing
                          ? 'Finalizando...'
                          : 'Finalizar e salvar resumo'}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
