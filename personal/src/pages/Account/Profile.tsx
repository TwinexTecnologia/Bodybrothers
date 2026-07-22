import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Camera, CheckCircle2, CircleAlert, CreditCard, Crown, Gift, ReceiptText, ShieldCheck, TrendingDown, TrendingUp, Users } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import AsaasCardForm, { type AsaasCardFormSubmitData, type AsaasCardHolderInfoDefaults } from '../../components/AsaasCardForm'
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
  plan_slug: string | null
  billing_cycle: 'monthly' | 'quarterly' | 'yearly' | null
  status: 'pending' | 'approved' | 'failed' | 'canceled' | 'refunded'
  amount: number
  currency: string | null
  provider: string | null
  provider_payment_id: string | null
  provider_reference: string | null
  description: string | null
  due_at: string | null
  paid_at: string | null
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
  raw_payload?: Record<string, unknown> | null
}

type CardChargeResponse = {
  approved: boolean
  status: SubscriptionPaymentRow['status']
  statusDetail: string | null
}

type EvolutionMode = 'anamnesis' | 'standalone'

type EvolutionFieldConfig = {
  id: string
  label: string
  exampleUrl?: string | null
}

const PLAN_LABELS: Record<string, string> = {
  free: 'Free',
  starter: 'Starter',
  premium: 'Premium',
  pro: 'Premium',
  elite: 'Premium',
  unlimited: 'Premium',
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

const EVOLUTION_SETTINGS_HASH = '#evolution-settings'

type CommercialPlan = 'free' | 'starter' | 'premium'

type PlanFeature = {
  title: string
  subtitle: string
  bullets: string[]
  accentColor: string
}

type BillingCycle = NonNullable<SubscriptionRow['billing_cycle']>

type PlanSelectionCycle = {
  cycle: BillingCycle
  label: string
  description: string
  amount: number
  perMonth: number
  savingsLabel: string | null
  highlightLabel: string | null
  isCurrent: boolean
  isSelectable: boolean
}

type PlanSelectionGroup = {
  plan: CommercialPlan
  title: string
  subtitle: string
  badge: string | null
  cycles: PlanSelectionCycle[]
}

const PLAN_PRICES: Record<CommercialPlan, Record<BillingCycle, number>> = {
  free: { monthly: 0, quarterly: 0, yearly: 0 },
  starter: { monthly: 9.9, quarterly: 24.9, yearly: 89.9 },
  premium: { monthly: 29.9, quarterly: 74.9, yearly: 249.9 },
}

const PLAN_FEATURES: Record<CommercialPlan, PlanFeature> = {
  free: {
    title: 'FitBody Free',
    subtitle: 'Plano gratuito',
    bullets: [
      'Acesso basico ao app',
      'Ate 1 aluno cadastrado',
      'Sem cobranca automatica',
    ],
    accentColor: '#64748b',
  },
  starter: {
    title: 'FitBody Starter',
    subtitle: 'Todos os acessos ate 5 alunos',
    bullets: [
      'Acesso completo ao app',
      'Ate 5 alunos cadastrados',
      'Relatorios avancados',
    ],
    accentColor: '#0f766e',
  },
  premium: {
    title: 'FitBody Premium',
    subtitle: 'Tudo ilimitado',
    bullets: [
      'Acesso completo ao app',
      'Alunos ilimitados',
      'Relatorios avancados',
      'Personalizacao completa',
    ],
    accentColor: '#7c3aed',
  },
}

export default function Profile() {
  const { refreshAuthState } = useAuth()
  const location = useLocation()
  const mercadoPagoPublicKey = import.meta.env.VITE_MERCADO_PAGO_PUBLIC_KEY || ''
  const evolutionSettingsRef = useRef<HTMLDivElement | null>(null)
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
  const [storedPaymentMethod, setStoredPaymentMethod] = useState<StoredPaymentMethodRow | null>(null)
  const [latestPayment, setLatestPayment] = useState<SubscriptionPaymentRow | null>(null)
  const [subscriptionPayments, setSubscriptionPayments] = useState<SubscriptionPaymentRow[]>([])
  const [activeStudents, setActiveStudents] = useState(0)
  const [selectedPlanChangeBillingCycle, setSelectedPlanChangeBillingCycle] = useState<SubscriptionRow['billing_cycle']>('monthly')
  const [showPlanChangeOptions, setShowPlanChangeOptions] = useState(false)
  const [showFinancialHistory, setShowFinancialHistory] = useState(false)
  const [planChangeMode, setPlanChangeMode] = useState<'downgrade' | 'upgrade' | null>(null)
  const [selectedTargetPlan, setSelectedTargetPlan] = useState('')
  const [planChangeModalOpen, setPlanChangeModalOpen] = useState(false)
  const [planChangeLoading, setPlanChangeLoading] = useState(false)
  const [cancelScheduledChangeLoading, setCancelScheduledChangeLoading] = useState(false)
  const [copyPixMsg, setCopyPixMsg] = useState('')
  const [paymentActionLoading, setPaymentActionLoading] = useState<'pix' | 'card' | 'check' | null>(null)
  const [showCardForm, setShowCardForm] = useState(false)
  const [cardFormMode, setCardFormMode] = useState<'regularization' | 'save-card' | null>(null)
  const [cardFormAmount, setCardFormAmount] = useState<number | null>(null)
  const [removeSavedCardModalOpen, setRemoveSavedCardModalOpen] = useState(false)
  const [removeSavedCardLoading, setRemoveSavedCardLoading] = useState(false)
  const [evolutionMode, setEvolutionMode] = useState<EvolutionMode>('anamnesis')
  const [evolutionFields, setEvolutionFields] = useState<EvolutionFieldConfig[]>([])
  const [newEvolutionFieldLabel, setNewEvolutionFieldLabel] = useState('')
  const [fieldReferenceFiles, setFieldReferenceFiles] = useState<Record<string, File | null>>({})
  const [highlightEvolutionSection, setHighlightEvolutionSection] = useState(false)

  // Dados de Senha
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const currentPlanRaw = subscription?.plan_slug || 'free'
  const currentPlan = normalizeCommercialPlan(currentPlanRaw)
  const currentBillingCycle = subscription?.billing_cycle || 'monthly'
  const scheduledTargetPlan = normalizeCommercialPlan(subscription?.scheduled_plan_slug || currentPlan)
  const scheduledTargetBillingCycle = subscription?.scheduled_billing_cycle || null
  const hasScheduledChange = Boolean(subscription?.scheduled_change_at && (subscription?.scheduled_plan_slug || subscription?.scheduled_billing_cycle))
  const canManagePlanChange = true
  const canSchedulePlanChange = canManagePlanChange && !hasScheduledChange
  const currentPlanLabel = PLAN_LABELS[currentPlan] || currentPlan
  const currentBillingCycleLabel = BILLING_CYCLE_LABELS[currentBillingCycle] || 'Mensal'
  const currentPlanAmount = getPlanAmount(currentPlan, currentBillingCycle)
  const currentPlanMonthlyLabel = currentPlan === 'free'
    ? 'Gratis'
    : formatCurrency(getMonthlyEquivalentAmount(currentPlanAmount, currentBillingCycle), 'BRL')
  const scheduledTargetPlanLabel = PLAN_LABELS[scheduledTargetPlan] || scheduledTargetPlan
  const scheduledTargetBillingCycleLabel = scheduledTargetBillingCycle
    ? BILLING_CYCLE_LABELS[scheduledTargetBillingCycle] || scheduledTargetBillingCycle
    : null
  const selectedTargetPlanLabel = PLAN_LABELS[selectedTargetPlan] || selectedTargetPlan
  const planChangeBillingCycle = selectedPlanChangeBillingCycle || currentBillingCycle
  const planChangeBillingCycleLabel = BILLING_CYCLE_LABELS[planChangeBillingCycle] || 'Mensal'
  const selectedTargetPlanAmount = selectedTargetPlan
    ? getPlanAmount(selectedTargetPlan as CommercialPlan, planChangeBillingCycle)
    : 0
  const selectedTargetPlanPriceLabel = formatPlanPrice(selectedTargetPlan as CommercialPlan | '', planChangeBillingCycle)
  const fallbackSavedPaymentMethod = useMemo(() => mapStoredPaymentMethod(storedPaymentMethod), [storedPaymentMethod])
  const savedCardBrandLabel = formatSavedCardBrand(savedPaymentMethod?.brand || fallbackSavedPaymentMethod?.brand || null)
  const savedCardLastFour = savedPaymentMethod?.lastFour || fallbackSavedPaymentMethod?.lastFour || null
  const planSelectionGroups = useMemo<PlanSelectionGroup[]>(() => {
    if (!planChangeMode) return []

    return getPlanGroupsForMode(currentPlan, planChangeMode)
      .map((plan) => {
        if (plan === 'free') {
          return {
            plan,
            title: PLAN_FEATURES.free.title,
            subtitle: 'Migrar para o plano gratuito no proximo vencimento',
            badge: null,
            cycles: [],
          }
        }

        const cycles = getVisibleCyclesForPlan({
          currentPlan,
          currentBillingCycle,
          targetPlan: plan,
        }).map((cycle) => ({
          cycle,
          label: BILLING_CYCLE_LABELS[cycle],
          description: getCycleDescription(cycle),
          amount: getPlanAmount(plan, cycle),
          perMonth: getMonthlyEquivalentAmount(getPlanAmount(plan, cycle), cycle),
          savingsLabel: getCycleSavingsLabel(plan, cycle),
          highlightLabel: getCycleHighlightLabel(plan, cycle),
          isCurrent: plan === currentPlan && cycle === currentBillingCycle,
          isSelectable: !(plan === currentPlan && cycle === currentBillingCycle),
        }))

        return {
          plan,
          title: PLAN_FEATURES[plan].title,
          subtitle: getPlanGroupSubtitle(plan, currentPlan),
          badge: getPlanGroupBadge(plan),
          cycles,
        }
      })
      .filter((group) => group.plan === 'free' || group.cycles.some((cycle) => cycle.isSelectable))
  }, [currentBillingCycle, currentPlan, planChangeMode])
  const selectablePlanChoices = useMemo(() => {
    return planSelectionGroups.flatMap((group) => {
      if (group.plan === 'free') {
        return [{ plan: 'free' as CommercialPlan, cycle: currentBillingCycle }]
      }

      return group.cycles
        .filter((cycle) => cycle.isSelectable)
        .map((cycle) => ({ plan: group.plan, cycle: cycle.cycle }))
    })
  }, [currentBillingCycle, planSelectionGroups])
  const isFreeCancellationScheduled = hasScheduledChange && scheduledTargetPlan === 'free'
  const isFreePlanSelection = planChangeMode === 'downgrade' && selectedTargetPlan === 'free'
  const paymentActionData = useMemo(() => extractPaymentActionData(latestPayment?.raw_payload), [latestPayment])
  const hasPixPaymentData = Boolean(paymentActionData.pixCode || paymentActionData.qrCodeBase64)
  const canCopyPix = Boolean(paymentActionData.pixCode)
  const needsRegularization = subscription?.status === 'blocked' || subscription?.status === 'past_due'
  const isAsaasSubscriptionFlow = savedPaymentMethod?.provider === 'asaas' || latestPayment?.provider === 'asaas'
  const asaasCardHolderDefaults = useMemo<AsaasCardHolderInfoDefaults>(() => {
    return extractAsaasCardHolderDefaults(storedPaymentMethod?.raw_payload, {
      name,
      email,
      phone,
    })
  }, [email, name, phone, storedPaymentMethod])
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
    if (!selectablePlanChoices.length) {
      setSelectedTargetPlan('')
      setSelectedPlanChangeBillingCycle(currentBillingCycle)
      return
    }

    const currentChoiceIsValid = selectablePlanChoices.some((choice) => (
      choice.plan === selectedTargetPlan && choice.cycle === selectedPlanChangeBillingCycle
    ))

    if (currentChoiceIsValid) return

    const defaultChoice = selectablePlanChoices.find((choice) => (
      choice.cycle === getRecommendedBillingCycle(choice.plan)
    )) || selectablePlanChoices[0]
    setSelectedTargetPlan(defaultChoice.plan)
    setSelectedPlanChangeBillingCycle(defaultChoice.cycle)
  }, [currentBillingCycle, selectablePlanChoices, selectedPlanChangeBillingCycle, selectedTargetPlan])

  useEffect(() => {
    if (!showPlanChangeOptions) {
      setPlanChangeMode(null)
      setSelectedTargetPlan('')
      setSelectedPlanChangeBillingCycle(currentBillingCycle)
    }
  }, [currentBillingCycle, showPlanChangeOptions])

  useEffect(() => {
    if (loading || location.hash !== EVOLUTION_SETTINGS_HASH) return

    setHighlightEvolutionSection(true)

    const scrollTimeout = window.setTimeout(() => {
      evolutionSettingsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 120)

    const highlightTimeout = window.setTimeout(() => {
      setHighlightEvolutionSection(false)
    }, 2600)

    return () => {
      window.clearTimeout(scrollTimeout)
      window.clearTimeout(highlightTimeout)
    }
  }, [loading, location.hash])

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
        const parsedEvolutionMode = normalizeEvolutionMode(profile.data?.config?.evolutionMode)
        const parsedEvolutionFields = parseEvolutionFields(profile.data?.config?.evolutionFields)
        setEvolutionMode(parsedEvolutionMode)
        setEvolutionFields(parsedEvolutionFields)
        setFieldReferenceFiles({})
      }

      const resolvedPersonalAccountId = typeof profile?.personal_id === 'string' && profile.personal_id
        ? profile.personal_id
        : user.id

      setPersonalAccountId(resolvedPersonalAccountId)

      const [paymentMethodResult, subscriptionResult, studentsResult] = await Promise.all([
        supabase
          .from('personal_payment_methods')
          .select('provider, provider_customer_id, provider_card_id, provider_payment_profile_id, provider_payment_method_token, provider_subscription_id, payment_method_id, issuer_id, brand, last_four, first_payment_provider_payment_id, updated_at, raw_payload')
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
      setStoredPaymentMethod(paymentMethodResult.data || null)

      const fallbackSubscription = buildLegacySubscription(profile?.data)
      const resolvedSubscription = subscriptionResult.data || fallbackSubscription

      setSubscription(resolvedSubscription)
      setSubscriptionAmount(normalizeMoneyValue(subscriptionResult.data?.amount))
      setActiveStudents((studentsResult.data || []).filter((student: any) => (student?.data?.status || 'ativo') !== 'inativo').length)

      if (subscriptionResult.data?.id) {
        const { data: paymentData, error: paymentsError } = await supabase
          .from('subscription_payments')
          .select('id, plan_slug, billing_cycle, status, amount, currency, provider, provider_payment_id, provider_reference, description, due_at, paid_at, created_at, raw_payload')
          .eq('subscription_id', subscriptionResult.data.id)
          .order('created_at', { ascending: false })
          .limit(50)

        if (paymentsError) {
          console.error('Erro ao carregar subscription_payments:', paymentsError)
        }

        const resolvedPayments = (paymentData || []) as SubscriptionPaymentRow[]
        setSubscriptionPayments(resolvedPayments)

        if (resolvedSubscription?.status === 'blocked' || resolvedSubscription?.status === 'past_due') {
          setLatestPayment(resolvedPayments.find((payment) => payment.status === 'pending' || payment.status === 'failed') || null)
        } else {
          setLatestPayment(null)
        }
      } else {
        setSubscriptionPayments([])
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
      const uploadedReferenceMap: Record<string, string | null> = {}

      for (const field of evolutionFields) {
        const referenceFile = fieldReferenceFiles[field.id]
        if (!referenceFile) continue

        const fileExt = referenceFile.name.split('.').pop()
        const filePath = `evolution-reference/${id}/${field.id}_${Date.now()}.${fileExt}`
        const { error: uploadError } = await supabase.storage
          .from('anamnesis-files')
          .upload(filePath, referenceFile, { upsert: true })

        if (uploadError) throw uploadError

        const { data: publicFile } = supabase.storage.from('anamnesis-files').getPublicUrl(filePath)
        uploadedReferenceMap[field.id] = publicFile.publicUrl
      }

      const sanitizedEvolutionFields = evolutionFields
        .map((field) => ({
          ...field,
          label: field.label.trim(),
          exampleUrl: uploadedReferenceMap[field.id] ?? field.exampleUrl ?? null,
        }))
        .filter((field) => field.label.length > 0)

      if (evolutionMode === 'standalone' && sanitizedEvolutionFields.length === 0) {
        throw new Error('Adicione pelo menos um campo para organizar a evolução fotográfica, como Frente, Costas ou Lado.')
      }

      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('data')
        .eq('id', id)
        .single()

      const currentData = currentProfile?.data && typeof currentProfile.data === 'object'
        ? currentProfile.data as Record<string, unknown>
        : {}
      const currentConfig = currentData.config && typeof currentData.config === 'object'
        ? currentData.config as Record<string, unknown>
        : {}

      const newData = {
        ...currentData,
        phone: phone,
        config: {
          ...currentConfig,
          evolutionMode,
          evolutionFields: sanitizedEvolutionFields,
        },
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
      setEvolutionFields(sanitizedEvolutionFields)
      setFieldReferenceFiles({})
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Erro ao atualizar perfil.')
    } finally {
      setSaving(false)
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
        targetBillingCycle: selectedPlanChangeBillingCycle || currentBillingCycle,
      })

      setPlanChangeModalOpen(false)
      setShowPlanChangeOptions(false)
      setPlanChangeMode(null)
      setMsg(
        response.targetPlan === 'free'
          ? `Cancelamento agendado com sucesso. Seu plano ${currentPlanLabel} continua ativo ate ${formatDate(response.effectiveAt)}. Depois disso, a assinatura vira Free e nenhuma nova cobranca sera gerada.`
          : `Mudança do plano ${currentPlanLabel} para ${PLAN_LABELS[response.targetPlan] || response.targetPlan} no ciclo ${BILLING_CYCLE_LABELS[response.targetBillingCycle] || response.targetBillingCycle} agendada para ${formatDate(response.effectiveAt)}. O novo plano entra em vigor somente nessa data.`,
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
      setMsg(response.pixCode || response.qrCodeBase64
        ? 'PIX gerado com sucesso. O QR Code e o codigo para copia ja estao disponiveis abaixo.'
        : 'Cobranca PIX gerada. Confira os dados abaixo.')
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

        <div
          id="evolution-settings"
          ref={evolutionSettingsRef}
          style={highlightEvolutionSection ? highlightedEvolutionSettingsCardStyle : evolutionSettingsCardStyle}
        >
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={evolutionSettingsIconStyle}>
                  <Camera size={18} color="#6D28D9" />
                </div>
                <div style={{ display: 'grid', gap: 4 }}>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>Configurar Evolução</h3>
                  <div style={{ fontSize: '0.92rem', color: '#64748b' }}>
                    Defina se a evolução usa fotos da anamnese ou fotos avulsas com campos personalizados.
                  </div>
                </div>
              </div>
              {location.hash === EVOLUTION_SETTINGS_HASH && (
                <span style={evolutionSettingsBadgeStyle}>Aberto a partir da central</span>
              )}
            </div>
          </div>
          <div style={{ padding: 24, display: 'grid', gap: 20 }}>
            <div style={evolutionInfoBoxStyle}>
              {evolutionMode === 'standalone'
                ? 'Cadastre os campos e uma imagem de referência para orientar o aluno no envio.'
                : 'A evolução segue o fluxo padrão já configurado para este personal.'}
            </div>

            {evolutionMode === 'standalone' && (
              <div style={{ display: 'grid', gap: 16 }}>
                <div style={{ display: 'grid', gap: 8 }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>Campos das fotos</span>
                  <div style={{ fontSize: '0.88rem', color: '#64748b' }}>
                    Escolha os nomes que vão orientar o envio e a organização das fotos de evolução.
                  </div>
                </div>

                {evolutionFields.length ? (
                  <div style={evolutionFieldListStyle}>
                    {evolutionFields.map((field) => (
                      <div key={field.id} style={evolutionFieldCardStyle}>
                        <div style={evolutionFieldItemStyle}>
                          <input
                            value={field.label}
                            onChange={(event) => {
                              const nextLabel = event.target.value
                              setEvolutionFields((current) => current.map((item) => (
                                item.id === field.id
                                  ? { ...item, label: nextLabel }
                                  : item
                              )))
                            }}
                            placeholder="Ex.: Frente"
                            style={evolutionFieldInputStyle}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setEvolutionFields((current) => current.filter((item) => item.id !== field.id))
                              setFieldReferenceFiles((current) => {
                                const next = { ...current }
                                delete next[field.id]
                                return next
                              })
                            }}
                            style={removeEvolutionFieldButtonStyle}
                          >
                            Remover
                          </button>
                        </div>

                        <div style={evolutionReferenceUploaderStyle}>
                          <div style={{ display: 'grid', gap: 6 }}>
                            <div style={{ fontSize: '0.86rem', fontWeight: 700, color: '#334155' }}>Imagem de referência</div>
                            <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
                              O aluno verá essa imagem como exemplo da pose ou ângulo correto.
                            </div>
                          </div>

                          <label style={evolutionReferenceBoxStyle}>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(event) => {
                                const nextFile = event.target.files?.[0] || null
                                setFieldReferenceFiles((current) => ({ ...current, [field.id]: nextFile }))
                              }}
                              style={{ display: 'none' }}
                            />

                            {fieldReferenceFiles[field.id] ? (
                              <div style={{ display: 'grid', gap: 8, justifyItems: 'center' }}>
                                <img
                                  src={URL.createObjectURL(fieldReferenceFiles[field.id] as File)}
                                  alt={`Prévia de ${field.label}`}
                                  style={evolutionReferencePreviewImageStyle}
                                />
                                <span style={evolutionReferenceHintStyle}>Nova referência pronta para salvar</span>
                              </div>
                            ) : field.exampleUrl ? (
                              <div style={{ display: 'grid', gap: 8, justifyItems: 'center' }}>
                                <img
                                  src={field.exampleUrl}
                                  alt={`Referência de ${field.label}`}
                                  style={evolutionReferencePreviewImageStyle}
                                />
                                <span style={evolutionReferenceHintStyle}>Clique para trocar a referência</span>
                              </div>
                            ) : (
                              <div style={{ display: 'grid', gap: 8, justifyItems: 'center' }}>
                                <Camera size={22} color="#6D28D9" />
                                <span style={evolutionReferenceHintStyle}>Adicionar imagem de referência</span>
                              </div>
                            )}
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={emptyEvolutionFieldsStyle}>
                    Nenhum campo configurado ainda. Adicione pelo menos um para liberar a organização das fotos avulsas.
                  </div>
                )}

                <div style={addEvolutionFieldWrapStyle}>
                  <input
                    value={newEvolutionFieldLabel}
                    onChange={(event) => setNewEvolutionFieldLabel(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter') return
                      event.preventDefault()
                      const trimmedLabel = newEvolutionFieldLabel.trim()
                      if (!trimmedLabel) return

                      setEvolutionFields((current) => [...current, createEvolutionField(trimmedLabel)])
                      setNewEvolutionFieldLabel('')
                    }}
                    placeholder="Adicionar campo, ex.: Frente"
                    style={addEvolutionFieldInputStyle}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const trimmedLabel = newEvolutionFieldLabel.trim()
                      if (!trimmedLabel) return

                      setEvolutionFields((current) => [...current, createEvolutionField(trimmedLabel)])
                      setNewEvolutionFieldLabel('')
                    }}
                    style={addEvolutionFieldButtonStyle}
                  >
                    Adicionar campo
                  </button>
                </div>

                <div style={evolutionExamplesTextStyle}>
                  Sugestões: Frente, Costas, Lado direito, Lado esquerdo, Posterior.
                </div>
              </div>
            )}
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

            <div style={financialHistoryToggleCardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={financialSectionIconStyle}>
                  <ReceiptText size={18} color="#6D28D9" />
                </div>
                <div style={{ display: 'grid', gap: 4 }}>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: '#111827' }}>Histórico de pagamento</div>
                  <div style={{ fontSize: '0.9rem', color: '#6B7280' }}>
                    Veja todas as cobranças da sua assinatura e o método usado em cada pagamento.
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowFinancialHistory((current) => !current)}
                style={showFinancialHistory ? secondaryFinancialButtonStyle : primaryFinancialButtonStyle}
              >
                {showFinancialHistory ? 'Ocultar histórico de pagamento' : 'Ver histórico de pagamento'}
              </button>
            </div>

            {showFinancialHistory && (
              <div style={financialHistoryCardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={financialSectionIconStyle}>
                      <ReceiptText size={18} color="#6D28D9" />
                    </div>
                    <div style={{ display: 'grid', gap: 4 }}>
                      <div style={{ fontSize: '1rem', fontWeight: 700, color: '#111827' }}>Histórico de pagamento</div>
                      <div style={{ fontSize: '0.9rem', color: '#6B7280' }}>
                        Acompanhe seus pagamentos, mensalidades e o tipo de cobrança da assinatura.
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#6B7280' }}>
                    {subscriptionPayments.length} {subscriptionPayments.length === 1 ? 'pagamento encontrado' : 'pagamentos encontrados'}
                  </div>
                </div>

                {subscriptionPayments.length ? (
                  <div style={financialTableWrapStyle}>
                    <table style={financialTableStyle}>
                      <thead>
                        <tr>
                          <th style={financialHeaderCellStyle}>Data</th>
                          <th style={financialHeaderCellStyle}>Fatura</th>
                          <th style={financialHeaderCellStyle}>Descricao</th>
                          <th style={financialHeaderCellStyle}>Tipo de cobranca</th>
                          <th style={financialHeaderCellStyle}>Ciclo</th>
                          <th style={financialHeaderCellStyle}>Valor</th>
                          <th style={financialHeaderCellStyle}>Metodo</th>
                          <th style={financialHeaderCellStyle}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {subscriptionPayments.map((payment) => (
                          <tr key={payment.id}>
                            <td style={financialBodyCellStyle}>{formatDate(payment.paid_at || payment.due_at || payment.created_at)}</td>
                            <td style={financialBodyCellStyle}>
                              <span style={invoiceReferenceStyle}>{formatPaymentInvoiceLabel(payment)}</span>
                            </td>
                            <td style={financialBodyCellStyle}>{formatPaymentLineDescription(payment)}</td>
                            <td style={financialBodyCellStyle}>{getPaymentChargeTypeLabel(payment)}</td>
                            <td style={financialBodyCellStyle}>{BILLING_CYCLE_LABELS[payment.billing_cycle || 'monthly'] || 'Mensal'}</td>
                            <td style={financialBodyCellStyle}>{formatCurrency(payment.amount, payment.currency || 'BRL')}</td>
                            <td style={financialBodyCellStyle}>{getPaymentMethodLabel(payment, savedPaymentMethod || fallbackSavedPaymentMethod)}</td>
                            <td style={financialBodyCellStyle}>
                              <span style={getPaymentStatusPillStyle(payment.status)}>{getPaymentStatusLabel(payment.status)}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={financialEmptyStateStyle}>
                    Ainda nao existem pagamentos registrados para esta assinatura.
                  </div>
                )}
              </div>
            )}

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
                      ? `${savedCardBrandLabel}${savedCardLastFour ? ` final ${savedCardLastFour}` : ''}`
                      : hasSavedPaymentMethod
                      ? `${savedCardBrandLabel} final ${savedCardLastFour || '****'}`
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

                {hasSavedPaymentMethod && (
                  <div style={savedCardPreviewStyle}>
                    <div style={savedCardBrandChipStyle}>
                      <CreditCard size={16} color="#6D28D9" />
                      {savedCardBrandLabel}
                    </div>
                    <div style={{ display: 'grid', gap: 4 }}>
                      <div style={{ fontSize: '0.96rem', fontWeight: 700, color: '#111827' }}>
                        {savedCardBrandLabel}{savedCardLastFour ? ` final ${savedCardLastFour}` : ''}
                      </div>
                      <div style={{ fontSize: '0.88rem', color: '#6B7280' }}>
                        Cartao salvo para as proximas cobrancas recorrentes.
                      </div>
                    </div>
                  </div>
                )}

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
                      savedHolderInfo={asaasCardHolderDefaults}
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

                    {hasPixPaymentData && (
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
                      </div>
                    )}

                    {hasPixPaymentData && (
                      <div style={pixGuidanceStyle}>
                        Esse PIX regulariza somente esta cobranca em atraso. A proxima renovacao continuara sendo tentada no cartao salvo da assinatura. Se esse cartao nao for mais utilizado, clique em `Trocar cartao` antes do proximo vencimento.
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

            <div style={planChangeSectionStyle}>
              <div style={{ display: 'grid', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={sectionIconWrapStyle}>
                    {planChangeMode === 'downgrade'
                      ? <TrendingDown size={18} color="#6D28D9" />
                      : <TrendingUp size={18} color="#6D28D9" />}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, color: '#111827', fontSize: '1.5rem' }}>Trocar plano</div>
                    <div style={{ fontSize: '0.95rem', color: '#6B7280' }}>
                      Altere seu plano ou ciclo. A mudança será aplicada após o fim do ciclo atual.
                    </div>
                  </div>
                </div>
              </div>

              {hasScheduledChange && (
                <div style={{ fontSize: '0.95rem', color: '#2563EB' }}>
                  Existe uma mudança agendada. Se quiser escolher outro plano, primeiro cancele o agendamento atual.
                </div>
              )}

              {canSchedulePlanChange && (
                <button
                  type="button"
                  onClick={() => {
                    setShowPlanChangeOptions(current => {
                      const next = !current
                      if (next && !planChangeMode) {
                        setPlanChangeMode('upgrade')
                      }
                      return next
                    })
                  }}
                  style={ghostButtonStyle}
                >
                  {showPlanChangeOptions ? 'Ocultar opções de plano' : 'Ver opções de plano'}
                </button>
              )}

              {canSchedulePlanChange && showPlanChangeOptions && (
                <div style={planBuilderWrapStyle}>
                  <div style={planModeTabsStyle}>
                    <button
                      type="button"
                      onClick={() => setPlanChangeMode('upgrade')}
                      style={planChangeMode === 'upgrade' ? activePlanTabStyle : planTabStyle}
                    >
                      <TrendingUp size={16} />
                      Upgrade
                    </button>
                    <button
                      type="button"
                      onClick={() => setPlanChangeMode('downgrade')}
                      style={planChangeMode === 'downgrade' ? activePlanTabStyle : planTabStyle}
                    >
                      <TrendingDown size={16} />
                      Downgrade
                    </button>
                  </div>

                  <div style={currentPlanHeroStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div style={currentPlanIconStyle}>
                        {renderPlanIcon(currentPlan)}
                      </div>
                      <div style={{ display: 'grid', gap: 4 }}>
                        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#6D28D9' }}>Seu plano atual</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#111827', lineHeight: 1 }}>{PLAN_FEATURES[currentPlan].title}</div>
                          <div style={currentCycleBadgeStyle}>{currentBillingCycleLabel}</div>
                        </div>
                        <div style={{ fontSize: '1rem', color: '#6B7280' }}>{getCurrentPlanDescriptor(currentPlan)}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', display: 'grid', gap: 6 }}>
                      <div style={{ fontSize: '2.5rem', fontWeight: 700, color: '#111827', lineHeight: 1 }}>
                        {currentPlan === 'free' ? 'Gratis' : currentPlanMonthlyLabel}
                        {currentPlan !== 'free' && <span style={{ fontSize: '1.1rem', fontWeight: 500, color: '#6B7280' }}> /mês</span>}
                      </div>
                      <div style={{ fontSize: '0.95rem', color: '#6B7280' }}>
                        Próximo vencimento: {subscription?.next_billing_at ? formatDate(subscription.next_billing_at) : '-'}
                      </div>
                    </div>
                  </div>

                  {planChangeMode && !planSelectionGroups.length && (
                    <div style={{ fontSize: '0.95rem', color: '#6B7280' }}>
                      Não existem opções de {planChangeMode} disponíveis para o seu plano atual.
                    </div>
                  )}

                  {planChangeMode && planSelectionGroups.length > 0 && (
                    <>
                      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>Escolha uma nova opção</div>

                      <div style={{ display: 'grid', gap: 18 }}>
                        {planSelectionGroups.map((group) => (
                          <div key={group.plan} style={planGroupCardStyle}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                              <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                                <div style={planGroupIconStyle}>
                                  {renderPlanIcon(group.plan)}
                                </div>
                                <div style={{ display: 'grid', gap: 4 }}>
                                  <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#111827' }}>{group.title}</div>
                                  <div style={{ fontSize: '0.95rem', color: '#6B7280' }}>{group.subtitle}</div>
                                </div>
                              </div>
                              {group.badge && <div style={group.plan === 'premium' ? recommendedBadgeStyle : cycleHighlightBadgeStyle}>{group.badge}</div>}
                            </div>

                            {group.plan === 'free' ? (
                              <div style={freePlanSelectionStyle}>
                                <div style={{ display: 'grid', gap: 8 }}>
                                  {PLAN_FEATURES.free.bullets.map((bullet) => (
                                    <div key={bullet} style={featureBulletStyle}>
                                      <Gift size={16} color="#6D28D9" />
                                      <span>{bullet}</span>
                                    </div>
                                  ))}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedTargetPlan('free')
                                    setSelectedPlanChangeBillingCycle(currentBillingCycle)
                                  }}
                                  style={selectedTargetPlan === 'free' ? selectedFreePlanButtonStyle : freePlanButtonStyle}
                                >
                                  {selectedTargetPlan === 'free' ? 'Downgrade selecionado' : 'Selecionar plano Free'}
                                </button>
                              </div>
                            ) : (
                              <div style={planCyclesGridStyle}>
                                {group.cycles.map((cycle) => {
                                  const isSelected = selectedTargetPlan === group.plan && planChangeBillingCycle === cycle.cycle
                                  return (
                                    <button
                                      key={`${group.plan}-${cycle.cycle}`}
                                      type="button"
                                      disabled={!cycle.isSelectable}
                                      onClick={() => {
                                        if (!cycle.isSelectable) return
                                        setSelectedTargetPlan(group.plan)
                                        setSelectedPlanChangeBillingCycle(cycle.cycle)
                                      }}
                                      style={{
                                        ...planCycleOptionStyle,
                                        ...(isSelected ? selectedPlanCycleOptionStyle : null),
                                        ...(cycle.isCurrent ? currentPlanCycleOptionStyle : null),
                                        opacity: cycle.isSelectable ? 1 : 0.82,
                                        cursor: cycle.isSelectable ? 'pointer' : 'default',
                                      }}
                                    >
                                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                                        {cycle.highlightLabel ? <div style={cycleHighlightBadgeStyle}>{cycle.highlightLabel}</div> : <span />}
                                        <div style={{ width: 20, height: 20, borderRadius: 999, border: `2px solid ${isSelected ? '#6D28D9' : '#D1D5DB'}`, display: 'grid', placeItems: 'center', background: isSelected ? '#6D28D9' : '#fff' }}>
                                          {isSelected && <div style={{ width: 8, height: 8, borderRadius: 999, background: '#fff' }} />}
                                        </div>
                                      </div>
                                      <div style={{ display: 'grid', gap: 6, textAlign: 'left' }}>
                                        <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#111827' }}>{cycle.label}</div>
                                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                                          <div style={priceValueStyle}>{formatCurrency(cycle.perMonth, 'BRL')}</div>
                                          <div style={priceSuffixStyle}>/mês</div>
                                        </div>
                                        <div style={{ fontSize: '0.95rem', color: '#6B7280' }}>
                                          {cycle.cycle === 'monthly'
                                            ? 'Cobrança mensal'
                                            : cycle.cycle === 'quarterly'
                                            ? `Cobrança de ${formatCurrency(cycle.amount, 'BRL')} a cada 3 meses`
                                            : `Cobrança anual de ${formatCurrency(cycle.amount, 'BRL')}`}
                                        </div>
                                        {cycle.savingsLabel && <div style={savingsBadgeStyle}>{cycle.savingsLabel}</div>}
                                        {cycle.isCurrent && <div style={currentPlanMiniBadgeStyle}>Plano atual</div>}
                                      </div>
                                    </button>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {isFreePlanSelection ? (
                        <div style={freeInfoBannerStyle}>
                          <CircleAlert size={18} />
                          <div>
                            Ao confirmar o downgrade para Free, seu acesso pago continua normalmente até {subscription?.next_billing_at ? formatDate(subscription.next_billing_at) : 'o fim do ciclo atual'}.
                          </div>
                        </div>
                      ) : (
                        <div style={planInfoBannerStyle}>
                          <CircleAlert size={18} />
                          <div>
                            A mudança será aplicada somente após o fim do ciclo atual.
                            {selectedTargetPlan && (
                              <div style={{ fontWeight: 600, color: '#6B7280' }}>
                                Seu novo plano entrará em vigor em {subscription?.next_billing_at ? formatDate(subscription.next_billing_at) : 'sua próxima cobrança'}.
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() => setPlanChangeModalOpen(true)}
                    disabled={!selectedTargetPlan || planChangeLoading}
                    style={(!selectedTargetPlan || planChangeLoading)
                      ? disabledPrimaryPlanButtonStyle
                      : primaryPlanButtonStyle}
                  >
                    <CheckCircle2 size={18} />
                    {planChangeLoading
                      ? 'Agendando...'
                      : isFreePlanSelection
                      ? 'Confirmar alteração'
                      : 'Confirmar alteração'}
                  </button>

                  <div style={securePaymentStyle}>
                    <ShieldCheck size={16} />
                    <span>Pagamento 100% seguro. Você pode cancelar quando quiser.</span>
                  </div>
                </div>
              )}
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
          ? `Você confirma a mudança do plano ${currentPlanLabel} para ${selectedTargetPlanLabel} no ciclo ${planChangeBillingCycleLabel}? A nova cobrança será de ${selectedTargetPlanPriceLabel} por ${planChangeBillingCycleLabel.toLowerCase()}, aplicada apenas após o fim do ciclo atual, em ${subscription?.next_billing_at ? formatDate(subscription.next_billing_at) : 'sua próxima cobrança'}.`
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

const evolutionSettingsCardStyle: CSSProperties = {
  background: '#fff',
  borderRadius: 16,
  border: '1px solid #e2e8f0',
  overflow: 'hidden',
  scrollMarginTop: 24,
}

const highlightedEvolutionSettingsCardStyle: CSSProperties = {
  ...evolutionSettingsCardStyle,
  border: '2px solid #7C3AED',
  boxShadow: '0 0 0 4px rgba(124, 58, 237, 0.12)',
}

const evolutionSettingsIconStyle: CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 12,
  background: '#F5F3FF',
  display: 'grid',
  placeItems: 'center',
}

const evolutionSettingsBadgeStyle: CSSProperties = {
  padding: '6px 12px',
  borderRadius: 999,
  background: '#F5F3FF',
  color: '#6D28D9',
  fontSize: '0.8rem',
  fontWeight: 700,
}

const evolutionInfoBoxStyle: CSSProperties = {
  padding: 14,
  borderRadius: 12,
  background: '#F8FAFC',
  border: '1px solid #E2E8F0',
  color: '#475569',
  lineHeight: 1.5,
}

const evolutionFieldListStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
}

const evolutionFieldCardStyle: CSSProperties = {
  display: 'grid',
  gap: 14,
  padding: 16,
  borderRadius: 16,
  border: '1px solid #E2E8F0',
  background: '#fff',
}

const evolutionFieldItemStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  gap: 12,
  alignItems: 'center',
}

const evolutionFieldInputStyle: CSSProperties = {
  padding: 12,
  borderRadius: 10,
  border: '1px solid #CBD5E1',
  fontSize: '0.95rem',
}

const removeEvolutionFieldButtonStyle: CSSProperties = {
  padding: '10px 14px',
  borderRadius: 10,
  border: '1px solid #FECACA',
  background: '#FFF5F5',
  color: '#B91C1C',
  fontWeight: 600,
  cursor: 'pointer',
}

const evolutionReferenceUploaderStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
}

const evolutionReferenceBoxStyle: CSSProperties = {
  display: 'grid',
  placeItems: 'center',
  minHeight: 180,
  padding: 16,
  borderRadius: 16,
  border: '2px dashed #D8B4FE',
  background: '#FAF5FF',
  cursor: 'pointer',
}

const evolutionReferencePreviewImageStyle: CSSProperties = {
  width: 140,
  height: 140,
  borderRadius: 14,
  objectFit: 'cover',
  border: '1px solid #E5E7EB',
}

const evolutionReferenceHintStyle: CSSProperties = {
  fontSize: '0.82rem',
  fontWeight: 600,
  color: '#6D28D9',
  textAlign: 'center',
}

const emptyEvolutionFieldsStyle: CSSProperties = {
  padding: 14,
  borderRadius: 12,
  background: '#EFF6FF',
  border: '1px solid #BFDBFE',
  color: '#1D4ED8',
  fontWeight: 600,
  lineHeight: 1.5,
}

const addEvolutionFieldWrapStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  gap: 12,
  alignItems: 'center',
}

const addEvolutionFieldInputStyle: CSSProperties = {
  padding: 12,
  borderRadius: 10,
  border: '1px solid #CBD5E1',
  fontSize: '0.95rem',
}

const addEvolutionFieldButtonStyle: CSSProperties = {
  padding: '12px 16px',
  borderRadius: 10,
  border: 'none',
  background: '#6D28D9',
  color: '#fff',
  fontWeight: 700,
  cursor: 'pointer',
}

const evolutionExamplesTextStyle: CSSProperties = {
  fontSize: '0.85rem',
  color: '#64748B',
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

const pixGuidanceStyle: CSSProperties = {
  padding: 12,
  borderRadius: 10,
  background: '#eff6ff',
  border: '1px solid #bfdbfe',
  color: '#1d4ed8',
  fontWeight: 600,
  lineHeight: 1.5,
}

const planChangeSectionStyle: CSSProperties = {
  padding: 24,
  borderRadius: 16,
  border: '1px solid #E5E7EB',
  background: '#FFFFFF',
  display: 'grid',
  gap: 20,
}

const sectionIconWrapStyle: CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 999,
  background: '#F5F3FF',
  display: 'grid',
  placeItems: 'center',
}

const planBuilderWrapStyle: CSSProperties = {
  display: 'grid',
  gap: 20,
}

const planModeTabsStyle: CSSProperties = {
  display: 'flex',
  gap: 12,
  flexWrap: 'wrap',
}

const planTabStyle: CSSProperties = {
  height: 44,
  padding: '0 18px',
  borderRadius: 12,
  border: '1px solid #E5E7EB',
  background: '#FFFFFF',
  color: '#374151',
  fontWeight: 600,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  cursor: 'pointer',
}

const activePlanTabStyle: CSSProperties = {
  ...planTabStyle,
  border: '1px solid #111827',
  background: '#111827',
  color: '#FFFFFF',
}

const currentPlanHeroStyle: CSSProperties = {
  padding: 24,
  borderRadius: 16,
  border: '1px solid #E5E7EB',
  background: '#FFFFFF',
  display: 'flex',
  justifyContent: 'space-between',
  gap: 20,
  alignItems: 'center',
  flexWrap: 'wrap',
}

const currentPlanIconStyle: CSSProperties = {
  width: 60,
  height: 60,
  borderRadius: 16,
  background: '#F5F3FF',
  display: 'grid',
  placeItems: 'center',
  color: '#6D28D9',
}

const currentCycleBadgeStyle: CSSProperties = {
  padding: '6px 12px',
  borderRadius: 999,
  background: '#F5F3FF',
  color: '#6D28D9',
  fontSize: '0.82rem',
  fontWeight: 700,
}

const planGroupCardStyle: CSSProperties = {
  padding: 24,
  borderRadius: 16,
  border: '1px solid #E5E7EB',
  background: '#FFFFFF',
  display: 'grid',
  gap: 18,
}

const planGroupIconStyle: CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: 12,
  background: '#F5F3FF',
  display: 'grid',
  placeItems: 'center',
  color: '#6D28D9',
}

const planCyclesGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 14,
}

const planCycleOptionStyle: CSSProperties = {
  minHeight: 180,
  padding: 18,
  borderRadius: 16,
  border: '1px solid #E5E7EB',
  background: '#FFFFFF',
  display: 'grid',
  gap: 12,
  textAlign: 'left',
  transition: '0.2s ease',
}

const selectedPlanCycleOptionStyle: CSSProperties = {
  border: '2px solid #6D28D9',
  background: '#FAF5FF',
  transform: 'translateY(-2px)',
}

const currentPlanCycleOptionStyle: CSSProperties = {
  background: '#F9FAFB',
}

const currentPlanMiniBadgeStyle: CSSProperties = {
  display: 'inline-flex',
  justifySelf: 'start',
  padding: '6px 12px',
  borderRadius: 999,
  background: '#F3F4F6',
  color: '#9CA3AF',
  fontSize: '0.78rem',
  fontWeight: 700,
}

const freePlanSelectionStyle: CSSProperties = {
  display: 'grid',
  gap: 16,
}

const featureBulletStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  color: '#374151',
  fontSize: '0.95rem',
}

const freePlanButtonStyle: CSSProperties = {
  height: 52,
  padding: '0 18px',
  borderRadius: 12,
  border: '1px solid #E5E7EB',
  background: '#FFFFFF',
  color: '#374151',
  fontWeight: 600,
  cursor: 'pointer',
}

const selectedFreePlanButtonStyle: CSSProperties = {
  ...freePlanButtonStyle,
  border: '2px solid #6D28D9',
  background: '#FAF5FF',
  color: '#6D28D9',
}

const priceValueStyle: CSSProperties = {
  fontSize: '2.1rem',
  fontWeight: 700,
  color: '#111827',
  lineHeight: 1,
}

const priceSuffixStyle: CSSProperties = {
  fontSize: '1.05rem',
  color: '#6B7280',
  fontWeight: 500,
}

const recommendedBadgeStyle: CSSProperties = {
  justifySelf: 'end',
  padding: '6px 12px',
  borderRadius: 999,
  background: '#F5F3FF',
  color: '#6D28D9',
  fontSize: '0.78rem',
  fontWeight: 700,
}

const cycleHighlightBadgeStyle: CSSProperties = {
  justifySelf: 'start',
  padding: '4px 10px',
  borderRadius: 999,
  background: '#F5F3FF',
  color: '#6D28D9',
  fontSize: '0.75rem',
  fontWeight: 700,
}

const savingsBadgeStyle: CSSProperties = {
  justifySelf: 'start',
  padding: '4px 10px',
  borderRadius: 999,
  background: '#DCFCE7',
  color: '#15803D',
  fontSize: '0.75rem',
  fontWeight: 700,
}

const planInfoBannerStyle: CSSProperties = {
  padding: 16,
  borderRadius: 16,
  border: '1px solid #E5E7EB',
  background: '#F5F3FF',
  color: '#374151',
  display: 'flex',
  gap: 12,
  alignItems: 'flex-start',
}

const freeInfoBannerStyle: CSSProperties = {
  padding: 16,
  borderRadius: 16,
  border: '1px solid #FCA5A5',
  background: '#FEF2F2',
  color: '#991B1B',
  display: 'flex',
  gap: 12,
  alignItems: 'flex-start',
}

const primaryPlanButtonStyle: CSSProperties = {
  height: 52,
  border: 'none',
  borderRadius: 12,
  background: '#6D28D9',
  color: '#FFFFFF',
  fontWeight: 600,
  fontSize: '1rem',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  cursor: 'pointer',
  boxShadow: '0 10px 24px rgba(109, 40, 217, 0.2)',
}

const disabledPrimaryPlanButtonStyle: CSSProperties = {
  ...primaryPlanButtonStyle,
  opacity: 0.7,
  cursor: 'not-allowed',
}

const securePaymentStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  gap: 8,
  color: '#6B7280',
  fontSize: '0.92rem',
}

const financialHistoryCardStyle: CSSProperties = {
  display: 'grid',
  gap: 16,
  borderRadius: 16,
  border: '1px solid #E5E7EB',
  background: '#FFFFFF',
  padding: 20,
}

const financialHistoryToggleCardStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 16,
  flexWrap: 'wrap',
  borderRadius: 16,
  border: '1px solid #E5E7EB',
  background: '#FFFFFF',
  padding: 20,
}

const financialSectionIconStyle: CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 12,
  background: '#F5F3FF',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const primaryFinancialButtonStyle: CSSProperties = {
  minHeight: 46,
  padding: '0 18px',
  border: 'none',
  borderRadius: 12,
  background: '#6D28D9',
  color: '#FFFFFF',
  fontWeight: 700,
  fontSize: '0.95rem',
  cursor: 'pointer',
  boxShadow: '0 10px 24px rgba(109, 40, 217, 0.18)',
}

const secondaryFinancialButtonStyle: CSSProperties = {
  minHeight: 46,
  padding: '0 18px',
  border: '1px solid #DDD6FE',
  borderRadius: 12,
  background: '#F5F3FF',
  color: '#6D28D9',
  fontWeight: 700,
  fontSize: '0.95rem',
  cursor: 'pointer',
}

const financialTableWrapStyle: CSSProperties = {
  width: '100%',
  overflowX: 'auto',
  borderRadius: 14,
  border: '1px solid #E5E7EB',
}

const financialTableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  minWidth: 920,
  background: '#FFFFFF',
}

const financialHeaderCellStyle: CSSProperties = {
  textAlign: 'left',
  padding: '14px 16px',
  fontSize: '0.8rem',
  fontWeight: 700,
  color: '#6B7280',
  background: '#F9FAFB',
  borderBottom: '1px solid #E5E7EB',
  whiteSpace: 'nowrap',
}

const financialBodyCellStyle: CSSProperties = {
  padding: '14px 16px',
  fontSize: '0.9rem',
  color: '#374151',
  borderBottom: '1px solid #F3F4F6',
  verticalAlign: 'middle',
}

const financialEmptyStateStyle: CSSProperties = {
  borderRadius: 14,
  border: '1px dashed #D1D5DB',
  background: '#F9FAFB',
  padding: 18,
  fontSize: '0.92rem',
  color: '#6B7280',
}

const savedCardPreviewStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 14,
  flexWrap: 'wrap',
  borderRadius: 14,
  border: '1px solid #E5E7EB',
  background: '#F9FAFB',
  padding: 16,
}

const savedCardBrandChipStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 12px',
  borderRadius: 12,
  background: '#F5F3FF',
  color: '#6D28D9',
  fontWeight: 700,
  fontSize: '0.9rem',
}

const invoiceReferenceStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '6px 10px',
  borderRadius: 999,
  background: '#F5F3FF',
  color: '#6D28D9',
  fontWeight: 600,
  fontSize: '0.82rem',
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('pt-BR')
}

function normalizeCommercialPlan(value: string | null | undefined) {
  if (value === 'starter') return 'starter'
  if (value === 'premium' || value === 'pro' || value === 'elite' || value === 'unlimited') return 'premium'
  return 'free'
}

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
  }).format(value || 0)
}

function getBillingCycleMultiplier(value: string) {
  if (value === 'quarterly') return 3
  if (value === 'yearly') return 12
  return 1
}

function getPlanAmount(planSlug: CommercialPlan, billingCycle: string) {
  const normalizedCycle = normalizeBillingCycle(billingCycle) || 'monthly'
  const planPricing = PLAN_PRICES[planSlug]
  return Number((planPricing?.[normalizedCycle] || 0).toFixed(2))
}

function getMonthlyEquivalentAmount(totalAmount: number, billingCycle: string) {
  return Number((totalAmount / getBillingCycleMultiplier(billingCycle)).toFixed(2))
}

function getCycleDescription(billingCycle: string) {
  if (billingCycle === 'quarterly') return 'Cobranca a cada 3 meses'
  if (billingCycle === 'yearly') return 'Cobranca anual'
  return 'Cobranca mensal'
}

function getCycleSavingsLabel(planSlug: CommercialPlan, billingCycle: string) {
  if (planSlug === 'free' || billingCycle === 'monthly') return null

  const monthlyTotal = getPlanAmount(planSlug, 'monthly') * getBillingCycleMultiplier(billingCycle)
  const selectedTotal = getPlanAmount(planSlug, billingCycle)
  if (monthlyTotal <= 0 || selectedTotal >= monthlyTotal) return null

  const savingsPercent = Math.floor(((monthlyTotal - selectedTotal) / monthlyTotal) * 100)
  return savingsPercent > 0 ? `Economize ${savingsPercent}%` : null
}

function getCycleHighlightLabel(planSlug: CommercialPlan, billingCycle: string) {
  if (billingCycle !== 'yearly') return null
  return planSlug === 'premium' ? 'Mais popular' : 'Mais economico'
}

function getRecommendedBillingCycle(planSlug: CommercialPlan): BillingCycle {
  if (planSlug === 'premium') return 'yearly'
  if (planSlug === 'starter') return 'yearly'
  return 'monthly'
}

function getPlanGroupsForMode(currentPlan: CommercialPlan, mode: 'downgrade' | 'upgrade') {
  if (mode === 'upgrade') {
    if (currentPlan === 'free') return ['starter', 'premium'] as CommercialPlan[]
    if (currentPlan === 'starter') return ['starter', 'premium'] as CommercialPlan[]
    if (currentPlan === 'premium') return ['premium'] as CommercialPlan[]
  }

  if (mode === 'downgrade') {
    if (currentPlan === 'starter') return ['free'] as CommercialPlan[]
    if (currentPlan === 'premium') return ['starter', 'free'] as CommercialPlan[]
  }

  return [] as CommercialPlan[]
}

function getVisibleCyclesForPlan({
  currentPlan,
  currentBillingCycle,
  targetPlan,
}: {
  currentPlan: CommercialPlan
  currentBillingCycle: BillingCycle
  targetPlan: CommercialPlan
}) {
  const cycles: BillingCycle[] = ['monthly', 'quarterly', 'yearly']

  if (targetPlan !== currentPlan) return cycles

  return cycles.filter((cycle) => getBillingCycleMultiplier(cycle) >= getBillingCycleMultiplier(currentBillingCycle))
}

function getPlanGroupSubtitle(plan: CommercialPlan, currentPlan: CommercialPlan) {
  if (plan === currentPlan && plan === 'starter') return 'Continue no Starter e economize'
  if (plan === currentPlan && plan === 'premium') return 'Continue no Premium e economize mais'
  if (plan === 'premium') return 'Mais recursos, alunos ilimitados e relatorios avancados'
  if (plan === 'starter') return 'Todos os acessos ate 5 alunos'
  return 'Plano gratuito sem cobranca automatica'
}

function getPlanGroupBadge(plan: CommercialPlan) {
  if (plan === 'premium') return 'Recomendado'
  return null
}

function getCurrentPlanDescriptor(plan: CommercialPlan) {
  if (plan === 'starter') return 'Ate 5 alunos'
  if (plan === 'premium') return 'Alunos ilimitados'
  return 'Ate 1 aluno'
}

function renderPlanIcon(plan: CommercialPlan) {
  if (plan === 'premium') return <Crown size={24} />
  if (plan === 'starter') return <Users size={24} />
  return <Gift size={24} />
}

function formatPlanPrice(planSlug: CommercialPlan | '', billingCycle: string) {
  if (!planSlug || planSlug === 'free') {
    return 'Gratis'
  }

  return formatCurrency(getPlanAmount(planSlug, billingCycle), 'BRL')
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

function getPaymentStatusPillStyle(status: SubscriptionPaymentRow['status']): CSSProperties {
  if (status === 'approved') {
    return {
      display: 'inline-flex',
      alignItems: 'center',
      padding: '6px 10px',
      borderRadius: 999,
      background: '#DCFCE7',
      color: '#15803D',
      fontWeight: 700,
      fontSize: '0.82rem',
      whiteSpace: 'nowrap',
    }
  }

  if (status === 'pending') {
    return {
      display: 'inline-flex',
      alignItems: 'center',
      padding: '6px 10px',
      borderRadius: 999,
      background: '#FEF3C7',
      color: '#B45309',
      fontWeight: 700,
      fontSize: '0.82rem',
      whiteSpace: 'nowrap',
    }
  }

  return {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '6px 10px',
    borderRadius: 999,
    background: '#FEE2E2',
    color: '#B91C1C',
    fontWeight: 700,
    fontSize: '0.82rem',
    whiteSpace: 'nowrap',
  }
}

function formatPaymentInvoiceLabel(payment: SubscriptionPaymentRow) {
  const explicitInvoice = findNestedString(payment.raw_payload, [
    'invoiceNumber',
    'invoice_number',
    'invoiceId',
    'invoice_id',
    'invoice',
  ])

  if (explicitInvoice) return explicitInvoice
  if (payment.provider_reference) return payment.provider_reference
  if (payment.provider_payment_id) return payment.provider_payment_id
  return `PAG-${payment.id.slice(0, 8).toUpperCase()}`
}

function formatPaymentLineDescription(payment: SubscriptionPaymentRow) {
  if (payment.description) return payment.description

  const plan = normalizeCommercialPlan(payment.plan_slug)
  if (plan === 'starter') return 'FitBody Starter'
  if (plan === 'premium') return 'FitBody Premium'
  return 'FitBody Free'
}

function getPaymentChargeTypeLabel(payment: SubscriptionPaymentRow) {
  const description = (payment.description || '').toLowerCase()

  if (description.includes('renovacao')) return 'Assinatura recorrente'
  if (description.includes('regularizacao')) return 'Regularizacao'
  if (normalizeCommercialPlan(payment.plan_slug) === 'free') return 'Plano gratuito'
  return 'Cobranca da assinatura'
}

function getPaymentMethodLabel(payment: SubscriptionPaymentRow, fallbackSavedMethod?: SavedPaymentMethod | null) {
  const paymentActionData = extractPaymentActionData(payment.raw_payload)
  if (paymentActionData.pixCode || paymentActionData.qrCodeBase64) return 'PIX'

  const billingType = (findNestedString(payment.raw_payload, ['billingType', 'billing_type']) || '').toUpperCase()
  if (billingType === 'PIX') return 'PIX'

  const rawBrand = findNestedString(payment.raw_payload, [
    'brand',
    'cardBrand',
    'payment_method_id',
    'paymentMethodId',
  ])
  const rawLastFour = findNestedString(payment.raw_payload, [
    'last4',
    'last_four',
    'lastDigits',
    'creditCardNumber',
    'creditCardLastFour',
    'creditCardLast4',
    'creditCardLastDigits',
    'lastDigitsCard',
    'creditCardNumber',
  ])

  if (rawBrand && rawLastFour) {
    return `${formatSavedCardBrand(rawBrand)} final ${rawLastFour.slice(-4)}`
  }

  if (billingType === 'CREDIT_CARD' || payment.provider === 'mercadopago' || payment.provider === 'asaas') {
    if (fallbackSavedMethod?.brand && fallbackSavedMethod?.lastFour) {
      return `${formatSavedCardBrand(fallbackSavedMethod.brand)} final ${fallbackSavedMethod.lastFour}`
    }

    if (fallbackSavedMethod?.brand) {
      return formatSavedCardBrand(fallbackSavedMethod.brand)
    }

    return 'Cartao'
  }

  if (payment.provider) {
    return payment.provider.toUpperCase()
  }

  return '-'
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

function normalizeEvolutionMode(value: unknown): EvolutionMode {
  return value === 'standalone' ? 'standalone' : 'anamnesis'
}

function parseEvolutionFields(value: unknown): EvolutionFieldConfig[] {
  if (!Array.isArray(value)) return []

  return value
    .map((item) => {
      if (typeof item === 'string') {
        const trimmed = item.trim()
        return trimmed ? createEvolutionField(trimmed) : null
      }

      if (item && typeof item === 'object') {
        const rawLabel = 'label' in item ? String(item.label ?? '').trim() : 'name' in item ? String(item.name ?? '').trim() : ''
        if (!rawLabel) return null
        const rawId = 'id' in item ? String(item.id ?? '').trim() : ''
        const rawExampleUrl = 'exampleUrl' in item ? String(item.exampleUrl ?? '').trim() : ''
        return {
          id: rawId || createEvolutionField(rawLabel).id,
          label: rawLabel,
          exampleUrl: rawExampleUrl || null,
        }
      }

      return null
    })
    .filter((item): item is EvolutionFieldConfig => Boolean(item))
}

function createEvolutionField(label: string): EvolutionFieldConfig {
  return {
    id: `field_${Math.random().toString(36).slice(2, 10)}`,
    label,
  }
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

function extractAsaasCardHolderDefaults(
  rawPayload: Record<string, unknown> | null | undefined,
  fallback: { name?: string | null; email?: string | null; phone?: string | null },
): AsaasCardHolderInfoDefaults {
  return {
    name: findNestedString(rawPayload, ['name']) || fallback.name || '',
    email: findNestedString(rawPayload, ['email']) || fallback.email || '',
    cpfCnpj: findNestedString(rawPayload, ['cpfCnpj', 'cpf_cnpj', 'document']) || '',
    postalCode: findNestedString(rawPayload, ['postalCode', 'postal_code', 'zipCode']) || '',
    addressNumber: findNestedString(rawPayload, ['addressNumber', 'address_number']) || '',
    addressComplement: findNestedString(rawPayload, ['addressComplement', 'address_complement', 'complement']) || '',
    phone: findNestedString(rawPayload, ['phone']) || fallback.phone || '',
    mobilePhone: findNestedString(rawPayload, ['mobilePhone', 'mobile_phone']) || fallback.phone || '',
  }
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
