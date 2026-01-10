import { useEffect, useMemo, useState } from 'react'
import { listPersonals } from '../store/personals'
import type { PersonalRecord } from '../store/personals'

export default function PersonalSelector({ onChange }: { onChange?: (p: PersonalRecord | null) => void }) {
  const items = useMemo(() => listPersonals(), [])
  const [selected, setSelected] = useState<string>(() => localStorage.getItem('owner_selected_personal') || '')

  useEffect(() => {
    const p = items.find(i => i.id === selected) || null
    if (onChange) onChange(p)
  }, [selected, items, onChange])

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <select value={selected} onChange={(e) => {
        const id = e.target.value
        setSelected(id)
        localStorage.setItem('owner_selected_personal', id)
      }}>
        <option value="">Selecione um Personal</option>
        {items.map(i => (
          <option key={i.id} value={i.id}>{i.name} • {i.email}</option>
        ))}
      </select>
    </div>
  )
}
