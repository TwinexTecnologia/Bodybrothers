export type StudentRecord = {
  id: string
  personalId: string
  name: string
  email: string
  status: 'ativo' | 'inativo'
  createdAt: string
  lastAccess?: string
}

const KEY = 'owner_students'

export function listStudents(): StudentRecord[] {
  const raw = localStorage.getItem(KEY)
  if (!raw) return []
  try {
    const arr = JSON.parse(raw) as StudentRecord[]
    return Array.isArray(arr) ? arr : []
  } catch {
    localStorage.removeItem(KEY)
    return []
  }
}

export function listStudentsByPersonal(personalId: string): StudentRecord[] {
  return listStudents().filter(s => s.personalId === personalId)
}

export function addStudent(s: Omit<StudentRecord, 'id' | 'createdAt' | 'status'>): StudentRecord {
  const id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now())
  const rec: StudentRecord = {
    id,
    personalId: s.personalId,
    name: s.name,
    email: s.email,
    status: 'ativo',
    createdAt: new Date().toISOString(),
    lastAccess: undefined,
  }
  const arr = listStudents()
  arr.push(rec)
  localStorage.setItem(KEY, JSON.stringify(arr))
  return rec
}
