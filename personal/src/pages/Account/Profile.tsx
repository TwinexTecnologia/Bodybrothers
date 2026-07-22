import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import AsaasCardForm, { type AsaasCardFormSubmitData } from '../../components/AsaasCardForm'
import ConfirmModal from '../../components/ConfirmModal'
import MercadoPagoCardForm from '../../components/MercadoPagoCardForm'
import { cancelSubscriptionDowngrade, chargeSavedCard, checkSubscriptionPaymentStatus, createRegularizationPayment, payWithCardToken, removeSavedPaymentMethod, requestSubscriptionDowngrade, saveCardToken } from '../../lib/subscription'
import { useAuth } from '../../auth/useAuth'
import { supabase } from '../../lib/supabase'

type SubscriptionRow = {
  id: string | null
  plan_slug: string | null
  student_limit: number | null
  billing_cycle: 'monthly' | 'quarterly' | 'yearly' | null
  status: string | null
  amount: number | null
  next_billing_at: string | null
  scheduled_plan_slug: string | null
  scheduled_billing_cycle: 'monthly' | 'quarterly' | 'yearly' | null
  scheduled_change_at: string | null
}

type SubscriptionPaymentRow = {
  id: string
  status: 'pending' | 'approved' | 'failed' | 'canceled' | 'refunded'
  amount: number
  currency: string | null
  provider: string | null
  provider_payment_id: string | null
  provider_reference: string | null
  description: string | null
  due_at: string | null
  created_at: string
  raw_payload: Record<string, unknown> | null
}

type SavedPaymentMethod = {
  provider: 'mercadopago' | 'asaas'
  providerCustomerId: string
  providerCardId: string | null
  providerPaymentProfileId: string | null
  providerPaymentMethodToken: string | null
  providerSubscriptionId: string | null
  paymentMethodId: string | null
  issuerId: string | null
  brand: string | null
  lastFour: string | null
  firstPaymentProviderPaymentId: string | null
  updatedAt: string | null
}

type StoredPaymentMethodRow = {
  provider: string | null
  provider_customer_id: string | null
  provider_card_id: string | null
  provider_payment_profile_id: string | null
  provider_payment_method_token: string | null
  provider_subscription_id: string | null
  payment_method_id: string | null
  issuer_id: string | null
  brand: string | null
  last_four: string | null
  first_payment_provider_payment_id: string | null
  updated_at: string | null
}

type CardChargeResponse = {
  approved: boolean
  status: SubscriptionPaymentRow['status']
  statusDetail: string | null
}

const PLAN_LABELS: Record<string, string> = {
  free: 'Free',
  starter: 'Starter',
  premium: 'Premium',
  pro: 'Pro',
  elite: 'Elite',
  unlimited: 'Ilimitado',
}

const STATUS_LABELS: Record<string, string> = {
  free: 'Free',
  active: 'Ativo',
  pending_payment: 'Aguardando pagamento',
  past_due: 'Em atraso',
  blocked: 'Bloqueado',
  canceled: 'Cancelado',
}

const BILLING_CYCLE_LABELS: Record<string, string> = {
  monthly: 'Mensal',
  quarterly: 'Trimestral',
  yearly: 'Anual',
}

const PLAN_CHANGE_RANKS: Record<string, number> = {
  free: 0,
  starter: 1,
  premium: 2,
  pro: 2,
  elite: 3,
  unlimited: 3,
}

