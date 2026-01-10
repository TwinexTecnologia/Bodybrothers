export type PersonalBranding = {
  brandName?: string
  logoUrl?: string
  sidebarColor?: string
  buttonColor?: string
  accentColor?: string
}

export type PersonalRecord = {
  id: string
  name: string
  email: string
  password: string
  phone?: string
  createdAt: string
  lastAccess?: string
  status: 'ativo' | 'inativo'
  dueDate?: string
  branding?: PersonalBranding
}

const KEY = 'owner_personals'

export function listPersonals(): PersonalRecord[] {
  const raw = localStorage.getItem(KEY)
  if (!raw) return []
  try {
    const arr = JSON.parse(raw) as PersonalRecord[]
    return Array.isArray(arr) ? arr : []
  } catch {
    localStorage.removeItem(KEY)
    return []
  }
}

export function emailExists(email: string): boolean {
  const e = email.trim().toLowerCase()
  return listPersonals().some(p => p.email.trim().toLowerCase() === e)
}

export function getPersonalById(id: string): PersonalRecord | undefined {
  return listPersonals().find(p => p.id === id)
}

export function emailExistsExcept(email: string, exceptId: string): boolean {
  const e = email.trim().toLowerCase()
  return listPersonals().some(p => p.id !== exceptId && p.email.trim().toLowerCase() === e)
}

export function updatePersonal(id: string, patch: Partial<PersonalRecord>): PersonalRecord | undefined {
  const arr = listPersonals()
  const idx = arr.findIndex(p => p.id === id)
  if (idx === -1) return undefined
  const next = { ...arr[idx], ...patch }
  arr[idx] = next
  localStorage.setItem(KEY, JSON.stringify(arr))
  return next
}

export function addPersonal(p: Omit<PersonalRecord, 'id' | 'createdAt' | 'status'>): PersonalRecord {
  const id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now())
  const rec: PersonalRecord = {
    id,
    name: p.name,
    email: p.email,
    password: p.password,
    phone: p.phone,
    createdAt: new Date().toISOString(),
    lastAccess: undefined,
    status: 'ativo',
    dueDate: p.dueDate,
    branding: p.branding,
  }
  const arr = listPersonals()
  arr.push(rec)
  localStorage.setItem(KEY, JSON.stringify(arr))
  return rec
}
