import { describe, expect, it } from 'vitest'
import { getCurrentBillingDueDate, normalizeDate } from './planBilling'

describe('planBilling', () => {
  it('preserves the same calendar day for date-only strings', () => {
    const normalized = normalizeDate('2026-08-24')

    expect(normalized.getFullYear()).toBe(2026)
    expect(normalized.getMonth()).toBe(7)
    expect(normalized.getDate()).toBe(24)
  })

  it('advances the next cycle from the paid charge due date', () => {
    const nextDueDate = getCurrentBillingDueDate(
      '2026-08-01',
      { billingCycleDays: 30 },
      '2026-08-31',
    )

    expect(nextDueDate?.getFullYear()).toBe(2026)
    expect(nextDueDate?.getMonth()).toBe(8)
    expect(nextDueDate?.getDate()).toBe(30)
  })
})
