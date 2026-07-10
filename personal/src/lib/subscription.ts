import { supabase } from './supabase'

type RequestDowngradeInput = {
  targetPlan: string
}

type RequestDowngradeResponse = {
  success: boolean
  currentPlan: string
  targetPlan: string
  targetStudentLimit: number
  activeStudents: number
  effectiveAt: string
}

type CancelDowngradeResponse = {
  success: boolean
  currentPlan: string
  canceledPlan: string
}

type CreateRegularizationPaymentInput = {
  method: 'pix' | 'checkout-pro'
}

type CreateRegularizationPaymentResponse = {
  success: boolean
  action: 'create_regularization_payment'
  paymentId: string
  providerPaymentId: string | null
  status: 'pending' | 'approved' | 'failed' | 'canceled' | 'refunded'
  method: 'pix' | 'checkout-pro'
  checkoutUrl: string | null
  pixCode: string | null
  qrCodeBase64: string | null
  ticketUrl: string | null
}

type CheckPaymentStatusInput = {
  providerPaymentId?: string | null
  localPaymentId?: string | null
}

type CheckPaymentStatusResponse = {
  success: boolean
  approved: boolean
  status: 'pending' | 'approved' | 'failed' | 'canceled' | 'refunded'
  providerPaymentId: string | null
  requiresRedirectCheck?: boolean
}

type PayWithCardTokenInput = {
  token: string
  paymentMethodId: string
  issuerId?: string | null
  installments: number
  identificationType: string
  identificationNumber: string
}

type PayWithCardTokenResponse = {
  success: boolean
  action: 'pay_with_card_token'
  paymentId: string
  providerPaymentId: string | null
  status: 'pending' | 'approved' | 'failed' | 'canceled' | 'refunded'
  approved: boolean
  statusDetail: string | null
}

type ChargeSavedCardResponse = {
  success: boolean
  action: 'charge_saved_card'
  paymentId: string
  providerPaymentId: string | null
  status: 'pending' | 'approved' | 'failed' | 'canceled' | 'refunded'
  approved: boolean
  statusDetail: string | null
}

type SaveCardTokenInput = {
  token: string
  paymentMethodId: string
  issuerId?: string | null
  installments: number
  identificationType: string
  identificationNumber: string
}

type SaveCardTokenResponse = {
  success: boolean
  action: 'save_card_token'
  provider: 'mercadopago'
  providerCustomerId: string
  providerCardId: string
  brand: string | null
  lastFour: string | null
}

type RemoveSavedPaymentMethodResponse = {
  success: boolean
  action: 'remove_saved_card'
}

export async function requestSubscriptionDowngrade(input: RequestDowngradeInput): Promise<RequestDowngradeResponse> {
  const { data, error } = await supabase.functions.invoke('manage-personal-subscription', {
    body: {
      action: 'request_downgrade',
      ...input,
    },
  })

  if (error) {
    throw new Error(await extractFunctionErrorMessage(error, 'Não foi possível solicitar o downgrade do plano.'))
  }

  if (data?.error) throw new Error(data.error)
  if (!data?.success) throw new Error('Resposta inválida ao solicitar downgrade.')

  return data as RequestDowngradeResponse
}

export async function cancelSubscriptionDowngrade(): Promise<CancelDowngradeResponse> {
  const { data, error } = await supabase.functions.invoke('manage-personal-subscription', {
    body: {
      action: 'cancel_downgrade',
    },
  })

  if (error) {
    throw new Error(await extractFunctionErrorMessage(error, 'Não foi possível cancelar o downgrade agendado.'))
  }

  if (data?.error) throw new Error(data.error)
  if (!data?.success) throw new Error('Resposta inválida ao cancelar o downgrade.')

  return data as CancelDowngradeResponse
}

export async function createRegularizationPayment(input: CreateRegularizationPaymentInput): Promise<CreateRegularizationPaymentResponse> {
  const { data, error } = await supabase.functions.invoke('manage-personal-subscription', {
    body: {
      action: 'create_regularization_payment',
      ...input,
    },
  })

  if (error) {
    throw new Error(await extractFunctionErrorMessage(error, 'Não foi possível gerar a cobrança de regularização.'))
  }

  if (data?.error) throw new Error(data.error)
  if (!data?.success) throw new Error('Resposta inválida ao gerar a cobrança.')

  return data as CreateRegularizationPaymentResponse
}

export async function checkSubscriptionPaymentStatus(input: CheckPaymentStatusInput): Promise<CheckPaymentStatusResponse> {
  const { data, error } = await supabase.functions.invoke('manage-personal-subscription', {
    body: {
      action: 'check_payment_status',
      ...input,
    },
  })

  if (error) {
    throw new Error(await extractFunctionErrorMessage(error, 'Não foi possível consultar o status do pagamento.'))
  }

  if (data?.error) throw new Error(data.error)
  if (!data?.success) throw new Error('Resposta inválida ao consultar o pagamento.')

  return data as CheckPaymentStatusResponse
}

export async function payWithCardToken(input: PayWithCardTokenInput): Promise<PayWithCardTokenResponse> {
  const { data, error } = await supabase.functions.invoke('manage-personal-subscription', {
    body: {
      action: 'pay_with_card_token',
      ...input,
    },
  })

  if (error) {
    throw new Error(await extractFunctionErrorMessage(error, 'Não foi possível processar o pagamento com cartão.'))
  }

  if (data?.error) throw new Error(data.error)
  if (!data?.success) throw new Error('Resposta inválida ao processar o pagamento com cartão.')

  return data as PayWithCardTokenResponse
}

export async function chargeSavedCard(): Promise<ChargeSavedCardResponse> {
  const { data, error } = await supabase.functions.invoke('manage-personal-subscription', {
    body: {
      action: 'charge_saved_card',
    },
  })

  if (error) {
    throw new Error(await extractFunctionErrorMessage(error, 'Não foi possível cobrar o cartão salvo.'))
  }

  if (data?.error) throw new Error(data.error)
  if (!data?.success) throw new Error('Resposta inválida ao cobrar o cartão salvo.')

  return data as ChargeSavedCardResponse
}

export async function saveCardToken(input: SaveCardTokenInput): Promise<SaveCardTokenResponse> {
  const { data, error } = await supabase.functions.invoke('manage-personal-subscription', {
    body: {
      action: 'save_card_token',
      ...input,
    },
  })

  if (error) {
    throw new Error(await extractFunctionErrorMessage(error, 'Não foi possível salvar o cartão.'))
  }

  if (data?.error) throw new Error(data.error)
  if (!data?.success) throw new Error('Resposta inválida ao salvar o cartão.')

  return data as SaveCardTokenResponse
}

export async function removeSavedPaymentMethod(): Promise<RemoveSavedPaymentMethodResponse> {
  const { data, error } = await supabase.functions.invoke('manage-personal-subscription', {
    body: {
      action: 'remove_saved_card',
    },
  })

  if (error) {
    throw new Error(await extractFunctionErrorMessage(error, 'Não foi possível excluir o cartão cadastrado.'))
  }

  if (data?.error) throw new Error(data.error)
  if (!data?.success) throw new Error('Resposta inválida ao excluir o cartão cadastrado.')

  return data as RemoveSavedPaymentMethodResponse
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
