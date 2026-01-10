export type DebitStatus = 'pendente' | 'pago' | 'atrasado'

export type PaymentMethod = 'pix' | 'cartao' | 'dinheiro'

export type DebitRecord = {
  id: string
  personalId: string
  amount: number
  description?: string
  dueDate: string
  status: DebitStatus
  createdAt: string
  paidAt?: string
  paymentMethod?: PaymentMethod
  paymentNote?: string
}

const KEY = 'owner_billing_debits'

function readAll(): DebitRecord[] {
  const raw = localStorage.getItem(KEY)
  if (!raw) return []
  try {
    const arr = JSON.parse(raw) as DebitRecord[]
    return Array.isArray(arr) ? arr : []
  } catch {
    localStorage.removeItem(KEY)
    return []
  }
}

function writeAll(arr: DebitRecord[]) {
  localStorage.setItem(KEY, JSON.stringify(arr))
}

function computeStatus(rec: DebitRecord): DebitStatus {
  if (rec.paidAt) return 'pago'
  const due = new Date(rec.dueDate)
  const today = new Date(); today.setHours(0,0,0,0)
  return due < today ? 'atrasado' : 'pendente'
}

export function listDebits(): DebitRecord[] {
  return readAll().map(r => ({ ...r, status: computeStatus(r) }))
}

export function listDebitsByPersonal(personalId: string): DebitRecord[] {
  return listDebits().filter(d => d.personalId === personalId)
}

export function addDebit(d: { personalId: string; amount: number; description?: string; dueDate: string }): DebitRecord {
  const id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now())
  const rec: DebitRecord = {
    id,
    personalId: d.personalId,
    amount: d.amount,
    description: d.description,
    dueDate: d.dueDate,
    status: 'pendente',
    createdAt: new Date().toISOString(),
  }
  const arr = readAll()
  arr.push(rec)
  writeAll(arr)
  return rec
}

export function recordPayment(id: string, method?: PaymentMethod, note?: string): DebitRecord | undefined {
  const arr = readAll()
  const idx = arr.findIndex(x => x.id === id)
  if (idx === -1) return undefined
  const next: DebitRecord = { ...arr[idx], paidAt: new Date().toISOString(), status: 'pago', paymentMethod: method, paymentNote: note }
  arr[idx] = next
  writeAll(arr)
  return next
}

export function listPaymentsByPersonal(personalId: string): DebitRecord[] {
  return listDebits().filter(d => d.personalId === personalId && d.paidAt)
}

export function listPendencesByPersonal(personalId: string): DebitRecord[] {
  return listDebits().filter(d => d.personalId === personalId && (d.status === 'pendente' || d.status === 'atrasado'))
}
