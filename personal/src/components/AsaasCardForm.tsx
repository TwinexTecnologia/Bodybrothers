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

export type AsaasCardHolderInfoDefaults = {
  name?: string | null
  email?: string | null
  cpfCnpj?: string | null
  postalCode?: string | null
  addressNumber?: string | null
  addressComplement?: string | null
  phone?: string | null
  mobilePhone?: string | null
}

type AsaasCardFormProps = {
  payerName?: string
  payerEmail?: string
  payerPhone?: string
  savedHolderInfo?: AsaasCardHolderInfoDefaults | null
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
  savedHolderInfo = null,
  loading = false,
  onSubmit,
  onCancel,
  title = 'Trocar cartao',
  submitLabel = 'Salvar novo cartao',
  processingTitle = 'Atualizando cartao...',
  processingText = 'Aguarde um instante enquanto validamos os dados do novo cartao.',
}: AsaasCardFormProps) {
  const [holderName, setHolderName] = useState(savedHolderInfo?.name?.trim() || payerName)
  const [cardNumber, setCardNumber] = useState('')
  const [expiryMonth, setExpiryMonth] = useState('')
  const [expiryYear, setExpiryYear] = useState('')
  const [ccv, setCcv] = useState('')
  const [holderEmail, setHolderEmail] = useState(savedHolderInfo?.email?.trim() || payerEmail)
  const [cpfCnpj, setCpfCnpj] = useState(normalizeDigits(savedHolderInfo?.cpfCnpj || ''))
  const [postalCode, setPostalCode] = useState(normalizeDigits(savedHolderInfo?.postalCode || ''))
  const [addressNumber, setAddressNumber] = useState(savedHolderInfo?.addressNumber?.trim() || '')
  const [addressComplement, setAddressComplement] = useState(savedHolderInfo?.addressComplement?.trim() || '')
  const [phone, setPhone] = useState(normalizeDigits(savedHolderInfo?.phone || payerPhone))
  const [mobilePhone, setMobilePhone] = useState(normalizeDigits(savedHolderInfo?.mobilePhone || payerPhone))
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const disabled = loading || submitting
  const helperText = useMemo(() => {
    return 'Informe apenas os dados do cartao. Os dados do titular ja salvos no cadastro serao reutilizados quando disponiveis.'
  }, [])
  const hasSavedBillingIdentity = useMemo(() => {
    return Boolean(holderEmail.trim() && cpfCnpj.trim() && postalCode.trim() && addressNumber.trim())
  }, [addressNumber, cpfCnpj, holderEmail, postalCode])
  const detectedBrand = useMemo(() => detectCardBrand(cardNumber), [cardNumber])
  const previewCardNumber = useMemo(() => formatCardNumber(cardNumber), [cardNumber])
  const previewHolderName = useMemo(() => (holderName.trim() || 'NOME NO CARTAO').toUpperCase(), [holderName])
  const previewExpiry = useMemo(() => formatExpiryPreview(expiryMonth, expiryYear), [expiryMonth, expiryYear])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const normalizedHolderName = holderName.trim()
    const normalizedCardNumber = normalizeDigits(cardNumber).slice(0, 19)
    const normalizedExpiryMonth = normalizeDigits(expiryMonth).slice(0, 2)
    const normalizedExpiryYear = normalizeDigits(expiryYear).slice(-4)
    const normalizedCcv = normalizeDigits(ccv).slice(0, 4)
    const normalizedEmail = holderEmail.trim()
    const normalizedCpfCnpj = normalizeDigits(cpfCnpj)
    const normalizedPostalCode = normalizeDigits(postalCode)
    const normalizedAddressNumber = addressNumber.trim()
    const normalizedPhone = normalizeDigits(phone)
    const normalizedMobilePhone = normalizeDigits(mobilePhone)

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

      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 16 }}>
        <div style={heroGridStyle}>
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={cardPreviewStyle}>
              <div style={cardPreviewTopStyle}>
                <div style={cardPreviewChipStyle} />
                <div style={cardPreviewBrandStyle}>{formatCardBrandLabel(detectedBrand)}</div>
              </div>
              <div style={cardPreviewNumberStyle}>{previewCardNumber || '**** **** **** ****'}</div>
              <div style={cardPreviewBottomStyle}>
                <div style={{ display: 'grid', gap: 4 }}>
                  <span style={cardPreviewCaptionStyle}>Nome no cartao</span>
                  <span style={cardPreviewValueStyle}>{previewHolderName}</span>
                </div>
                <div style={{ display: 'grid', gap: 4, justifyItems: 'end' }}>
                  <span style={cardPreviewCaptionStyle}>Validade</span>
                  <span style={cardPreviewValueStyle}>{previewExpiry}</span>
                </div>
              </div>
            </div>

            <div style={savedDataBoxStyle}>
              <div style={{ fontWeight: 700, color: '#0f172a' }}>
                {hasSavedBillingIdentity ? 'Dados do titular reaproveitados do cadastro' : 'Complete os dados do titular apenas uma vez'}
              </div>
              <div style={{ fontSize: '0.88rem', color: '#475569', lineHeight: 1.5 }}>
                {hasSavedBillingIdentity
                  ? 'Email, documento e endereco ja estao salvos. Voce precisa informar somente os dados do novo cartao.'
                  : 'O Asaas ainda exige alguns dados do titular para atualizar o cartao. Depois de salvar, eles ficam reaproveitados nas proximas trocas.'}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'grid', gap: 6 }}>
              <label style={fieldLabelStyle}>Titular do cartao</label>
              <input value={holderName} onChange={event => setHolderName(event.target.value)} style={textInputStyle} placeholder="Nome impresso no cartao" autoComplete="cc-name" />
            </div>

            <div style={{ display: 'grid', gap: 6 }}>
              <label style={fieldLabelStyle}>Numero do cartao</label>
              <input
                value={formatCardNumber(cardNumber)}
                onChange={event => setCardNumber(normalizeDigits(event.target.value).slice(0, 19))}
                style={textInputStyle}
                placeholder="0000 0000 0000 0000"
                inputMode="numeric"
                autoComplete="cc-number"
              />
            </div>

            <div style={threeColumnsStyle}>
              <div style={{ display: 'grid', gap: 6 }}>
                <label style={fieldLabelStyle}>Mes</label>
                <input
                  value={expiryMonth}
                  onChange={event => setExpiryMonth(normalizeDigits(event.target.value).slice(0, 2))}
                  style={textInputStyle}
                  placeholder="MM"
                  inputMode="numeric"
                  autoComplete="cc-exp-month"
                />
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
                <label style={fieldLabelStyle}>Ano</label>
                <input
                  value={expiryYear}
                  onChange={event => setExpiryYear(normalizeDigits(event.target.value).slice(0, 4))}
                  style={textInputStyle}
                  placeholder="AAAA"
                  inputMode="numeric"
                  autoComplete="cc-exp-year"
                />
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
                <label style={fieldLabelStyle}>Codigo de seguranca</label>
                <input
                  value={ccv}
                  onChange={event => setCcv(normalizeDigits(event.target.value).slice(0, 4))}
                  style={textInputStyle}
                  placeholder="CVV"
                  inputMode="numeric"
                  autoComplete="cc-csc"
                />
              </div>
            </div>
          </div>
        </div>

        {!hasSavedBillingIdentity && (
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={twoColumnsStyle}>
              <div style={{ display: 'grid', gap: 6 }}>
                <label style={fieldLabelStyle}>Email do titular</label>
                <input value={holderEmail} onChange={event => setHolderEmail(event.target.value)} style={textInputStyle} placeholder="email@exemplo.com" type="email" autoComplete="email" />
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
                <label style={fieldLabelStyle}>CPF ou CNPJ</label>
                <input value={cpfCnpj} onChange={event => setCpfCnpj(normalizeDigits(event.target.value))} style={textInputStyle} placeholder="Somente numeros" inputMode="numeric" />
              </div>
            </div>

            <div style={twoColumnsStyle}>
              <div style={{ display: 'grid', gap: 6 }}>
                <label style={fieldLabelStyle}>CEP</label>
                <input value={postalCode} onChange={event => setPostalCode(normalizeDigits(event.target.value))} style={textInputStyle} placeholder="Somente numeros" inputMode="numeric" autoComplete="postal-code" />
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
                <input value={phone} onChange={event => setPhone(normalizeDigits(event.target.value))} style={textInputStyle} placeholder="Opcional" inputMode="tel" autoComplete="tel" />
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
                <label style={fieldLabelStyle}>Celular</label>
                <input value={mobilePhone} onChange={event => setMobilePhone(normalizeDigits(event.target.value))} style={textInputStyle} placeholder="Opcional" inputMode="tel" autoComplete="tel-national" />
              </div>
            </div>
          </div>
        )}

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

const heroGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(240px, 300px) minmax(0, 1fr)',
  gap: 16,
  alignItems: 'start',
}

const twoColumnsStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 12,
}

const threeColumnsStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
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

const savedDataBoxStyle: CSSProperties = {
  padding: 12,
  borderRadius: 12,
  border: '1px solid #dbeafe',
  background: '#f8fbff',
  display: 'grid',
  gap: 6,
}

const cardPreviewStyle: CSSProperties = {
  minHeight: 188,
  borderRadius: 18,
  padding: 18,
  background: 'linear-gradient(135deg, #0f172a 0%, #1d4ed8 55%, #38bdf8 100%)',
  color: '#fff',
  boxShadow: '0 18px 40px rgba(15, 23, 42, 0.18)',
  display: 'grid',
  gap: 18,
}

const cardPreviewTopStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
}

const cardPreviewChipStyle: CSSProperties = {
  width: 42,
  height: 30,
  borderRadius: 8,
  background: 'linear-gradient(135deg, rgba(255,255,255,0.95), rgba(226,232,240,0.7))',
}

const cardPreviewBrandStyle: CSSProperties = {
  fontSize: '0.78rem',
  fontWeight: 700,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
}

const cardPreviewNumberStyle: CSSProperties = {
  fontSize: '1.15rem',
  fontWeight: 700,
  letterSpacing: '0.14em',
  lineHeight: 1.4,
}

const cardPreviewBottomStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'end',
  justifyContent: 'space-between',
  gap: 12,
  marginTop: 'auto',
}

const cardPreviewCaptionStyle: CSSProperties = {
  fontSize: '0.72rem',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  opacity: 0.82,
}

const cardPreviewValueStyle: CSSProperties = {
  fontSize: '0.9rem',
  fontWeight: 700,
  letterSpacing: '0.08em',
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

function normalizeDigits(value: string) {
  return value.replace(/\D+/g, '')
}

function formatCardNumber(value: string) {
  return normalizeDigits(value)
    .slice(0, 19)
    .replace(/(\d{4})(?=\d)/g, '$1 ')
    .trim()
}

function formatExpiryPreview(month: string, year: string) {
  const normalizedMonth = normalizeDigits(month).slice(0, 2)
  const normalizedYear = normalizeDigits(year).slice(-2)

  if (!normalizedMonth && !normalizedYear) return 'MM/AA'
  return `${normalizedMonth || 'MM'}/${normalizedYear || 'AA'}`
}

function formatCardBrandLabel(brand: string) {
  if (!brand) return 'Cartao'
  if (brand === 'mastercard') return 'Mastercard'
  if (brand === 'visa') return 'Visa'
  if (brand === 'amex') return 'Amex'
  if (brand === 'elo') return 'Elo'
  if (brand === 'discover') return 'Discover'
  return brand
}
