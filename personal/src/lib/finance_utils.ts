import type { PlanRecord } from '../store/plans'
import type { StudentRecord } from '../store/students'
import type { DebitRecord } from '../store/financial'
import { getCurrentBillingDueDate, getPlanBillingDays, normalizeDate } from './planBilling'

export function generateExpectedCharges(
    student: StudentRecord, 
    plan: PlanRecord, 
    untilDate: Date = new Date()
): Date[] {
    if (!student.planStartDate || !plan) return []

    const charges: Date[] = []
    const startDate = normalizeDate(student.planStartDate)
    const billingDays = getPlanBillingDays(plan)
    const endLimit = normalizeDate(untilDate)

    let current = new Date(startDate)
    let loopCount = 0

    while (current <= endLimit && loopCount < 200) {
      loopCount++
      charges.push(new Date(current))
      current.setDate(current.getDate() + billingDays)
    }

    return charges
}

export function isStudentOverdue(
    student: StudentRecord, 
    plan: PlanRecord, 
    payments: DebitRecord[]
): boolean {
    const sortedPayments = paymentsToChronological(payments)
    const lastPayment = sortedPayments[sortedPayments.length - 1]
    const dueDate = getCurrentBillingDueDate(
      student.planStartDate,
      plan,
      lastPayment ? (lastPayment.paidAt || lastPayment.dueDate) : null,
    )

    if (!dueDate) return false

    const today = normalizeDate(new Date())
    return dueDate < today
}

function paymentsToChronological(payments: DebitRecord[]) {
  return [...payments].sort((a, b) => {
    const aTime = new Date(a.paidAt || a.dueDate).getTime()
    const bTime = new Date(b.paidAt || b.dueDate).getTime()
    return aTime - bTime
  })
}