export default function Profile() {
  const { refreshAuthState } = useAuth()
  const mercadoPagoPublicKey = import.meta.env.VITE_MERCADO_PAGO_PUBLIC_KEY || ''
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  // Dados do Perfil
  const [id, setId] = useState('')
  const [personalAccountId, setPersonalAccountId] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [subscription, setSubscription] = useState<SubscriptionRow | null>(null)
  const [subscriptionAmount, setSubscriptionAmount] = useState(0)
  const [savedPaymentMethod, setSavedPaymentMethod] = useState<SavedPaymentMethod | null>(null)
  const [latestPayment, setLatestPayment] = useState<SubscriptionPaymentRow | null>(null)
  const [activeStudents, setActiveStudents] = useState(0)
  const [selectedBillingCycle, setSelectedBillingCycle] = useState<SubscriptionRow['billing_cycle']>('monthly')
  const [showPlanChangeOptions, setShowPlanChangeOptions] = useState(false)
  const [planChangeMode, setPlanChangeMode] = useState<'downgrade' | 'upgrade' | null>(null)
  const [selectedTargetPlan, setSelectedTargetPlan] = useState('')
  const [planChangeModalOpen, setPlanChangeModalOpen] = useState(false)
  const [planChangeLoading, setPlanChangeLoading] = useState(false)
  const [billingCycleModalOpen, setBillingCycleModalOpen] = useState(false)
  const [showBillingCycleOptions, setShowBillingCycleOptions] = useState(false)
  const [billingCycleChangeLoading, setBillingCycleChangeLoading] = useState(false)
  const [cancelScheduledChangeLoading, setCancelScheduledChangeLoading] = useState(false)
  const [copyPixMsg, setCopyPixMsg] = useState('')
  const [paymentActionLoading, setPaymentActionLoading] = useState<'pix' | 'card' | 'check' | null>(null)
  const [showCardForm, setShowCardForm] = useState(false)
  const [cardFormMode, setCardFormMode] = useState<'regularization' | 'save-card' | null>(null)
  const [cardFormAmount, setCardFormAmount] = useState<number | null>(null)
  const [removeSavedCardModalOpen, setRemoveSavedCardModalOpen] = useState(false)
  const [removeSavedCardLoading, setRemoveSavedCardLoading] = useState(false)

  // Dados de Senha
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const canManageBillingCycle = useMemo(() => {
    const plan = subscription?.plan_slug || 'free'
    return plan !== 'free'
  }, [subscription])

  const currentPlan = subscription?.plan_slug || 'free'
  const currentBillingCycle = subscription?.billing_cycle || 'monthly'
  const currentPlanRank = PLAN_CHANGE_RANKS[currentPlan] || 0
  const scheduledTargetPlan = subscription?.scheduled_plan_slug || currentPlan
  const scheduledTargetBillingCycle = subscription?.scheduled_billing_cycle || null
  const hasScheduledChange = Boolean(subscription?.scheduled_change_at && (subscription?.scheduled_plan_slug || subscription?.scheduled_billing_cycle))
  const canManagePlanChange = currentPlan !== 'free'
  const billingCycleOptions = useMemo(() => {
    return (Object.entries(BILLING_CYCLE_LABELS) as Array<[NonNullable<SubscriptionRow['billing_cycle']>, string]>)
      .filter(([cycle]) => cycle !== currentBillingCycle)
  }, [currentBillingCycle])
  const planChangeOptions = useMemo(() => {
    if (!canManagePlanChange || !planChangeMode) return [] as Array<[string, string]>

    return (Object.entries(PLAN_LABELS) as Array<[string, string]>)
      .filter(([plan]) => {
        if (plan === currentPlan) return false

        const rank = PLAN_CHANGE_RANKS[plan] ?? -1
        return planChangeMode === 'downgrade'
          ? rank < currentPlanRank
          : rank > currentPlanRank
      })
  }, [canManagePlanChange, currentPlan, currentPlanRank, planChangeMode])
  const canScheduleBillingCycleChange = canManageBillingCycle && !hasScheduledChange
  const canSchedulePlanChange = canManagePlanChange && !hasScheduledChange
  const selectedBillingCycleLabel = selectedBillingCycle ? BILLING_CYCLE_LABELS[selectedBillingCycle] || selectedBillingCycle : ''
  const currentPlanLabel = PLAN_LABELS[currentPlan] || currentPlan
  const currentBillingCycleLabel = BILLING_CYCLE_LABELS[currentBillingCycle] || 'Mensal'
  const scheduledTargetPlanLabel = PLAN_LABELS[scheduledTargetPlan] || scheduledTargetPlan
  const scheduledTargetBillingCycleLabel = scheduledTargetBillingCycle
    ? BILLING_CYCLE_LABELS[scheduledTargetBillingCycle] || scheduledTargetBillingCycle
    : null
  const selectedTargetPlanLabel = PLAN_LABELS[selectedTargetPlan] || selectedTargetPlan
  const isFreeCancellationScheduled = hasScheduledChange && scheduledTargetPlan === 'free'
  const isFreePlanSelection = planChangeMode === 'downgrade' && selectedTargetPlan === 'free'
  const paymentActionData = useMemo(() => extractPaymentActionData(latestPayment?.raw_payload), [latestPayment])
  const canCopyPix = Boolean(paymentActionData.pixCode)
  const needsRegularization = subscription?.status === 'blocked' || subscription?.status === 'past_due'
  const isAsaasSubscriptionFlow = savedPaymentMethod?.provider === 'asaas' || latestPayment?.provider === 'asaas'
  const hasSavedPaymentMethod = isAsaasSubscriptionFlow
    ? Boolean(savedPaymentMethod)
    : Boolean(savedPaymentMethod?.providerCardId || savedPaymentMethod?.providerPaymentProfileId)
  const savedPaymentMethodValidated = Boolean(savedPaymentMethod?.firstPaymentProviderPaymentId || savedPaymentMethod?.provider === 'asaas')
  const cardPaymentAmount = useMemo(() => {
    const explicitCardAmount = normalizeMoneyValue(cardFormAmount)
    if (explicitCardAmount > 0) return explicitCardAmount

    const latestPaymentAmount = normalizeMoneyValue(latestPayment?.amount)
    if (latestPaymentAmount > 0) return latestPaymentAmount

    if (subscriptionAmount > 0) return subscriptionAmount

    const subscriptionAmountFromObject = normalizeMoneyValue(subscription?.amount)
    if (subscriptionAmountFromObject > 0) return subscriptionAmountFromObject

    return 0
  }, [cardFormAmount, latestPayment, subscription, subscriptionAmount])

  useEffect(() => {
    loadProfile()
  }, [])

  useEffect(() => {
    if (!billingCycleOptions.length) {
      setSelectedBillingCycle(currentBillingCycle)
      return
    }

    const hasCurrentOption = billingCycleOptions.some(([cycle]) => cycle === selectedBillingCycle)
    if (!hasCurrentOption) {
      setSelectedBillingCycle(billingCycleOptions[0][0])
    }
  }, [billingCycleOptions, currentBillingCycle, selectedBillingCycle])

  useEffect(() => {
    if (!planChangeOptions.length) {
      setSelectedTargetPlan('')
      return
    }

    const hasCurrentOption = planChangeOptions.some(([plan]) => plan === selectedTargetPlan)
    if (!hasCurrentOption) {
      setSelectedTargetPlan(planChangeOptions[0][0])
    }
  }, [planChangeOptions, selectedTargetPlan])

  async function loadProfile() {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) throw new Error('Usuário não autenticado')
      
      setId(user.id)
      setEmail(user.email || '')

      // Buscar dados do profile
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (error) throw error

      if (profile) {
        setName(profile.full_name || '')
        setPhone(profile.data?.phone || '')
      }

      const resolvedPersonalAccountId = typeof profile?.personal_id === 'string' && profile.personal_id
        ? profile.personal_id
        : user.id

      setPersonalAccountId(resolvedPersonalAccountId)

      const [paymentMethodResult, subscriptionResult, studentsResult] = await Promise.all([
        supabase
          .from('personal_payment_methods')
          .select('provider, provider_customer_id, provider_card_id, provider_payment_profile_id, provider_payment_method_token, provider_subscription_id, payment_method_id, issuer_id, brand, last_four, first_payment_provider_payment_id, updated_at')
          .eq('personal_id', resolvedPersonalAccountId)
          .eq('status', 'active')
          .maybeSingle<StoredPaymentMethodRow>(),
        supabase
          .from('personal_subscriptions')
          .select('id, plan_slug, student_limit, billing_cycle, status, amount, next_billing_at, scheduled_plan_slug, scheduled_billing_cycle, scheduled_change_at')
          .eq('personal_id', resolvedPersonalAccountId)
          .maybeSingle<SubscriptionRow>(),
        supabase
          .from('profiles')
          .select('id, data')
          .eq('personal_id', resolvedPersonalAccountId)
          .eq('role', 'aluno')
      ])

      if (paymentMethodResult.error) {
        console.error('Erro ao carregar personal_payment_methods:', paymentMethodResult.error)
      }

      if (subscriptionResult.error) {
        console.error('Erro ao carregar personal_subscriptions:', subscriptionResult.error)
      }

      if (studentsResult.error) {
        console.error('Erro ao carregar alunos ativos:', studentsResult.error)
      }

      setSavedPaymentMethod(resolveSavedPaymentMethod(profile?.data, paymentMethodResult.data || null))

      const fallbackSubscription = buildLegacySubscription(profile?.data)
      const resolvedSubscription = subscriptionResult.data || fallbackSubscription

      setSubscription(resolvedSubscription)
      setSubscriptionAmount(normalizeMoneyValue(subscriptionResult.data?.amount))
      setActiveStudents((studentsResult.data || []).filter((student: any) => (student?.data?.status || 'ativo') !== 'inativo').length)

      if (subscriptionResult.data?.id && (resolvedSubscription?.status === 'blocked' || resolvedSubscription?.status === 'past_due')) {
        const { data: paymentData } = await supabase
          .from('subscription_payments')
          .select('id, status, amount, currency, provider, provider_payment_id, provider_reference, description, due_at, created_at, raw_payload')
          .eq('subscription_id', subscriptionResult.data.id)
          .in('status', ['pending', 'failed'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle<SubscriptionPaymentRow>()

        setLatestPayment(paymentData || null)
      } else {
        setLatestPayment(null)
        setShowCardForm(false)
        setCardFormMode(null)
        setCardFormAmount(null)
      }
    } catch (error: any) {
      console.error(error)
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateProfile = async () => {
    setSaving(true)
    setMsg('')
    setError('')

    try {
      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('data')
        .eq('id', id)
        .single()

      const newData = {
        ...(currentProfile?.data || {}),
        phone: phone,
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          full_name: name,
          data: newData
        })
        .eq('id', id)

      if (updateError) throw updateError

      // 2. Atualizar Senha (se preenchida)
      if (newPassword) {
        if (newPassword.length < 6) {
            throw new Error('A senha deve ter no mínimo 6 caracteres.')
        }
        if (newPassword !== confirmPassword) {
            throw new Error('As senhas não conferem.')
        }

        const { error: passwordError } = await supabase.auth.updateUser({
            password: newPassword
        })

        if (passwordError) throw passwordError
        setNewPassword('')
        setConfirmPassword('')
      }

      setMsg('Perfil atualizado com sucesso!')
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Erro ao atualizar perfil.')
    } finally {
      setSaving(false)
    }
  }

  async function handleConfirmBillingCycleChange() {
    if (!selectedBillingCycle) return

    try {
      setBillingCycleChangeLoading(true)
      setMsg('')
      setError('')

      const response = await requestSubscriptionDowngrade({
        targetPlan: currentPlan,
        targetBillingCycle: selectedBillingCycle,
      })

      setBillingCycleModalOpen(false)
      setShowBillingCycleOptions(false)
      setMsg(
        `Mudança do plano ${PLAN_LABELS[response.targetPlan] || response.targetPlan} para o ciclo ${BILLING_CYCLE_LABELS[response.targetBillingCycle] || response.targetBillingCycle} agendada para ${formatDate(response.effectiveAt)}. A cobrança será feita somente a partir dessa data.`,
      )
      await loadProfile()
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Não foi possível solicitar a troca de ciclo do plano.')
    } finally {
      setBillingCycleChangeLoading(false)
    }
  }

  async function handleCancelScheduledChange() {
    const canceledCycleLabel = scheduledTargetBillingCycleLabel
    const canceledPlanLabel = scheduledTargetPlanLabel
    const cancelingFreeSchedule = scheduledTargetPlan === 'free'

    try {
      setCancelScheduledChangeLoading(true)
      setMsg('')
      setError('')

      const response = await cancelSubscriptionDowngrade()
      setShowPlanChangeOptions(false)
      setPlanChangeMode(null)
      setShowBillingCycleOptions(false)
      setMsg(
        cancelingFreeSchedule
          ? 'Cancelamento agendado removido com sucesso. Sua assinatura paga continuará renovando normalmente.'
          : canceledCycleLabel
          ? `Mudança agendada do plano ${canceledPlanLabel} para o ciclo ${canceledCycleLabel} cancelada com sucesso.`
          : `Mudança agendada do plano ${PLAN_LABELS[response.canceledPlan] || response.canceledPlan} cancelada com sucesso.`,
      )
      await loadProfile()
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Não foi possível cancelar a mudança agendada.')
    } finally {
      setCancelScheduledChangeLoading(false)
    }
  }

  async function handleConfirmPlanChange() {
    if (!selectedTargetPlan) return

    try {
      setPlanChangeLoading(true)
      setMsg('')
      setError('')

      const response = await requestSubscriptionDowngrade({
        targetPlan: selectedTargetPlan,
        targetBillingCycle: currentBillingCycle,
      })

      setPlanChangeModalOpen(false)
      setShowPlanChangeOptions(false)
      setPlanChangeMode(null)
      setShowBillingCycleOptions(false)
      setMsg(
        response.targetPlan === 'free'
          ? `Cancelamento agendado com sucesso. Seu plano ${currentPlanLabel} continua ativo ate ${formatDate(response.effectiveAt)}. Depois disso, a assinatura vira Free e nenhuma nova cobranca sera gerada.`
          : `Mudança do plano ${currentPlanLabel} para ${PLAN_LABELS[response.targetPlan] || response.targetPlan} agendada para ${formatDate(response.effectiveAt)}. O novo plano entra em vigor somente nessa data.`,
      )
      await loadProfile()
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Não foi possível agendar a mudança de plano.')
    } finally {
      setPlanChangeLoading(false)
    }
  }

  async function handleCopyPixCode() {
    if (!paymentActionData.pixCode) return

    try {
      await navigator.clipboard.writeText(paymentActionData.pixCode)
      setCopyPixMsg('Codigo PIX copiado com sucesso.')
      window.setTimeout(() => setCopyPixMsg(''), 3000)
    } catch (error) {
      console.error(error)
      setCopyPixMsg('Nao foi possivel copiar o codigo PIX automaticamente.')
    }
  }

  async function openCardForm(mode: 'regularization' | 'save-card') {
    if (!isAsaasSubscriptionFlow && !mercadoPagoPublicKey) {
      throw new Error('A public key do Mercado Pago ainda não foi configurada no front.')
    }

    const { data: { user } } = await supabase.auth.getUser()
    const { data: freshSubscriptionAmount } = await supabase
      .from('personal_subscriptions')
      .select('amount')
      .eq('personal_id', personalAccountId || user?.id || id)
      .maybeSingle<{ amount: number | string | null }>()

    const normalizedAmount = normalizeMoneyValue(freshSubscriptionAmount?.amount)

    setCardFormAmount(normalizedAmount > 0 ? normalizedAmount : 1)
    setCardFormMode(mode)
    setShowCardForm(true)
  }

  async function handleGenerateRegularizationPayment(action: 'pix' | 'card-pay' | 'card-change') {
    try {
      setMsg('')
      setError('')
      setCopyPixMsg('')

      if (isAsaasSubscriptionFlow && action === 'card-pay' && !hasSavedPaymentMethod) {
        throw new Error('Nenhum cartao salvo foi encontrado para pagar essa cobranca. Atualize o cartao da assinatura ou use o PIX.')
      }

      if (action === 'card-pay' && hasSavedPaymentMethod && savedPaymentMethodValidated) {
        setPaymentActionLoading('card')
        const response = await chargeSavedCard()
        setShowCardForm(false)
        setCardFormMode(null)
        setCardFormAmount(null)
        await handleCardChargeResponse(response)
        return
      }

      if (action !== 'pix') {
        await openCardForm(action === 'card-change' ? 'save-card' : 'regularization')
        if (action === 'card-change') {
          setMsg(isAsaasSubscriptionFlow
            ? 'Preencha o formulário abaixo para trocar o cartão salvo da sua assinatura.'
            : hasSavedPaymentMethod
              ? 'Preencha o formulário abaixo para trocar o cartão cadastrado.'
              : 'Preencha o formulário abaixo para cadastrar um cartão no seu perfil.')
        } else {
          setMsg(hasSavedPaymentMethod && !savedPaymentMethodValidated
            ? 'Esse cartao salvo ainda precisa da primeira validacao com CVV. Preencha o formulario para concluir essa etapa e liberar as proximas cobrancas automaticas.'
            : 'Preencha o formulário abaixo para pagar com cartão sem sair da tela.')
        }
        return
      }

      setPaymentActionLoading('pix')
      const response = await createRegularizationPayment({ method: 'pix' })
      setCardFormAmount(null)
      setShowCardForm(false)
      await loadProfile()
      setMsg(response.pixCode ? 'PIX gerado com sucesso.' : 'Cobrança PIX gerada. Confira os dados abaixo.')
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Não foi possível gerar a cobrança.')
    } finally {
      setPaymentActionLoading(null)
    }
  }

  async function handleCardChargeResponse(response: CardChargeResponse) {
    setCardFormAmount(null)
    await loadProfile()
    await refreshAuthState()

    if (response.approved) {
      setShowCardForm(false)
      setCardFormMode(null)
      setMsg('Pagamento aprovado com sucesso. O acesso do personal foi regularizado.')
      return
    }

    if (response.status === 'pending') {
      setMsg('Pagamento enviado com sucesso e aguardando confirmacao. Clique em "Checar pagamento" em alguns segundos para atualizar o status.')
      return
    }

    throw new Error(response.statusDetail || 'O pagamento com cartão não foi aprovado.')
  }

  async function handleCardFormSubmit(data: {
    token: string
    paymentMethodId: string
    issuerId?: string | null
    installments: number
    identificationType: string
    identificationNumber: string
  } | AsaasCardFormSubmitData) {
    try {
      setPaymentActionLoading('card')
      setMsg('')
      setError('')
      setCopyPixMsg('')

      if (cardFormMode === 'save-card') {
        const response = await saveCardToken(data)
        setCardFormAmount(null)
        setShowCardForm(false)
        setCardFormMode(null)
        await loadProfile()
        setMsg(
          response.provider === 'asaas'
            ? `Cartão ${formatSavedCardBrand(response.brand)} final ${response.lastFour || '****'} atualizado com sucesso para as próximas cobranças.`
            : `Cartão ${formatSavedCardBrand(response.brand)} final ${response.lastFour || '****'} cadastrado com sucesso.`,
        )
        return
      }

      const response = await payWithCardToken(data)
      await handleCardChargeResponse(response)
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Não foi possível processar o pagamento com cartão.')
    } finally {
      setPaymentActionLoading(null)
    }
  }

  async function handleRemoveSavedCard() {
    try {
      setRemoveSavedCardLoading(true)
      setMsg('')
      setError('')

      await removeSavedPaymentMethod()
      setRemoveSavedCardModalOpen(false)
      setShowCardForm(false)
      setCardFormMode(null)
      await loadProfile()
      setMsg('Cartão cadastrado excluído com sucesso.')
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Não foi possível excluir o cartão cadastrado.')
    } finally {
      setRemoveSavedCardLoading(false)
    }
  }

  async function handleCheckPaymentStatus() {
    try {
      setPaymentActionLoading('check')
      setMsg('')
      setError('')

      const response = await checkSubscriptionPaymentStatus({
        providerPaymentId: latestPayment?.provider_payment_id,
        localPaymentId: latestPayment?.id,
      })

      await loadProfile()
      await refreshAuthState()

      if (response.approved) {
        setMsg('Pagamento aprovado com sucesso. O acesso do personal foi regularizado.')
      } else if (response.requiresRedirectCheck) {
        setMsg('A cobrança de checkout ainda depende da confirmação do retorno ou do webhook do Mercado Pago.')
      } else {
        setMsg(`Pagamento ainda não aprovado. Status atual: ${getPaymentStatusLabel(response.status)}.`)
      }
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Não foi possível consultar o status do pagamento.')
    } finally {
      setPaymentActionLoading(null)
    }
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Carregando perfil...</div>

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: '1.8rem', color: '#0f172a', margin: 0 }}>Perfil do Personal</h1>
        <p style={{ color: '#64748b', marginTop: 4 }}>Gerencie seus dados de acesso e acompanhe o status do seu plano.</p>
      </div>

      <div style={{ display: 'grid', gap: 24 }}>
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>Dados do Perfil</h3>
          </div>
          <div style={{ padding: 24, display: 'grid', gap: 16 }}>
            <label style={{ display: 'grid', gap: 8 }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>Nome</span>
              <input value={name} onChange={e => setName(e.target.value)} style={{ padding: 12, borderRadius: 8, border: '1px solid #cbd5e1' }} />
            </label>
            <label style={{ display: 'grid', gap: 8 }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>Email</span>
              <input value={email} disabled style={{ padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc', color: '#64748b' }} />
            </label>
            <label style={{ display: 'grid', gap: 8 }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>Telefone</span>
              <input value={phone} onChange={e => setPhone(e.target.value)} style={{ padding: 12, borderRadius: 8, border: '1px solid #cbd5e1' }} />
            </label>
            <div style={{ display: 'grid', gap: 8 }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>Nova senha</span>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Opcional" style={{ padding: 12, borderRadius: 8, border: '1px solid #cbd5e1' }} />
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>Confirmar nova senha</span>
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repita a nova senha" style={{ padding: 12, borderRadius: 8, border: '1px solid #cbd5e1' }} />
            </div>
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>Plano e Assinatura</h3>
          </div>
          <div style={{ padding: 24, display: 'grid', gap: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
              <InfoCard label="Plano atual" value={PLAN_LABELS[subscription?.plan_slug || 'free'] || 'Free'} />
              <InfoCard label="Status" value={STATUS_LABELS[subscription?.status || 'free'] || 'Free'} tone={subscription?.status === 'blocked' ? 'danger' : subscription?.status === 'past_due' ? 'warning' : 'default'} />
              <InfoCard label="Ciclo" value={BILLING_CYCLE_LABELS[subscription?.billing_cycle || 'monthly'] || 'Mensal'} />
              <InfoCard label="Limite de alunos" value={String(subscription?.student_limit ?? 1)} />
              <InfoCard label="Alunos ativos" value={String(activeStudents)} tone={typeof subscription?.student_limit === 'number' && activeStudents >= subscription.student_limit ? 'warning' : 'default'} />
              <InfoCard label="Próxima cobrança" value={subscription?.next_billing_at ? formatDate(subscription.next_billing_at) : '-'} />
            </div>

            {(subscription?.status === 'blocked' || subscription?.status === 'past_due') && (
              <div style={subscription?.status === 'blocked' ? blockedBannerStyle : pastDueBannerStyle}>
                <div style={{ fontWeight: 700 }}>
                  {subscription.status === 'blocked' ? 'Acesso temporariamente bloqueado' : 'Pagamento em atraso'}
                </div>
                <div style={{ fontSize: '0.92rem', lineHeight: 1.5 }}>
                  {subscription.status === 'blocked'
                    ? 'Enquanto o pagamento não for regularizado, o acesso às demais áreas do painel fica bloqueado. Seu Perfil do Personal continua liberado para acompanhar o plano e resolver a cobrança.'
                    : 'Seu acesso às demais áreas está restrito até a regularização do pagamento.'}
                </div>
              </div>
            )}

            {(subscription?.plan_slug || 'free') !== 'free' && (
              <div style={regularizationCardStyle}>
                <div style={{ fontWeight: 700, color: '#0f172a' }}>Metodo de pagamento cadastrado</div>

                <div style={{ display: 'grid', gap: 6 }}>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
                    {isAsaasSubscriptionFlow && hasSavedPaymentMethod
                      ? `Cartao salvo${savedPaymentMethod?.lastFour ? ` final ${savedPaymentMethod.lastFour}` : ''}`
                      : hasSavedPaymentMethod
                      ? `${formatSavedCardBrand(savedPaymentMethod?.brand)} final ${savedPaymentMethod?.lastFour || '****'}`
                      : 'Nenhum cartao cadastrado'}
                  </div>
                  <div style={{ fontSize: '0.9rem', color: '#475569' }}>
                    {isAsaasSubscriptionFlow
                      ? 'Ja existe um cartao salvo para as cobrancas recorrentes. Se precisar, voce pode trocar esse cartao por aqui.'
                      : hasSavedPaymentMethod
                      ? 'Esse cartao fica salvo para tentativas manuais agora e para as proximas renovacoes automaticas.'
                      : 'Cadastre um cartao para manter o metodo de pagamento salvo e liberar a renovacao automatica.'}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        setMsg('')
                        setError('')
                        await openCardForm('save-card')
                        setMsg(isAsaasSubscriptionFlow
                          ? 'Preencha o formulário abaixo para trocar o cartão salvo da sua assinatura.'
                          : hasSavedPaymentMethod
                            ? 'Preencha o formulário abaixo para trocar o cartão cadastrado.'
                            : 'Preencha o formulário abaixo para cadastrar um cartão no seu perfil.')
                      } catch (err: any) {
                        console.error(err)
                        setError(err.message || 'Não foi possível abrir o formulário do cartão.')
                      }
                    }}
                    disabled={paymentActionLoading !== null || removeSavedCardLoading}
                    style={paymentActionLoading !== null || removeSavedCardLoading ? disabledActionButtonStyle : actionButtonStyle}
                  >
                    {isAsaasSubscriptionFlow ? 'Trocar cartao' : hasSavedPaymentMethod ? 'Trocar cartao' : 'Cadastrar cartao'}
                  </button>

                  {hasSavedPaymentMethod && !isAsaasSubscriptionFlow && (
                    <button
                      type="button"
                      onClick={() => setRemoveSavedCardModalOpen(true)}
                      disabled={paymentActionLoading !== null || removeSavedCardLoading}
                      style={paymentActionLoading !== null || removeSavedCardLoading ? {
                        ...subtleDangerButtonStyle,
                        opacity: 0.7,
                        cursor: 'not-allowed',
                      } : subtleDangerButtonStyle}
                    >
                      Excluir cartao
                    </button>
                  )}
                </div>

                {showCardForm && cardFormMode === 'save-card' && (
                  isAsaasSubscriptionFlow ? (
                    <AsaasCardForm
                      payerName={name}
                      payerEmail={email}
                      payerPhone={phone}
                      loading={paymentActionLoading === 'card'}
                      title={hasSavedPaymentMethod ? 'Trocar cartao salvo' : 'Cadastrar cartao'}
                      submitLabel={hasSavedPaymentMethod ? 'Salvar novo cartao' : 'Salvar cartao'}
                      processingTitle="Salvando cartao..."
                      processingText="Aguarde um instante enquanto atualizamos o cartao da sua assinatura."
                      onSubmit={handleCardFormSubmit}
                      onCancel={() => {
                        if (paymentActionLoading !== 'card') {
                          setShowCardForm(false)
                          setCardFormMode(null)
                        }
                      }}
                    />
                  ) : mercadoPagoPublicKey ? (
                    <MercadoPagoCardForm
                      publicKey={mercadoPagoPublicKey}
                      amount={cardPaymentAmount}
                      payerEmail={email}
                      loading={paymentActionLoading === 'card'}
                      title={hasSavedPaymentMethod ? 'Trocar cartao cadastrado' : 'Cadastrar cartao'}
                      submitLabel={hasSavedPaymentMethod ? 'Salvar novo cartao' : 'Salvar cartao'}
                      showAmount={false}
                      processingTitle="Salvando cartao..."
                      processingText="Aguarde um instante enquanto validamos e salvamos o cartao no seu perfil."
                      onSubmit={handleCardFormSubmit}
                      onCancel={() => {
                        if (paymentActionLoading !== 'card') {
                          setShowCardForm(false)
                          setCardFormMode(null)
                        }
                      }}
                    />
                  ) : (
                    <div style={downgradeWarningStyle}>
                      Configure `VITE_MERCADO_PAGO_PUBLIC_KEY` no front para liberar o cadastro de cartão.
                    </div>
                  )
                )}
              </div>
            )}

            {needsRegularization && (
              <div style={regularizationCardStyle}>
                <div style={{ fontWeight: 700, color: '#0f172a' }}>Regularizacao do pagamento</div>

                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => handleGenerateRegularizationPayment('card-pay')} disabled={paymentActionLoading !== null || (isAsaasSubscriptionFlow && !hasSavedPaymentMethod)} style={paymentActionLoading !== null || (isAsaasSubscriptionFlow && !hasSavedPaymentMethod) ? disabledActionButtonStyle : actionButtonStyle}>
                    {isAsaasSubscriptionFlow ? (paymentActionLoading === 'card' ? 'Processando...' : 'Pagar com cartao salvo') : paymentActionLoading === 'card' ? 'Processando...' : hasSavedPaymentMethod ? (savedPaymentMethodValidated ? 'Pagar com cartao salvo' : 'Validar cartao salvo') : 'Pagar com cartao'}
                  </button>

                  <button type="button" onClick={() => handleGenerateRegularizationPayment('card-change')} disabled={paymentActionLoading !== null} style={paymentActionLoading !== null ? disabledActionButtonStyle : actionButtonStyle}>
                    {isAsaasSubscriptionFlow ? 'Trocar cartao' : paymentActionLoading === 'card' ? 'Processando...' : hasSavedPaymentMethod ? 'Trocar cartao salvo' : 'Cadastrar cartao'}
                  </button>

                  <button type="button" onClick={() => handleGenerateRegularizationPayment('pix')} disabled={paymentActionLoading !== null} style={paymentActionLoading !== null ? disabledActionButtonStyle : actionButtonStyle}>
                    {paymentActionLoading === 'pix' ? 'Gerando PIX...' : 'Gerar cobranca PIX'}
                  </button>

                  {canCopyPix && (
                    <button type="button" onClick={handleCopyPixCode} style={actionButtonStyle}>Copiar codigo PIX</button>
                  )}

                  <button
                    type="button"
                    onClick={handleCheckPaymentStatus}
                    disabled={paymentActionLoading !== null || !latestPayment}
                    style={paymentActionLoading !== null || !latestPayment ? disabledActionButtonStyle : actionButtonStyle}
                  >
                    {paymentActionLoading === 'check' ? 'Consultando...' : 'Checar pagamento'}
                  </button>
                </div>

                {error && (
                  <div style={inlineErrorStyle}>
                    {error}
                  </div>
                )}

                {msg && (
                  <div style={inlineSuccessStyle}>
                    {msg}
                  </div>
                )}

                {isAsaasSubscriptionFlow && (
                  <div style={downgradeWarningStyle}>
                    O pagamento com cartao salvo so tenta liquidar a cobranca vencida que ja existe, sem criar uma nova. Se o cartao expirou ou mudou, voce pode atualiza-lo aqui para as proximas cobrancas.
                  </div>
                )}

                {latestPayment ? (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                      <InfoCard label="Status da cobranca" value={getPaymentStatusLabel(latestPayment.status)} tone={latestPayment.status === 'failed' ? 'danger' : 'warning'} />
                      <InfoCard label="Valor" value={formatCurrency(latestPayment.amount, latestPayment.currency || 'BRL')} />
                      <InfoCard label="Vencimento" value={latestPayment.due_at ? formatDate(latestPayment.due_at) : '-'} />
                      <InfoCard label="Provedor" value={latestPayment.provider || '-'} />
                    </div>

                    {(latestPayment.description || latestPayment.provider_reference) && (
                      <div style={{ display: 'grid', gap: 6, fontSize: '0.9rem', color: '#475569' }}>
                        {latestPayment.description && <div><strong style={{ color: '#0f172a' }}>Descricao:</strong> {latestPayment.description}</div>}
                        {latestPayment.provider_reference && (
                          <div>
                            <strong style={{ color: '#0f172a' }}>Referencia:</strong>{' '}
                            {formatBillingReference(latestPayment.due_at || subscription?.next_billing_at || latestPayment.created_at)}
                          </div>
                        )}
                      </div>
                    )}

                    {paymentActionData.pixCode && (
                      <div style={{ display: 'grid', gap: 8 }}>
                        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>Codigo PIX</div>
                        <textarea
                          readOnly
                          value={paymentActionData.pixCode}
                          style={{
                            width: '100%',
                            minHeight: 88,
                            padding: 12,
                            borderRadius: 8,
                            border: '1px solid #cbd5e1',
                            resize: 'vertical',
                            fontFamily: 'monospace',
                            fontSize: '0.85rem',
                            background: '#fff',
                          }}
                        />
                        {copyPixMsg && <div style={{ fontSize: '0.85rem', color: '#166534', fontWeight: 600 }}>{copyPixMsg}</div>}
                      </div>
                    )}

                    {(paymentActionData.qrCodeBase64 || paymentActionData.ticketUrl) && (
                      <div style={{ display: 'grid', gap: 10 }}>
                        {paymentActionData.qrCodeBase64 && (
                          <div style={{ display: 'grid', gap: 8, justifyItems: 'start' }}>
                            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>QR Code PIX</div>
                            <img
                              src={buildQrCodeImageSource(paymentActionData.qrCodeBase64)}
                              alt="QR Code PIX"
                              style={{ width: 180, height: 180, borderRadius: 12, border: '1px solid #e2e8f0', background: '#fff', padding: 8 }}
                            />
                          </div>
                        )}

                        {paymentActionData.ticketUrl && (
                          <div>
                            <a href={paymentActionData.ticketUrl} target="_blank" rel="noreferrer" style={primaryLinkButtonStyle}>
                              Abrir PIX no navegador
                            </a>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                ) : null}

                {!isAsaasSubscriptionFlow && showCardForm && cardFormMode === 'regularization' && (
                  mercadoPagoPublicKey ? (
                    <MercadoPagoCardForm
                      publicKey={mercadoPagoPublicKey}
                      amount={cardPaymentAmount}
                      payerEmail={email}
                      loading={paymentActionLoading === 'card'}
                      onSubmit={handleCardFormSubmit}
                      onCancel={() => {
                        if (paymentActionLoading !== 'card') {
                          setShowCardForm(false)
                          setCardFormMode(null)
                        }
                      }}
                    />
                  ) : (
                    <div style={downgradeWarningStyle}>
                      Configure `VITE_MERCADO_PAGO_PUBLIC_KEY` no front para liberar o pagamento embutido com cartão.
                    </div>
                  )
                )}
              </div>
            )}

            {hasScheduledChange && (
              <div style={scheduledChangeBoxStyle}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ fontWeight: 700, color: '#0f172a' }}>Mudança agendada</div>
                  <button
                    type="button"
                    onClick={handleCancelScheduledChange}
                    disabled={cancelScheduledChangeLoading}
                    style={cancelScheduledChangeLoading ? disabledActionButtonStyle : actionButtonStyle}
                  >
                    {cancelScheduledChangeLoading ? 'Cancelando...' : 'Cancelar agendamento'}
                  </button>
                </div>
                <div style={{ fontSize: '0.92rem', color: '#475569' }}>
                  {isFreeCancellationScheduled
                    ? `Seu plano ${currentPlanLabel} continua ativo ate ${subscription?.scheduled_change_at ? formatDate(subscription.scheduled_change_at) : 'a próxima cobrança'}. Depois disso, sua assinatura será encerrada, o plano passará para Free e não haverá nova cobrança automática.`
                    : scheduledTargetBillingCycleLabel
                    ? `Seu plano ${currentPlanLabel} continuará no ciclo ${currentBillingCycleLabel} até ${subscription?.scheduled_change_at ? formatDate(subscription.scheduled_change_at) : 'a próxima cobrança'}. Depois disso, ele passará para o ciclo ${scheduledTargetBillingCycleLabel} e a nova cobrança será feita a partir dessa data.`
                    : `Seu plano será alterado para ${scheduledTargetPlanLabel} em ${subscription?.scheduled_change_at ? formatDate(subscription.scheduled_change_at) : 'data a confirmar'}.`}
                </div>
              </div>
            )}

            <div style={{ padding: 16, borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0', color: '#475569', display: 'grid', gap: 10 }}>
              <div style={{ fontWeight: 600, color: '#0f172a' }}>Trocar plano</div>
              <div style={{ fontSize: '0.9rem' }}>
                Seu plano atual é {currentPlanLabel}. Abra as opções abaixo para escolher se deseja fazer upgrade ou downgrade no próximo vencimento.
              </div>

              {hasScheduledChange && (
                <div style={{ fontSize: '0.9rem', color: '#1d4ed8' }}>
                  Existe uma mudança agendada. Se quiser escolher outro plano, primeiro cancele o agendamento atual.
                </div>
              )}

              {!canManagePlanChange && (
                <div style={{ fontSize: '0.9rem', color: '#475569' }}>
                  A troca de plano fica disponível quando você estiver em um plano pago.
                </div>
              )}

              {canSchedulePlanChange && (
                <button
                  type="button"
                  onClick={() => {
                    setShowPlanChangeOptions(current => !current)
                    if (showPlanChangeOptions) {
                      setPlanChangeMode(null)
                    }
                  }}
                  style={ghostButtonStyle}
                >
                  {showPlanChangeOptions ? 'Ocultar opções de plano' : 'Ver opções de plano'}
                </button>
              )}

              {canSchedulePlanChange && showPlanChangeOptions && (
                <div style={{ display: 'grid', gap: 12, padding: 16, borderRadius: 12, border: '1px solid #e2e8f0', background: '#fff' }}>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => setPlanChangeMode('downgrade')}
                      style={planChangeMode === 'downgrade' ? activeActionButtonStyle : actionButtonStyle}
                    >
                      Downgrade
                    </button>
                    <button
                      type="button"
                      onClick={() => setPlanChangeMode('upgrade')}
                      style={planChangeMode === 'upgrade' ? activeActionButtonStyle : actionButtonStyle}
                    >
                      Upgrade
                    </button>
                  </div>

                  {planChangeMode && !planChangeOptions.length && (
                    <div style={{ fontSize: '0.9rem', color: '#475569' }}>
                      Não existem opções de {planChangeMode} disponíveis para o seu plano atual.
                    </div>
                  )}

                  {planChangeMode && planChangeOptions.length > 0 && (
                    <>
                      <label style={{ display: 'grid', gap: 8 }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>
                          {planChangeMode === 'downgrade' ? 'Plano de downgrade' : 'Plano de upgrade'}
                        </span>
                        <select
                          value={selectedTargetPlan}
                          onChange={e => setSelectedTargetPlan(e.target.value)}
                          style={{ padding: 12, borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff' }}
                        >
                          {planChangeOptions.map(([plan, label]) => (
                            <option key={plan} value={plan}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>

                      {selectedTargetPlan && !isFreePlanSelection && (
                        <div style={{ fontSize: '0.9rem', color: '#475569' }}>
                          Seu plano será alterado de {currentPlanLabel} para {selectedTargetPlanLabel} somente após o fim do ciclo atual.
                        </div>
                      )}

                      {isFreePlanSelection && (
                        <div style={downgradeWarningStyle}>
                          Ao escolher o downgrade para Free, seu acesso pago continua normalmente ate {subscription?.next_billing_at ? formatDate(subscription.next_billing_at) : 'o fim do ciclo atual'}. Depois dessa data, a recorrencia e encerrada e nenhuma nova cobranca automatica deve ser gerada.
                        </div>
                      )}

                      <div style={downgradeWarningStyle}>
                        A mudança só será aplicada após o fim do ciclo atual, em {subscription?.next_billing_at ? formatDate(subscription.next_billing_at) : 'sua próxima cobrança'}.
                      </div>
                    </>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {canSchedulePlanChange && showPlanChangeOptions && planChangeMode && selectedTargetPlan && (
                  <button
                    type="button"
                    onClick={() => setPlanChangeModalOpen(true)}
                    disabled={planChangeLoading}
                    style={{
                      ...(isFreePlanSelection ? subtleDangerButtonStyle : actionButtonStyle),
                      opacity: planChangeLoading ? 0.7 : 1,
                      cursor: planChangeLoading ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {planChangeLoading
                      ? 'Agendando...'
                      : isFreePlanSelection
                      ? 'Confirmar downgrade para Free'
                      : `Confirmar ${planChangeMode}`}
                  </button>
                )}
              </div>
            </div>

            <div style={{ padding: 16, borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0', color: '#475569', display: 'grid', gap: 10 }}>
              <div style={{ fontWeight: 600, color: '#0f172a' }}>Trocar ciclo do plano</div>
              <div style={{ fontSize: '0.9rem' }}>
                Seu plano atual é {currentPlanLabel} no ciclo {currentBillingCycleLabel}. Escolha abaixo para qual dos outros ciclos você deseja migrar no próximo vencimento.
              </div>

              {hasScheduledChange && (
                <div style={{ fontSize: '0.9rem', color: '#1d4ed8' }}>
                  Existe uma mudança agendada. Se quiser escolher outro ciclo, primeiro cancele o agendamento atual.
                </div>
              )}

              {!canManageBillingCycle && (
                <div style={{ fontSize: '0.9rem', color: '#475569' }}>
                  A troca de ciclo fica disponível quando você estiver em um plano pago.
                </div>
              )}

              {canScheduleBillingCycleChange && billingCycleOptions.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowBillingCycleOptions(current => !current)}
                  style={ghostButtonStyle}
                >
                  {showBillingCycleOptions ? 'Ocultar opções de ciclo' : 'Ver opções de ciclo'}
                </button>
              )}

              {canScheduleBillingCycleChange && billingCycleOptions.length > 0 && showBillingCycleOptions && (
                <div style={{ display: 'grid', gap: 12, padding: 16, borderRadius: 12, border: '1px solid #e2e8f0', background: '#fff' }}>
                  <label style={{ display: 'grid', gap: 8 }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>Novo ciclo do plano</span>
                    <select
                      value={selectedBillingCycle || ''}
                      onChange={e => setSelectedBillingCycle(normalizeBillingCycle(e.target.value))}
                      style={{ padding: 12, borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff' }}
                    >
                      {billingCycleOptions.map(([cycle, label]) => (
                        <option key={cycle} value={cycle}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>

                  {selectedBillingCycleLabel && (
                    <div style={{ fontSize: '0.9rem', color: '#475569' }}>
                      Você continuará no plano {currentPlanLabel}. Apenas o ciclo será alterado de {currentBillingCycleLabel} para {selectedBillingCycleLabel}.
                    </div>
                  )}

                  <div style={downgradeWarningStyle}>
                    A nova cobrança só será feita após o fim do ciclo atual, em {subscription?.next_billing_at ? formatDate(subscription.next_billing_at) : 'sua próxima cobrança'}.
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {canScheduleBillingCycleChange && showBillingCycleOptions && (
                  <button
                    type="button"
                    onClick={() => setBillingCycleModalOpen(true)}
                    disabled={!selectedBillingCycle || billingCycleChangeLoading}
                    style={{
                      ...actionButtonStyle,
                      opacity: !selectedBillingCycle || billingCycleChangeLoading ? 0.7 : 1,
                      cursor: !selectedBillingCycle || billingCycleChangeLoading ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {billingCycleChangeLoading ? 'Agendando...' : 'Confirmar troca de ciclo'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {error && <div style={{ background: '#fef2f2', color: '#ef4444', padding: 16, borderRadius: 12, textAlign: 'center', fontWeight: 500 }}>{error}</div>}
        {msg && <div style={{ background: '#dcfce7', color: '#166534', padding: 16, borderRadius: 12, textAlign: 'center', fontWeight: 500 }}>{msg}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button 
            type="button"
            onClick={handleUpdateProfile}
            disabled={saving}
            style={{ 
              background: '#0f172a', color: '#fff', padding: '14px 32px', borderRadius: 8, border: 'none', 
              fontSize: '1rem', fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.7 : 1,
              boxShadow: '0 4px 6px -1px rgba(15, 23, 42, 0.1)'
            }}
          >
            {saving ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>

      </div>

      <ConfirmModal
        isOpen={billingCycleModalOpen}
        title="Confirmar troca de ciclo"
        description={selectedBillingCycleLabel
          ? `Você confirma a mudança do plano ${currentPlanLabel} do ciclo ${currentBillingCycleLabel} para ${selectedBillingCycleLabel}? Lembrando que essa mudança e a nova cobrança só serão aplicadas após o fim do ciclo atual, em ${subscription?.next_billing_at ? formatDate(subscription.next_billing_at) : 'sua próxima cobrança'}.`
          : 'Deseja confirmar a troca de ciclo do plano?'}
        cancelText="Não, manter ciclo atual"
        confirmText={billingCycleChangeLoading ? 'Agendando...' : 'Sim, agendar troca'}
        onCancel={() => {
          if (!billingCycleChangeLoading) setBillingCycleModalOpen(false)
        }}
        onConfirm={handleConfirmBillingCycleChange}
        stackActions
        cancelDisabled={billingCycleChangeLoading}
        confirmDisabled={billingCycleChangeLoading}
      />

      <ConfirmModal
        isOpen={removeSavedCardModalOpen}
        title="Excluir cartão cadastrado"
        description="Deseja mesmo excluir o cartão salvo do seu perfil? Você poderá cadastrar outro cartão quando quiser."
        cancelText="Manter cartão"
        confirmText={removeSavedCardLoading ? 'Excluindo...' : 'Sim, excluir cartão'}
        onCancel={() => {
          if (!removeSavedCardLoading) setRemoveSavedCardModalOpen(false)
        }}
        onConfirm={handleRemoveSavedCard}
        isDanger
        stackActions
        cancelDisabled={removeSavedCardLoading}
        confirmDisabled={removeSavedCardLoading}
      />

      <ConfirmModal
        isOpen={planChangeModalOpen}
        title={isFreePlanSelection ? 'Confirmar downgrade para Free' : 'Confirmar mudança de plano'}
        description={isFreePlanSelection
          ? `Você confirma o downgrade do plano ${currentPlanLabel} para Free? Seu acesso pago continua normalmente até ${subscription?.next_billing_at ? formatDate(subscription.next_billing_at) : 'o fim do ciclo atual'}. Depois dessa data, o plano vira Free e não deve haver nova cobrança automática.`
          : selectedTargetPlan
          ? `Você confirma a mudança do plano ${currentPlanLabel} para ${selectedTargetPlanLabel}? Lembrando que essa mudança só será aplicada após o fim do ciclo atual, em ${subscription?.next_billing_at ? formatDate(subscription.next_billing_at) : 'sua próxima cobrança'}.`
          : 'Deseja confirmar a mudança de plano?'}
        cancelText={isFreePlanSelection ? 'Manter assinatura' : 'Não, manter plano atual'}
        confirmText={planChangeLoading
          ? 'Agendando...'
          : isFreePlanSelection
          ? 'Sim, agendar downgrade'
          : 'Sim, agendar mudança'}
        onCancel={() => {
          if (!planChangeLoading) setPlanChangeModalOpen(false)
        }}
        onConfirm={handleConfirmPlanChange}
        isDanger={isFreePlanSelection}
        stackActions
        cancelDisabled={planChangeLoading}
        confirmDisabled={planChangeLoading}
      />
    </div>
  )
}

function InfoCard({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'warning' | 'danger' }) {
  const colors = tone === 'danger'
    ? { background: '#fef2f2', border: '#fecaca', color: '#991b1b' }
    : tone === 'warning'
      ? { background: '#fff7ed', border: '#fdba74', color: '#9a3412' }
      : { background: '#fff', border: '#e2e8f0', color: '#0f172a' }

  return (
    <div style={{ border: `1px solid ${colors.border}`, background: colors.background, borderRadius: 12, padding: 16 }}>
      <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: '1rem', fontWeight: 700, color: colors.color }}>{value}</div>
    </div>
  )
}

const ghostButtonStyle: CSSProperties = {
  padding: '6px 0',
  borderRadius: 8,
  border: 'none',
  background: 'transparent',
  color: '#64748b',
  fontWeight: 600,
  cursor: 'pointer',
  justifySelf: 'start',
}

const subtleDangerButtonStyle: CSSProperties = {
  padding: '10px 16px',
  borderRadius: 8,
  border: '1px solid #fecaca',
  background: '#fff5f5',
  color: '#b91c1c',
  fontWeight: 600,
}

const scheduledChangeBoxStyle: CSSProperties = {
  padding: 16,
  borderRadius: 12,
  background: '#eff6ff',
  border: '1px solid #bfdbfe',
  display: 'grid',
  gap: 8,
}

const downgradeWarningStyle: CSSProperties = {
  padding: 12,
  borderRadius: 10,
  background: '#fff7ed',
  border: '1px solid #fdba74',
  color: '#9a3412',
  fontWeight: 600,
}

const blockedBannerStyle: CSSProperties = {
  padding: 16,
  borderRadius: 12,
  background: '#fef2f2',
  border: '1px solid #fecaca',
  color: '#991b1b',
  display: 'grid',
  gap: 8,
}

const pastDueBannerStyle: CSSProperties = {
  padding: 16,
  borderRadius: 12,
  background: '#fff7ed',
  border: '1px solid #fdba74',
  color: '#9a3412',
  display: 'grid',
  gap: 8,
}

const regularizationCardStyle: CSSProperties = {
  padding: 16,
  borderRadius: 12,
  background: '#fff',
  border: '1px solid #e2e8f0',
  display: 'grid',
  gap: 16,
}

const inlineSuccessStyle: CSSProperties = {
  padding: 12,
  borderRadius: 10,
  background: '#dcfce7',
  border: '1px solid #86efac',
  color: '#166534',
  fontWeight: 600,
}

const inlineErrorStyle: CSSProperties = {
  padding: 12,
  borderRadius: 10,
  background: '#fef2f2',
  border: '1px solid #fecaca',
  color: '#b91c1c',
  fontWeight: 600,
}

const actionButtonStyle: CSSProperties = {
  padding: '10px 16px',
  borderRadius: 8,
  border: '1px solid #cbd5e1',
  background: '#fff',
  color: '#0f172a',
  fontWeight: 600,
  cursor: 'pointer',
}

const activeActionButtonStyle: CSSProperties = {
  ...actionButtonStyle,
  border: '1px solid #0f172a',
  background: '#0f172a',
  color: '#fff',
}

const disabledActionButtonStyle: CSSProperties = {
  ...actionButtonStyle,
  opacity: 0.7,
  cursor: 'not-allowed',
}

const primaryLinkButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '10px 16px',
  borderRadius: 8,
  background: '#0f172a',
  color: '#fff',
  fontWeight: 600,
  textDecoration: 'none',
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('pt-BR')
}

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
  }).format(value || 0)
}

function formatBillingReference(value?: string | null) {
  if (!value) return '-'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'

  return new Intl.DateTimeFormat('pt-BR', {
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

function formatSavedCardBrand(brand?: string | null) {
  if (!brand) return 'Cartao'

  const normalized = brand.trim().toLowerCase()
  if (normalized === 'visa') return 'Visa'
  if (normalized === 'master' || normalized === 'mastercard') return 'Mastercard'
  if (normalized === 'amex') return 'American Express'
  if (normalized === 'elo') return 'Elo'
  if (normalized === 'hipercard') return 'Hipercard'

  return brand.charAt(0).toUpperCase() + brand.slice(1)
}

function getPaymentStatusLabel(status: SubscriptionPaymentRow['status']) {
  if (status === 'approved') return 'Pago'
  if (status === 'failed') return 'Falhou'
  if (status === 'pending') return 'Pendente'
  if (status === 'canceled') return 'Cancelado'
  if (status === 'refunded') return 'Estornado'
  return status
}

function buildLegacySubscription(data: unknown): SubscriptionRow | null {
  if (!data || typeof data !== 'object') return null

  const saas = (data as { saas?: Record<string, unknown> }).saas
  if (!saas || typeof saas !== 'object') return null

  const planSlug = typeof saas.plan === 'string' ? saas.plan : 'free'
  const studentLimit = typeof saas.studentLimit === 'number'
    ? saas.studentLimit
    : typeof saas.studentLimit === 'string'
      ? Number(saas.studentLimit)
      : 1

  return {
    id: null,
    plan_slug: planSlug,
    student_limit: Number.isFinite(studentLimit) ? studentLimit : 1,
    billing_cycle: normalizeBillingCycle(saas.billingCycle),
    status: typeof saas.subscriptionStatus === 'string' ? saas.subscriptionStatus : (planSlug === 'free' ? 'free' : 'active'),
    amount: null,
    next_billing_at: typeof saas.nextBillingAt === 'string' ? saas.nextBillingAt : null,
    scheduled_plan_slug: null,
    scheduled_billing_cycle: null,
    scheduled_change_at: null,
  }
}

function extractSavedPaymentMethod(data: unknown): SavedPaymentMethod | null {
  if (!data || typeof data !== 'object') return null

  const paymentMethod = (data as { paymentMethod?: Record<string, unknown> }).paymentMethod
  if (!paymentMethod || typeof paymentMethod !== 'object') return null

  const provider = typeof paymentMethod.provider === 'string' && paymentMethod.provider === 'asaas' ? 'asaas' : 'mercadopago'
  const providerCustomerId = typeof paymentMethod.providerCustomerId === 'string' ? paymentMethod.providerCustomerId : ''
  const providerCardId = typeof paymentMethod.providerCardId === 'string' ? paymentMethod.providerCardId : ''
  const providerPaymentProfileId = typeof paymentMethod.providerPaymentProfileId === 'string'
    ? paymentMethod.providerPaymentProfileId
    : ''
  const providerPaymentMethodToken = typeof paymentMethod.providerPaymentMethodToken === 'string'
    ? paymentMethod.providerPaymentMethodToken
    : null
  const providerSubscriptionId = typeof paymentMethod.providerSubscriptionId === 'string'
    ? paymentMethod.providerSubscriptionId
    : null
  const brand = typeof paymentMethod.brand === 'string' ? paymentMethod.brand : null
  const lastFour = typeof paymentMethod.lastFour === 'string' ? paymentMethod.lastFour : null

  const hasReusableMethod = provider === 'asaas'
    ? Boolean(providerSubscriptionId || providerPaymentMethodToken || brand || lastFour)
    : Boolean(providerCardId || providerPaymentProfileId)

  if (!providerCustomerId || !hasReusableMethod) return null

  return {
    provider,
    providerCustomerId,
    providerCardId: providerCardId || null,
    providerPaymentProfileId: providerPaymentProfileId || null,
    providerPaymentMethodToken,
    providerSubscriptionId,
    paymentMethodId: typeof paymentMethod.paymentMethodId === 'string' ? paymentMethod.paymentMethodId : null,
    issuerId: typeof paymentMethod.issuerId === 'string' ? paymentMethod.issuerId : null,
    brand,
    lastFour,
    firstPaymentProviderPaymentId: typeof paymentMethod.firstPaymentProviderPaymentId === 'string' ? paymentMethod.firstPaymentProviderPaymentId : null,
    updatedAt: typeof paymentMethod.updatedAt === 'string' ? paymentMethod.updatedAt : null,
  }
}

function mapStoredPaymentMethod(row: StoredPaymentMethodRow | null | undefined): SavedPaymentMethod | null {
  if (!row) return null

  const provider = row.provider === 'asaas' ? 'asaas' : 'mercadopago'
  const providerCustomerId = typeof row.provider_customer_id === 'string' ? row.provider_customer_id : ''
  const providerCardId = typeof row.provider_card_id === 'string' ? row.provider_card_id : ''
  const providerPaymentProfileId = typeof row.provider_payment_profile_id === 'string'
    ? row.provider_payment_profile_id
    : ''
  const providerPaymentMethodToken = typeof row.provider_payment_method_token === 'string'
    ? row.provider_payment_method_token
    : null
  const providerSubscriptionId = typeof row.provider_subscription_id === 'string'
    ? row.provider_subscription_id
    : null
  const brand = typeof row.brand === 'string' ? row.brand : null
  const lastFour = typeof row.last_four === 'string' ? row.last_four : null

  const hasReusableMethod = provider === 'asaas'
    ? Boolean(providerSubscriptionId || providerPaymentMethodToken || brand || lastFour)
    : Boolean(providerCardId || providerPaymentProfileId)

  if (!providerCustomerId || !hasReusableMethod) return null

  return {
    provider,
    providerCustomerId,
    providerCardId: providerCardId || null,
    providerPaymentProfileId: providerPaymentProfileId || null,
    providerPaymentMethodToken,
    providerSubscriptionId,
    paymentMethodId: typeof row.payment_method_id === 'string' ? row.payment_method_id : null,
    issuerId: typeof row.issuer_id === 'string' ? row.issuer_id : null,
    brand,
    lastFour,
    firstPaymentProviderPaymentId: typeof row.first_payment_provider_payment_id === 'string' ? row.first_payment_provider_payment_id : null,
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : null,
  }
}

function resolveSavedPaymentMethod(data: unknown, row: StoredPaymentMethodRow | null | undefined) {
  return mapStoredPaymentMethod(row) || extractSavedPaymentMethod(data)
}

function normalizeBillingCycle(value: unknown): SubscriptionRow['billing_cycle'] {
  if (value === 'monthly' || value === 'quarterly' || value === 'yearly') {
    return value
  }

  return 'monthly'
}

function normalizeMoneyValue(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const normalized = Number(value.replace(',', '.'))
    if (Number.isFinite(normalized)) return normalized
  }
  return 0
}

function extractPaymentActionData(rawPayload: Record<string, unknown> | null | undefined) {
  const checkoutUrl = findNestedString(rawPayload, [
    'checkout_url',
    'checkoutUrl',
    'ticket_url',
    'ticketUrl',
    'invoice_url',
    'invoiceUrl',
    'init_point',
    'sandbox_init_point',
    'payment_url',
    'paymentUrl',
  ])

  const pixCode = findNestedString(rawPayload, [
    'pix_code',
    'pixCode',
    'qr_code',
    'qrCode',
    'qr_code_text',
    'qrCodeText',
    'payload',
    'copy_paste',
    'copyPaste',
  ])

  const qrCodeBase64 = findNestedString(rawPayload, [
    'qr_code_base64',
    'qrCodeBase64',
    'encodedImage',
  ])

  const ticketUrl = findNestedString(rawPayload, [
    'ticket_url',
    'ticketUrl',
    'invoice_url',
    'invoiceUrl',
    'bank_slip_url',
    'bankSlipUrl',
  ])

  return { checkoutUrl, pixCode, qrCodeBase64, ticketUrl }
}

function buildQrCodeImageSource(value: string) {
  return value.startsWith('data:image') ? value : `data:image/png;base64,${value}`
}

function findNestedString(value: unknown, keys: string[]): string | null {
  if (!value || typeof value !== 'object') return null

  const entries = Object.entries(value as Record<string, unknown>)

  for (const [entryKey, entryValue] of entries) {
    if (typeof entryValue === 'string' && keys.includes(entryKey)) {
      return entryValue
    }
  }

  for (const [, entryValue] of entries) {
    if (entryValue && typeof entryValue === 'object') {
      const nested = findNestedString(entryValue, keys)
      if (nested) return nested
    }
  }

  return null
}
