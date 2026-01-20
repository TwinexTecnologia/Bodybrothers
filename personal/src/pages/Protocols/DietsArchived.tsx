import { useEffect, useMemo, useState } from 'react'
import { listArchivedDiets, setDietStatus, deleteDiet, type DietRecord } from '../../store/diets'
import { supabase } from '../../lib/supabase'
import ConfirmModal from '../../components/ConfirmModal'

export default function DietsArchived() {
  const [items, setItems] = useState<DietRecord[]>([])
  const [q, setQ] = useState('')
  const [openDiet, setOpenDiet] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [dietToDelete, setDietToDelete] = useState<DietRecord | null>(null)

  const toMin = (s: string) => {
    const d = String(s || '').replace(/\D/g, '').slice(0, 4)
    const h = d.slice(0, 2)
    const m = d.slice(2, 4)
    const hh = Math.min(23, Math.max(0, Number(h || '0')))
    const mm = Math.min(59, Math.max(0, Number(m || '0')))
    return hh * 60 + mm
  }

  async function loadData() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
        const list = await listArchivedDiets(user.id)
        setItems(list)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  const filtered = useMemo(() => {
    const s = q.toLowerCase()
    return items.filter(d => {
      const mealFoods = d.meals
        .flatMap(m => m.foods.map(f => `${f.name} ${f.quantity} ${f.unit}`))
        .join(' ')
        .toLowerCase()
      const supps = (d.supplements || [])
        .map(su => `${su.name} ${su.quantity} ${su.unit} ${(su.notes || '')}`)
        .join(' ')
        .toLowerCase()
      return (
        d.name.toLowerCase().includes(s) ||
        (d.goal || '').toLowerCase().includes(s) ||
        mealFoods.includes(s) ||
        supps.includes(s)
      )
    })
  }, [items, q])

  const restore = async (d: DietRecord) => {
    await setDietStatus(d.id, 'ativa')
    setItems(prev => prev.filter(x => x.id !== d.id))
  }

  const handleDeleteClick = (d: DietRecord) => {
    setDietToDelete(d)
    setIsModalOpen(true)
  }

  const confirmDelete = async () => {
    if (!dietToDelete) return
    const success = await deleteDiet(dietToDelete.id)
    if (success) {
        setItems(prev => prev.filter(x => x.id !== dietToDelete.id))
    } else {
        alert('Erro ao excluir dieta.')
    }
    setIsModalOpen(false)
    setDietToDelete(null)
  }

  const exportDietPdf = async (d: DietRecord) => {
    const { jsPDF } = await import('jspdf')
    let brandLogoUrl = ''
    let brandTitle = 'Personal'
    // Fallback sem localStorage
    const style = `
      body { font-family: Inter, Arial, sans-serif; color: #111827; font-size: 18px; line-height: 1.5; }
      .diet { margin: 8px; }
      .logo-wrap { display: grid; place-items: center; margin-bottom: 20px }
      .logo { width: 192px; height: 192px; object-fit: cover; border-radius: 16px }
      .logo-fallback { width: 192px; height: 192px; border-radius: 16px; background: linear-gradient(135deg, #10b981, #60a5fa) }
      .header { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 16px; align-items: center; }
      .title { font-weight: 800; font-size: 26px }
      .goal { color: #64748b; font-size: 16px }
      .section { margin-top: 24px; display: grid; gap: 16px }
      .meal { border: 1px solid #e5e7eb; border-radius: 12px; padding: 18px; background: #fafafa }
      .meal-head { display: flex; align-items: center; gap: 12px; font-weight: 700; font-size: 18px }
      .meal-time { font-weight: 700; font-size: 18px }
      .grid { display: grid; gap: 12px; margin-top: 12px }
      .grid-3 { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 12px }
      .grid-header { font-weight: 700; color: #334155; font-size: 16px }
      .notes { margin-top: 12px }
      .notes b { display: block; margin-bottom: 4px }
    `
    const toMinLocal = (s: string) => {
      const d2 = String(s || '').replace(/\D/g, '').slice(0, 4)
      const h2 = d2.slice(0, 2)
      const m2 = d2.slice(2, 4)
      const hh2 = Math.min(23, Math.max(0, Number(h2 || '0')))
      const mm2 = Math.min(59, Math.max(0, Number(m2 || '0')))
      return hh2 * 60 + mm2
    }
    const mealsHtml = d.meals.slice().sort((a, b) => toMinLocal(a.time) - toMinLocal(b.time)).map(m => {
      const foods = (m.foods || []).map(f => `
        <div class="grid-3">
          <div>${f.name}</div>
          <div>${f.quantity}</div>
          <div>${f.unit}</div>
        </div>
        ${(f.substitutes || []).map(s => `
          <div class="grid-3">
            <div>ou ${s.name}</div>
            <div>${s.quantity}</div>
            <div>${s.unit}</div>
          </div>
        `).join('')}
      `).join('')
      return `
        <div class="meal">
          <div class="meal-head"><span class="meal-time">${m.time || '--:--'}</span><span>${m.title || 'Refeição'}</span></div>
          <div class="grid">
            <div class="grid-3 grid-header"><div>Alimento</div><div>Quantidade</div><div>Unidade</div></div>
            ${foods}
          </div>
          ${m.notes ? `<div class="notes"><b>Observações</b><div>${m.notes}</div></div>` : ''}
        </div>
      `
    }).join('')
    const suppsHtml = (d.supplements || []).length > 0 ? `
      <div class="section">
        <div class="title">Suplementos</div>
        <div class="grid">
          <div class="grid-3 grid-header"><div>Suplemento</div><div>Quantidade</div><div>Unidade</div></div>
          ${(d.supplements || []).map(s => `
            <div class="meal">
              <div class="grid-3">
                <div>${s.name}</div>
                <div>${s.quantity}</div>
                <div>${s.unit}</div>
              </div>
              ${s.notes ? `<div class="notes"><b>Observações</b><div>${s.notes}</div></div>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''
    const dietNotes = d.notes ? `<div class="notes"><b>Observações</b><div>${d.notes}</div></div>` : ''
    const html = `
      <div class="diet">
        <div class="logo-wrap">
          ${brandLogoUrl ? `<img src="${brandLogoUrl}" alt="${brandTitle}" class="logo" />` : `<div class="logo-fallback"></div>`}
        </div>
        <div class="header">
          <div>
            <div class="title">${d.name}</div>
            <div class="goal">${d.goal || '—'}</div>
          </div>
          <div>
            <div><small>Início</small>: ${d.startDate ? new Date(d.startDate).toLocaleDateString() : '—'}</div>
            <div><small>Fim</small>: ${d.endDate ? new Date(d.endDate).toLocaleDateString() : '—'}</div>
          </div>
          <div></div>
        </div>
        ${dietNotes}
        <div class="section">${mealsHtml}</div>
        ${suppsHtml}
      </div>
    `
    const container = document.createElement('div')
    container.style.position = 'fixed'
    container.style.left = '-99999px'
    container.style.top = '0'
    container.innerHTML = `<style>${style}</style>${html}`
    document.body.appendChild(container)
    const h2c = (await import('html2canvas')).default
    const canvas = await h2c(container, { scale: 2, useCORS: true, allowTaint: true })
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const margin = 10
    const imgWidthMM = pageWidth - margin * 2
    const mmPerPx = imgWidthMM / canvas.width
    const pageHeightMM = pageHeight - margin * 2
    const slicePxHeight = Math.floor(pageHeightMM / mmPerPx)
    let y = 0
    let isFirst = true
    while (y < canvas.height) {
      const sliceHeight = Math.min(slicePxHeight, canvas.height - y)
      const sliceCanvas = document.createElement('canvas')
      sliceCanvas.width = canvas.width
      sliceCanvas.height = sliceHeight
      const ctx = sliceCanvas.getContext('2d')!
      ctx.drawImage(canvas, 0, y, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight)
      const imgData = sliceCanvas.toDataURL('image/png')
      const imgHeightMM = sliceHeight * mmPerPx
      if (!isFirst) doc.addPage()
      doc.addImage(imgData, 'PNG', margin, margin, imgWidthMM, imgHeightMM)
      y += sliceHeight
      isFirst = false
    }
    doc.save(`${d.name}.pdf`)
    document.body.removeChild(container)
  }

  if (loading) return <div>Carregando...</div>

  return (
    <div>
      <ConfirmModal
        isOpen={isModalOpen}
        title="Excluir Permanentemente?"
        description={`Você está prestes a excluir a dieta "${dietToDelete?.name}". Esta ação NÃO pode ser desfeita e você perderá este histórico para sempre. Se quiser apenas ocultar, mantenha-a arquivada.`}
        confirmText="Sim, excluir para sempre"
        cancelText="Manter arquivada"
        onConfirm={confirmDelete}
        onCancel={() => setIsModalOpen(false)}
        isDanger={true}
      />

      <h1>Protocolos • Dietas Arquivadas</h1>
      <div style={{ marginBottom: 10, display: 'flex', gap: 10 }}>
        <input placeholder="Buscar por nome, objetivo ou alimento" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn" onClick={loadData}>Atualizar</button>
      </div>
      <div style={{ display: 'grid', gap: 10 }}>
        {filtered.map(d => (
          <div key={d.id} className="diet-card">
            <div className="diet-header">
              <div>
                <div className="diet-title">{d.name}</div>
                <div className="diet-goal">{d.goal || '—'}</div>
              </div>
              <div className="diet-dates">
                <div><small>Início</small>: {d.startDate ? new Date(d.startDate).toLocaleDateString() : '—'}</div>
                <div><small>Fim</small>: {d.endDate ? new Date(d.endDate).toLocaleDateString() : '—'}</div>
              </div>

              {/* Resumo Nutricional Compacto no Card */}
              {(() => {
                  const meals = (d.variants && d.variants.length > 0) ? d.variants[0].meals : d.meals
                  
                  if (meals.length > 0) {
                      const total = meals.reduce((acc, m) => {
                          m.foods.forEach(f => {
                              acc.kcal += Number(f.calories || 0)
                              acc.p += Number(f.protein || 0)
                              acc.c += Number(f.carbs || 0)
                              acc.g += Number(f.fat || 0)
                          })
                          return acc
                      }, { kcal: 0, p: 0, c: 0, g: 0 })

                      return (
                          <div style={{ 
                              display: 'flex', gap: 12, alignItems: 'center', 
                              background: '#f8fafc', padding: '6px 12px', borderRadius: 8, 
                              fontSize: '0.8em', border: '1px solid #e2e8f0',
                              marginTop: 8, marginBottom: 8, flexWrap: 'wrap'
                          }}>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 40 }}>
                                  <span style={{ fontWeight: 800, color: '#0369a1', fontSize: '1.1em' }}>{Math.round(total.kcal)}</span>
                                  <span style={{ color: '#64748b', fontSize: '0.9em' }}>kcal</span>
                              </div>
                              <div style={{ width: 1, height: 20, background: '#cbd5e1' }}></div>
                              <div style={{ display: 'flex', gap: 10 }}>
                                  <span title="Proteína" style={{ color: '#15803d', fontWeight: 600 }}>P: {total.p.toFixed(0)}g</span>
                                  <span title="Carboidrato" style={{ color: '#1d4ed8', fontWeight: 600 }}>C: {total.c.toFixed(0)}g</span>
                                  <span title="Gordura" style={{ color: '#c2410c', fontWeight: 600 }}>G: {total.g.toFixed(0)}g</span>
                              </div>
                          </div>
                      )
                  }
                  return null
              })()}

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
                <button
                  className="btn"
                  style={{ background: '#e5e7eb', color: '#000' }}
                  onClick={() => setOpenDiet({ ...openDiet, [d.id]: !openDiet[d.id] })}
                >
                  {openDiet[d.id] ? '▾' : '▸'}
                </button>
                <a href={`/protocols/diet-create?id=${d.id}`} className="btn" style={{ background: 'var(--personal-accent)' }}>Editar</a>
                <button className="btn" onClick={() => restore(d)} style={{ background: 'var(--personal-primary)' }}>Reativar</button>
                <button className="btn" onClick={() => exportDietPdf(d)} style={{ background: '#0f172a' }}>Exportar PDF</button>
                <button className="btn" onClick={() => handleDeleteClick(d)} style={{ background: '#ef4444' }}>Excluir</button>
              </div>
            </div>
            {openDiet[d.id] && d.notes && (
              <div className="notes-block">
                <div className="notes-title">Observações</div>
                <div className="notes-content">{d.notes}</div>
              </div>
            )}
            {openDiet[d.id] && (
            <div className="diet-section">
              {d.meals.slice().sort((a, b) => toMin(a.time) - toMin(b.time)).map((m, i) => (
                <div key={i} className="meal-card">
                  <div className="meal-header">
                    <span className="meal-time">{m.time || '--:--'}</span>
                    <span className="meal-title">{m.title || 'Refeição'}</span>
                  </div>
                  <div className="meal-foods">
                    <div className="food-header"><div>Alimento</div><div>Quantidade</div><div>Unidade</div></div>
                    {m.foods.map((f, j) => (
                      <div key={j} className="food-row">
                        <div className="food-name">{f.name}</div>
                        <div>{f.quantity}</div>
                        <div>{f.unit}</div>
                      </div>
                    ))}
                  </div>
                  {m.notes && (
                    <div className="notes-block">
                      <div className="notes-title">Observações</div>
                      <div className="notes-content">{m.notes}</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            )}

            {openDiet[d.id] && (d.supplements || []).length > 0 && (
              <div className="form-section" style={{ marginTop: 10 }}>
                <div className="form-title">Suplementos</div>
                <div className="form-grid" style={{ gridTemplateColumns: '1fr', gap: 8 }}>
                  <div className="food-header"><div>Suplemento</div><div>Quantidade</div><div>Unidade</div></div>
                  {(d.supplements || []).map((s, si) => (
                    <div key={si} className="supplement-card">
                      <div className="supplement-row">
                        <div className="food-name">{s.name}</div>
                        <div>{s.quantity}</div>
                        <div>{s.unit}</div>
                      </div>
                      {s.notes && (
                        <div className="notes-block">
                          <div className="notes-title">Observações</div>
                          <div className="notes-content">{s.notes}</div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
        {filtered.length === 0 && <div>Nenhuma dieta arquivada.</div>}
      </div>
    </div>
  )
}
