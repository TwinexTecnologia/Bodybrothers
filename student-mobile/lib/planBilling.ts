export type LegacyPlanFrequency =
  | 'weekly'
  | 'monthly'
  | 'bimonthly'
  | 'quarterly'
  | 'semiannual'
  | 'annual'

type BillingPlanLike = {
  billingCycleDays?: number | null
  frequency?: string | null
}

const LEGACY_PLAN_DAYS: Record<LegacyPlanFrequency, number> = {
  weekly: 7,
  monthly: 30,
  bimonthly: 60,
  quarterly: 90,
  semiannual: 180,
  annual: 365,
}

export function legacyFrequencyToBillingDays(frequency?: string | null) {
  if (!frequency) return 30
  return LEGACY_PLAN_DAYS[frequency as LegacyPlanFrequency] || 30
}

export function getPlanBillingDays(plan?: BillingPlanLike | null) {
  const rawDays = Number(plan?.billingCycleDays)
  if (Number.isFinite(rawDays) && rawDays > 0) {
    return Math.floor(rawDays)
  }

  return legacyFrequencyToBillingDays(plan?.frequency)
}

export function getPlanBillingLabel(plan?: BillingPlanLike | null) {
  const days = getPlanBillingDays(plan)
  return days === 1 ? '1 dia' : `${days} dias`
}

export function getPlanPriceSuffix(plan?: BillingPlanLike | null) {
  return `/${getPlanBillingLabel(plan)}`
}

export function normalizeDate(dateValue: string | Date) {
  const date = new Date(dateValue)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function getCurrentBillingDueDate(
  planStartDate?: string | null,
  plan?: BillingPlanLike | null,
  lastPaymentDate?: string | null,
) {
  if (!planStartDate) return null

  if (!lastPaymentDate) {
    return normalizeDate(planStartDate)
  }

  const dueDate = normalizeDate(lastPaymentDate)
  dueDate.setDate(dueDate.getDate() + getPlanBillingDays(plan))
  return dueDate
}
