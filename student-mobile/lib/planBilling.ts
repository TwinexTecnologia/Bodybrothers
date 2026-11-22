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

function parseDateOnly(dateValue: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue.trim())
  if (!match) return null

  const [, year, month, day] = match
  return new Date(Number(year), Number(month) - 1, Number(day))
}

export function normalizeDate(dateValue: string | Date) {
  if (typeof dateValue === 'string') {
    const parsedDate = parseDateOnly(dateValue)
    if (parsedDate) return parsedDate
  }

  const date = new Date(dateValue)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function getCurrentBillingDueDate(
  planStartDate?: string | null,
  plan?: BillingPlanLike | null,
  lastChargeDueDate?: string | null,
) {
  if (!planStartDate) return null

  if (!lastChargeDueDate) {
    return normalizeDate(planStartDate)
  }

  const dueDate = normalizeDate(lastChargeDueDate)
  dueDate.setDate(dueDate.getDate() + getPlanBillingDays(plan))
  return dueDate
}
