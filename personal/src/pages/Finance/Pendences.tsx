import { useEffect, useMemo, useState } from 'react'
import { listStudentsByPersonal, type StudentRecord } from '../../store/students'
import { listResponsesByPersonal, listModels, type AnamnesisResponse, type AnamnesisModel } from '../../store/anamnesis'

const TODAY_ISO = new Date().toISOString()

export default function Pendences() {
  const personalId = localStorage.getItem('personal_current_id') || 'unknown'
  const [students, setStudents] = useState<StudentRecord[]>(() => listStudentsByPersonal(personalId))
  const [models, setModels] = useState<AnamnesisModel[]>(() => listModels(personalId))
  const [responses, setResponses] = useState<AnamnesisResponse[]>(() => listResponsesByPersonal(personalId))
  const [q, setQ] = useState('')

  useEffect(() => {
    const onStudentsChanged = () => setStudents(listStudentsByPersonal(personalId))
    const onModelsChanged = () => setModels(listModels(personalId))
    const onAnamnesisChanged = () => setResponses(listResponsesByPersonal(personalId))
    window.addEventListener('personal-students-changed', onStudentsChanged)
    window.addEventListener('personal-anamnesis-changed', onModelsChanged)
    window.addEventListener('personal-anamnesis-changed', onAnamnesisChanged)
    onStudentsChanged(); onModelsChanged(); onAnamnesisChanged()
    return () => {
      window.removeEventListener('personal-students-changed', onStudentsChanged)
      window.removeEventListener('personal-anamnesis-changed', onModelsChanged)
      window.removeEventListener('personal-anamnesis-changed', onAnamnesisChanged)
    }
  }, [personalId])

  const overdue = useMemo(() => {
    const byKey = new Map<string, AnamnesisResponse>()
    for (const r of responses) {
      const key = `${r.studentId}-${r.modelId}`
      const prev = byKey.get(key)
      if (!prev) byKey.set(key, r)
      else if (new Date(r.createdAt).getTime() > new Date(prev.createdAt).getTime()) byKey.set(key, r)
    }
    const arr: { student: StudentRecord, model: AnamnesisModel | undefined, response: AnamnesisResponse, dueDate?: Date }[] = []
    for (const r of byKey.values()) {
      const dstr = r.dueDate
      if (!dstr) continue
      if (dstr <= TODAY_ISO) {
        const d = new Date(dstr)
        const student = students.find(s => s.id === r.studentId)
        if (!student) continue
        const model = models.find(m => m.id === r.modelId)
        arr.push({ student, model, response: r, dueDate: isNaN(d.getTime()) ? undefined : d })
      }
    }
    const s = q.toLowerCase()
    return arr
      .filter(it => it.student.name.toLowerCase().includes(s) || (it.model?.name || '').toLowerCase().includes(s))
      .sort((a, b) => (a.dueDate!.getTime() - b.dueDate!.getTime()))
  }, [responses, students, models, q])

  return (
    <div>
      <h1>Financeiro • Pendências do Aluno</h1>
      <div className="form-card" style={{ padding: 12 }}>
        <div className="form-grid">
          <label className="label">
            Buscar por aluno ou modelo
            <input className="input" placeholder="Filtrar" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
        </div>
      </div>
      <div className="form-card" style={{ padding: 12, marginTop: 10 }}>
        <div className="form-title">Anamneses a renovar</div>
        <div className="form-grid" style={{ gridTemplateColumns: '1fr', gap: 10 }}>
          {overdue.map((it, idx) => (
            <div key={idx} className="form-card" style={{ padding: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <strong>{it.student.name}</strong>
                  <div style={{ color: '#64748b' }}>Modelo: {it.model?.name || '—'}</div>
                  <div style={{ color: '#64748b' }}>Vencido em {it.dueDate?.toLocaleDateString()}</div>
                </div>
              </div>
            </div>
          ))}
          {overdue.length === 0 && <div>Nenhum aluno com anamnese vencida.</div>}
        </div>
      </div>
    </div>
  )
}
