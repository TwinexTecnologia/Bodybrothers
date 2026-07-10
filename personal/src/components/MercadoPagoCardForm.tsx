import { useEffect, useMemo, useRef, useState } from 'react'
import { loadMercadoPago } from '@mercadopago/sdk-js'

type CardFormSubmitData = {
  token: string
  paymentMethodId: string
  issuerId?: string | null
  installments: number
  identificationType: string
  identificationNumber: string
}

type MercadoPagoCardFormProps = {
  publicKey: string
  amount: number
  payerEmail: string
  loading?: boolean
  onSubmit: (data: CardFormSubmitData) => Promise<void> | void
  onCancel?: () => void
  title?: string
  submitLabel?: string
  showAmount?: boolean
  processingTitle?: string
  processingText?: string
}

declare global {
  interface Window {
    MercadoPago?: new (publicKey: string, options?: Record<string, unknown>) => {
      cardForm: (config: Record<string, unknown>) => {
        getCardFormData: () => Record<string, unknown>
        unmount?: () => void
        destroy?: () => void
      }
    }
  }
}

export default function MercadoPagoCardForm({
  publicKey,
  amount,
  payerEmail,
  loading = false,
  onSubmit,
  onCancel,
  title = 'Cartao para regularizacao',
  submitLabel = 'Salvar cartao e pagar',
  showAmount = true,
  processingTitle = 'Processando pagamento...',
  processingText = 'Aguarde um instante enquanto enviamos os dados do cartao para validar o pagamento.',
}: MercadoPagoCardFormProps) {
  const [formError, setFormError] = useState('')
  const [sdkReady, setSdkReady] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const cardFormRef = useRef<{ getCardFormData: () => Record<string, unknown>; unmount?: () => void; destroy?: () => void } | null>(null)
  const onSubmitRef = useRef(onSubmit)
  const formId = useMemo(() => `mp-card-form-${Math.random().toString(36).slice(2)}`, [])

  useEffect(() => {
    onSubmitRef.current = onSubmit
  }, [onSubmit])

  useEffect(() => {
    let active = true

    async function setupCardForm() {
      try {
        setFormError('')
        setSdkReady(false)

        await loadMercadoPago()
        if (!active || !window.MercadoPago) return

        const mp = new window.MercadoPago(publicKey, { locale: 'pt-BR' })

        const nextForm = mp.cardForm({
          amount: amount.toFixed(2),
          iframe: true,
          form: {
            id: formId,
            cardNumber: {
              id: `${formId}__cardNumber`,
              placeholder: 'Numero do cartao',
            },
            expirationDate: {
              id: `${formId}__expirationDate`,
              placeholder: 'MM/AA',
            },
            securityCode: {
              id: `${formId}__securityCode`,
              placeholder: 'CVV',
            },
            cardholderName: {
              id: `${formId}__cardholderName`,
              placeholder: 'Titular do cartao',
            },
            issuer: {
              id: `${formId}__issuer`,
              placeholder: 'Banco emissor',
            },
            installments: {
              id: `${formId}__installments`,
              placeholder: '1x',
            },
            identificationType: {
              id: `${formId}__identificationType`,
              placeholder: 'Tipo de documento',
            },
            identificationNumber: {
              id: `${formId}__identificationNumber`,
              placeholder: 'Numero do documento',
            },
            cardholderEmail: {
              id: `${formId}__cardholderEmail`,
              placeholder: 'E-mail',
            },
          },
          callbacks: {
            onFormMounted: (error: unknown) => {
              if (!active) return
              if (error) {
                setFormError('Não foi possível carregar o formulário do cartão.')
                return
              }

              setSdkReady(true)
            },
            onSubmit: async (event: Event) => {
              event.preventDefault()

              try {
                setSubmitting(true)
                setFormError('')

                const data = nextForm.getCardFormData()
                await onSubmitRef.current({
                  token: String(data.token || ''),
                  paymentMethodId: String(data.paymentMethodId || ''),
                  issuerId: data.issuerId ? String(data.issuerId) : null,
                  installments: Number(data.installments || 1),
                  identificationType: String(data.identificationType || ''),
                  identificationNumber: String(data.identificationNumber || ''),
                })
              } catch (error) {
                const message = error instanceof Error ? error.message : 'Não foi possível processar o cartão.'
                setFormError(message)
              } finally {
                if (active) {
                  setSubmitting(false)
                }
              }
            },
          },
        }) as { getCardFormData: () => Record<string, unknown>; unmount?: () => void; destroy?: () => void }

        cardFormRef.current = nextForm
      } catch (error) {
        if (!active) return
        const message = error instanceof Error ? error.message : 'Não foi possível iniciar o Mercado Pago.'
        setFormError(message)
      }
    }

    setupCardForm()

    return () => {
      active = false
      const currentForm = cardFormRef.current
      if (currentForm?.unmount) {
        currentForm.unmount()
      } else if (currentForm?.destroy) {
        currentForm.destroy()
      }
      cardFormRef.current = null
    }
  }, [amount, formId, publicKey])

  return (
    <div style={{
      marginTop: 16,
      padding: 14,
      borderRadius: 12,
      border: '1px solid #e2e8f0',
      background: '#ffffff',
      display: 'grid',
      gap: 10,
      position: 'relative',
    }}>
      {(loading || submitting) && (
        <div style={processingOverlayStyle}>
          <div style={processingBoxStyle}>
            <div style={processingTitleStyle}>{processingTitle}</div>
            <div style={processingTextStyle}>
              {processingText}
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gap: 2 }}>
        <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#0f172a' }}>
          {showAmount ? `${title} - R$ ${amount.toFixed(2)}` : title}
        </div>
      </div>

      <form id={formId} style={{ display: 'grid', gap: 10 }}>
        <div style={{ display: 'grid', gap: 6 }}>
          <label htmlFor={`${formId}__cardNumber`} style={fieldLabelStyle}>Numero do cartao</label>
          <div id={`${formId}__cardNumber`} style={secureFieldStyle} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
          <div style={{ display: 'grid', gap: 6 }}>
            <label htmlFor={`${formId}__expirationDate`} style={fieldLabelStyle}>Validade</label>
            <div id={`${formId}__expirationDate`} style={secureFieldStyle} />
          </div>

          <div style={{ display: 'grid', gap: 6 }}>
            <label htmlFor={`${formId}__securityCode`} style={fieldLabelStyle}>Codigo de seguranca</label>
            <div id={`${formId}__securityCode`} style={secureFieldStyle} />
          </div>
        </div>

        <div style={{ display: 'grid', gap: 6 }}>
          <label htmlFor={`${formId}__cardholderName`} style={fieldLabelStyle}>Titular do cartao</label>
          <input id={`${formId}__cardholderName`} type="text" defaultValue="" style={textInputStyle} />
        </div>

        <div style={{ display: 'grid', gap: 6 }}>
          <label htmlFor={`${formId}__issuer`} style={fieldLabelStyle}>Banco emissor</label>
          <select id={`${formId}__issuer`} defaultValue="" style={textInputStyle}>
            <option value="" disabled>Selecione</option>
          </select>
        </div>

        <div style={hiddenFieldWrapperStyle} aria-hidden="true">
          <label htmlFor={`${formId}__installments`} style={fieldLabelStyle}>Parcelas</label>
          <select id={`${formId}__installments`} defaultValue="1" style={textInputStyle}>
            <option value="1">1x</option>
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
          <div style={{ display: 'grid', gap: 6 }}>
            <label htmlFor={`${formId}__identificationType`} style={fieldLabelStyle}>Tipo de documento</label>
            <select id={`${formId}__identificationType`} defaultValue="" style={textInputStyle}>
              <option value="" disabled>Selecione</option>
            </select>
          </div>

          <div style={{ display: 'grid', gap: 6 }}>
            <label htmlFor={`${formId}__identificationNumber`} style={fieldLabelStyle}>Numero do documento</label>
            <input id={`${formId}__identificationNumber`} type="text" defaultValue="" style={textInputStyle} />
          </div>
        </div>

        <div style={{ display: 'grid', gap: 6 }}>
          <label htmlFor={`${formId}__cardholderEmail`} style={fieldLabelStyle}>E-mail</label>
          <input id={`${formId}__cardholderEmail`} type="email" defaultValue={payerEmail} style={textInputStyle} />
        </div>

        {formError && (
          <div style={{
            padding: '10px 12px',
            borderRadius: 10,
            background: '#fee2e2',
            color: '#b91c1c',
            fontWeight: 600,
            fontSize: '0.9rem',
          }}>
            {formError}
          </div>
        )}

        {!sdkReady && !formError && (
          <div style={{ fontSize: '0.9rem', color: '#64748b' }}>Carregando formulario seguro do Mercado Pago...</div>
        )}

        {(loading || submitting) && (
          <div style={{
            padding: '10px 12px',
            borderRadius: 10,
            background: '#eff6ff',
            color: '#1d4ed8',
            fontWeight: 600,
            fontSize: '0.9rem',
          }}>
            Processando pagamento. Aguarde...
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button type="submit" disabled={!sdkReady || loading || submitting} style={!sdkReady || loading || submitting ? disabledButtonStyle : submitButtonStyle}>
            {loading || submitting ? 'Processando...' : submitLabel}
          </button>

          {onCancel && (
            <button type="button" onClick={onCancel} disabled={loading || submitting} style={secondaryButtonStyle}>
              Fechar formulario
            </button>
          )}
        </div>
      </form>
    </div>
  )
}

const fieldLabelStyle = {
  fontSize: '0.84rem',
  fontWeight: 600,
  color: '#334155',
} satisfies React.CSSProperties

const textInputStyle = {
  height: 40,
  borderRadius: 8,
  border: '1px solid #cbd5e1',
  padding: '8px 12px',
  fontSize: '0.9rem',
  outline: 'none',
  background: '#fff',
} satisfies React.CSSProperties

const secureFieldStyle = {
  height: 40,
  minHeight: 40,
  borderRadius: 8,
  border: '1px solid #cbd5e1',
  padding: '0 12px',
  background: '#fff',
  display: 'flex',
  alignItems: 'center',
  overflow: 'hidden',
} satisfies React.CSSProperties

const submitButtonStyle = {
  padding: '10px 16px',
  borderRadius: 8,
  border: 'none',
  background: '#0f172a',
  color: '#fff',
  fontWeight: 700,
  cursor: 'pointer',
} satisfies React.CSSProperties

const disabledButtonStyle = {
  ...submitButtonStyle,
  opacity: 0.6,
  cursor: 'not-allowed',
} satisfies React.CSSProperties

const secondaryButtonStyle = {
  padding: '10px 16px',
  borderRadius: 8,
  border: '1px solid #cbd5e1',
  background: '#fff',
  color: '#334155',
  fontWeight: 600,
  cursor: 'pointer',
} satisfies React.CSSProperties

const hiddenFieldWrapperStyle = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
} satisfies React.CSSProperties

const processingOverlayStyle = {
  position: 'absolute',
  inset: 0,
  borderRadius: 12,
  background: 'rgba(255, 255, 255, 0.72)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 16,
  zIndex: 10,
} satisfies React.CSSProperties

const processingBoxStyle = {
  width: '100%',
  maxWidth: 360,
  padding: '14px 16px',
  borderRadius: 12,
  border: '1px solid #bfdbfe',
  background: '#ffffff',
  boxShadow: '0 10px 25px rgba(15, 23, 42, 0.08)',
  display: 'grid',
  gap: 6,
  textAlign: 'center',
} satisfies React.CSSProperties

const processingTitleStyle = {
  fontSize: '1rem',
  fontWeight: 700,
  color: '#0f172a',
} satisfies React.CSSProperties

const processingTextStyle = {
  fontSize: '0.9rem',
  color: '#475569',
  lineHeight: 1.5,
} satisfies React.CSSProperties
