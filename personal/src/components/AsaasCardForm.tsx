import { useMemo, useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'

export type AsaasCardFormSubmitData = {
  creditCard: {
    holderName: string
    number: string
    expiryMonth: string
    expiryYear: string
    ccv: string
  }
  creditCardHolderInfo: {
    name: string
    email: string
    cpfCnpj: string
    postalCode: string
    addressNumber: string
    addressComplement: string | null
    phone: string | null
    mobilePhone: string | null
  }
}

type AsaasCardFormProps = {
  payerName?: string
  payerEmail?: string
  payerPhone?: string
  loading?: boolean
  onSubmit: (data: AsaasCardFormSubmitData) => Promise<void> | void
  onCancel?: () => void
  title?: string
  submitLabel?: string
  processingTitle?: string
  processingText?: string
}

export default function AsaasCardForm({
  payerName = '',
  payerEmail = '',
  payerPhone = '',
  loading = false,
  onSubmit,
  onCancel,
  title = 'Trocar cartao',
  submitLabel = 'Salvar novo cartao',
  processingTitle = 'Atualizando cartao...',
  processingText = 'Aguarde um instante enquanto validamos os dados do novo cartao.',
}: AsaasCardFormProps) {
  const [holderName, setHolderName] = useState(payerName)
  const [cardNumber, setCardNumber] = useState('')
  const [expiryMonth, setExpiryMonth] = useState('')
  const [expiryYear, setExpiryYear] = useState('')
  const [ccv, setCcv] = useState('')
  const [holderEmail, setHolderEmail] = useState(payerEmail)
  const [cpfCnpj, setCpfCnpj] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [addressNumber, setAddressNumber] = useState('')
  const [addressComplement, setAddressComplement] = useState('')
  const [phone, setPhone] = useState(payerPhone)
  const [mobilePhone, setMobilePhone] = useState(payerPhone)
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const disabled = loading || submitting
  const helperText = useMemo(() => {
    return 'Os dados do cartao sao usados apenas para atualizar a assinatura recorrente.'
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const normalizedHolderName = holderName.trim()
    const normalizedCardNumber = cardNumber.replace(/\s+/g, '').trim()
    const normalizedExpiryMonth = expiryMonth.replace(/\D+/g, '').slice(0, 2)
    const normalizedExpiryYear = expiryYear.replace(/\D+/g, '').slice(-4)
    const normalizedCcv = ccv.replace(/\D+/g, '').slice(0, 4)
    const normalizedEmail = holderEmail.trim()
    const normalizedCpfCnpj = cpfCnpj.replace(/\D+/g, '')
    const normalizedPostalCode = postalCode.replace(/\D+/g, '')
    const normalizedAddressNumber = addressNumber.trim()
    const normalizedPhone = phone.replace(/\D+/g, '')
    const normalizedMobilePhone = mobilePhone.replace(/\D+/g, '')

    if (!normalizedHolderName) {
      setFormError('Informe o nome do titular do cartao.')
      return
    }

    if (normalizedCardNumber.length < 13) {
      setFormError('Informe um numero de cartao valido.')
      return
    }

    if (!normalizedExpiryMonth || Number(normalizedExpiryMonth) < 1 || Number(normalizedExpiryMonth) > 12) {
      setFormError('Informe um mes de validade valido.')
      return
    }

    if (normalizedExpiryYear.length < 2) {
      setFormError('Informe um ano de validade valido.')
      return
    }

    if (normalizedCcv.length < 3) {
      setFormError('Informe um codigo de seguranca valido.')
      return
    }

    if (!normalizedEmail) {
      setFormError('Informe o email do titular.')
      return
    }

    if (!normalizedCpfCnpj) {
      setFormError('Informe o CPF ou CNPJ do titular.')
      return
    }

    if (!normalizedPostalCode) {
      setFormError('Informe o CEP do titular.')
      return
    }

    if (!normalizedAddressNumber) {
      setFormError('Informe o numero do endereco do titular.')
      return
    }

    try {
      setSubmitting(true)
      setFormError('')

      await onSubmit({
        creditCard: {
          holderName: normalizedHolderName,
          number: normalizedCardNumber,
          expiryMonth: normalizedExpiryMonth.padStart(2, '0'),
          expiryYear: normalizedExpiryYear.length === 2 ? `20${normalizedExpiryYear}` : normalizedExpiryYear,
          ccv: normalizedCcv,
        },
        creditCardHolderInfo: {
          name: normalizedHolderName,
          email: normalizedEmail,
          cpfCnpj: normalizedCpfCnpj,
          postalCode: normalizedPostalCode,
          addressNumber: normalizedAddressNumber,
          addressComplement: addressComplement.trim() || null,
          phone: normalizedPhone || null,
          mobilePhone: normalizedMobilePhone || null,
        },
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nao foi possivel atualizar o cartao.'
      setFormError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={containerStyle}>
      {disabled && (
        <div style={processingOverlayStyle}>
          <div style={processingBoxStyle}>
            <div style={processingTitleStyle}>{processingTitle}</div>
            <div style={processingTextStyle}>{processingText}</div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gap: 4 }}>
        <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>{title}</div>
        <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{helperText}</div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'grid', gap: 6 }}>
          <label style={fieldLabelStyle}>Titular do cartao</label>
          <input value={holderName} onChange={event => setHolderName(event.target.value)} style={textInputStyle} placeholder="Nome impresso no cartao" />
        </div>

        <div style={{ display: 'grid', gap: 6 }}>
          <label style={fieldLabelStyle}>Numero do cartao</label>
          <input value={cardNumber} onChange={event => setCardNumber(event.target.value)} style={textInputStyle} placeholder="0000 0000 0000 0000" inputMode="numeric" autoComplete="cc-number" />
        </div>

        <div style={twoColumnsStyle}>
          <div style={{ display: 'grid', gap: 6 }}>
            <label style={fieldLabelStyle}>Mes</label>
            <input value={expiryMonth} onChange={event => setExpiryMonth(event.target.value)} style={textInputStyle} placeholder="MM" inputMode="numeric" autoComplete="cc-exp-month" />
          </div>
          <div style={{ display: 'grid', gap: 6 }}>
            <label style={fieldLabelStyle}>Ano</label>
            <input value={expiryYear} onChange={event => setExpiryYear(event.target.value)} style={textInputStyle} placeholder="AAAA" inputMode="numeric" autoComplete="cc-exp-year" />
          </div>
        </div>

        <div style={{ display: 'grid', gap: 6 }}>
          <label style={fieldLabelStyle}>Codigo de seguranca</label>
          <input value={ccv} onChange={event => setCcv(event.target.value)} style={textInputStyle} placeholder="CVV" inputMode="numeric" autoComplete="cc-csc" />
        </div>

        <div style={twoColumnsStyle}>
          <div style={{ display: 'grid', gap: 6 }}>
            <label style={fieldLabelStyle}>Email do titular</label>
            <input value={holderEmail} onChange={event => setHolderEmail(event.target.value)} style={textInputStyle} placeholder="email@exemplo.com" type="email" autoComplete="email" />
          </div>
          <div style={{ display: 'grid', gap: 6 }}>
            <label style={fieldLabelStyle}>CPF ou CNPJ</label>
            <input value={cpfCnpj} onChange={event => setCpfCnpj(event.target.value)} style={textInputStyle} placeholder="Somente numeros" inputMode="numeric" />
          </div>
        </div>

        <div style={twoColumnsStyle}>
          <div style={{ display: 'grid', gap: 6 }}>
            <label style={fieldLabelStyle}>CEP</label>
            <input value={postalCode} onChange={event => setPostalCode(event.target.value)} style={textInputStyle} placeholder="Somente numeros" inputMode="numeric" autoComplete="postal-code" />
          </div>
          <div style={{ display: 'grid', gap: 6 }}>
            <label style={fieldLabelStyle}>Numero do endereco</label>
            <input value={addressNumber} onChange={event => setAddressNumber(event.target.value)} style={textInputStyle} placeholder="Numero" autoComplete="address-line2" />
          </div>
        </div>

        <div style={{ display: 'grid', gap: 6 }}>
          <label style={fieldLabelStyle}>Complemento</label>
          <input value={addressComplement} onChange={event => setAddressComplement(event.target.value)} style={textInputStyle} placeholder="Opcional" autoComplete="address-line2" />
        </div>

        <div style={twoColumnsStyle}>
          <div style={{ display: 'grid', gap: 6 }}>
            <label style={fieldLabelStyle}>Telefone</label>
            <input value={phone} onChange={event => setPhone(event.target.value)} style={textInputStyle} placeholder="Opcional" inputMode="tel" autoComplete="tel" />
          </div>
          <div style={{ display: 'grid', gap: 6 }}>
            <label style={fieldLabelStyle}>Celular</label>
            <input value={mobilePhone} onChange={event => setMobilePhone(event.target.value)} style={textInputStyle} placeholder="Opcional" inputMode="tel" autoComplete="tel-national" />
          </div>
        </div>

        {formError && <div style={errorBoxStyle}>{formError}</div>}

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button type="submit" disabled={disabled} style={disabled ? disabledButtonStyle : submitButtonStyle}>
            {disabled ? 'Processando...' : submitLabel}
          </button>

          {onCancel && (
            <button type="button" onClick={onCancel} disabled={disabled} style={secondaryButtonStyle}>
              Fechar formulario
            </button>
          )}
        </div>
      </form>
    </div>
  )
}

const containerStyle: CSSProperties = {
  marginTop: 16,
  padding: 14,
  borderRadius: 12,
  border: '1px solid #e2e8f0',
  background: '#ffffff',
  display: 'grid',
  gap: 12,
  position: 'relative',
}

const twoColumnsStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 12,
}

const fieldLabelStyle: CSSProperties = {
  fontSize: '0.84rem',
  fontWeight: 600,
  color: '#334155',
}

const textInputStyle: CSSProperties = {
  height: 40,
  borderRadius: 8,
  border: '1px solid #cbd5e1',
  padding: '8px 12px',
  fontSize: '0.9rem',
  outline: 'none',
  background: '#fff',
}

const errorBoxStyle: CSSProperties = {
  padding: '10px 12px',
  borderRadius: 10,
  background: '#fee2e2',
  color: '#b91c1c',
  fontWeight: 600,
  fontSize: '0.9rem',
}

const submitButtonStyle: CSSProperties = {
  border: 'none',
  borderRadius: 999,
  background: '#0f172a',
  color: '#fff',
  fontWeight: 700,
  padding: '12px 18px',
  cursor: 'pointer',
}

const disabledButtonStyle: CSSProperties = {
  ...submitButtonStyle,
  opacity: 0.7,
  cursor: 'not-allowed',
}

const secondaryButtonStyle: CSSProperties = {
  border: '1px solid #cbd5e1',
  borderRadius: 999,
  background: '#fff',
  color: '#334155',
  fontWeight: 600,
  padding: '12px 18px',
  cursor: 'pointer',
}

const processingOverlayStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'rgba(255,255,255,0.82)',
  display: 'grid',
  placeItems: 'center',
  borderRadius: 12,
  zIndex: 2,
}

const processingBoxStyle: CSSProperties = {
  minWidth: 240,
  padding: 16,
  borderRadius: 12,
  background: '#fff',
  border: '1px solid #dbeafe',
  boxShadow: '0 10px 25px rgba(15, 23, 42, 0.08)',
  display: 'grid',
  gap: 6,
}

const processingTitleStyle: CSSProperties = {
  fontWeight: 700,
  color: '#0f172a',
}

const processingTextStyle: CSSProperties = {
  fontSize: '0.9rem',
  color: '#475569',
  lineHeight: 1.5,
}
