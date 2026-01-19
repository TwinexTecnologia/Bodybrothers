import { useEffect, useMemo, useState } from 'react'
import { listActiveDiets, setDietStatus, toggleDietFavorite, type DietRecord } from '../../store/diets'
import { supabase } from '../../lib/supabase'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import { Star } from 'lucide-react'

export default function DietsActive() {
  const [items, setItems] = useState<DietRecord[]>([])
  const [q, setQ] = useState('')
  const [openSubs, setOpenSubs] = useState<Record<string, boolean>>({})
  const [openDiet, setOpenDiet] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [logoUrl, setLogoUrl] = useState('')

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
        const list = await listActiveDiets(user.id)
        setItems(list)
        
        const { data: config } = await supabase
            .from('personal_config')
            .select('logo_url')
            .eq('personal_id', user.id)
            .single()
        
        if (config?.logo_url) {
            setLogoUrl(config.logo_url)
        } else {
             setLogoUrl('https://placehold.co/400x200/1e3a8a/ffffff?text=LOGO+DO+PERSONAL')
        }
    }
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  const filtered = useMemo(() => {
    const s = q.toLowerCase()
    const result = items.filter(d => {
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

    // Garante ordenação: Favoritos > Data
    return result.sort((a, b) => {
        if (a.isFavorite && !b.isFavorite) return -1
        if (!a.isFavorite && b.isFavorite) return 1
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    })
  }, [items, q])

  const archive = async (d: DietRecord) => {
    await setDietStatus(d.id, 'inativa')
    setItems(prev => prev.filter(x => x.id !== d.id))
  }

  const toggleFav = async (d: DietRecord) => {
      // Atualiza UI otimista
      setItems(prev => prev.map(item => item.id === d.id ? { ...item, isFavorite: !item.isFavorite } : item))
      
      // Persiste no banco
      const updated = await toggleDietFavorite(d.id)
      
      // Sincroniza estado real
      if (updated) {
          setItems(prev => prev.map(item => item.id === d.id ? updated : item))
      }
  }

  const exportDietPdf = async (d: DietRecord) => {
    // 1. Cria container temporário
    const container = document.createElement('div')
    container.style.position = 'absolute'
    container.style.left = '-9999px'
    container.style.top = '0'
    container.style.width = '210mm'
    container.style.minHeight = '297mm'
    container.style.background = '#fff'
    container.style.color = '#000'
    container.style.padding = '15mm'
    container.style.fontFamily = 'Arial, sans-serif'
    
    // 2. Monta HTML
    let activeMeals = d.meals
    let activeVariantName = 'Padrão'
    
    // Se tiver variações, pega a primeira (padrão) ou avisa? 
    // Idealmente abriria modal para escolher, mas vamos pegar a primeira para simplificar o fluxo da lista.
    if (d.variants && d.variants.length > 0) {
        activeMeals = d.variants[0].meals
        activeVariantName = d.variants[0].name
    }

    let html = ``
    
    if (logoUrl) {
        html += `
            <div style="text-align: center; margin-bottom: 30px;">
                <img src="${logoUrl}" style="max-height: 220px; object-fit: contain;" crossOrigin="anonymous" />
            </div>
        `
    }

    html += `
        <h1 style="text-align: center; margin-bottom: 5px; font-size: 24px; background: #1e3a8a; color: #fff; padding: 12px; border-radius: 8px; text-transform: uppercase; letter-spacing: 1px;">${d.name}</h1>
        <div style="text-align: center; margin-bottom: 25px; color: #4b5563; font-size: 18px; marginTop: 10px; font-weight: 600;">${activeVariantName}</div>
    `

    if (d.goal || d.startDate || d.endDate) {
        html += `<div style="margin-bottom: 30px; display: flex; gap: 20px; justify-content: center; font-size: 14px; color: #444; border-bottom: 1px solid #e5e7eb; padding-bottom: 20px;">`
        if (d.goal) html += `<div><strong>Objetivo:</strong> ${d.goal}</div>`
        if (d.startDate) html += `<div><strong>Início:</strong> ${new Date(d.startDate).toLocaleDateString()}</div>`
        if (d.endDate) html += `<div><strong>Fim:</strong> ${new Date(d.endDate).toLocaleDateString()}</div>`
        html += `</div>`
    }

    if (d.notes) {
        html += `
            <div style="margin-bottom: 30px; font-style: italic; background: #f8fafc; padding: 15px; border-radius: 8px; border-left: 4px solid #1e3a8a;">
                ${d.notes}
            </div>
        `
    }

    html += `<div style="display: flex; flex-direction: column; gap: 25px;">`
    activeMeals.forEach((m, i) => {
        html += `
            <div style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; break-inside: avoid; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                <div style="background: #1e3a8a; color: #fff; padding: 10px 15px; font-weight: bold; display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 16px; text-transform: uppercase;">${m.title || `Refeição ${i+1}`}</span>
                    <span style="font-size: 15px; font-weight: 500;">${m.time}</span>
                </div>
                <div style="padding: 15px;">
        `
        m.foods.forEach((f, fi) => {
            html += `
                <div style="margin-bottom: 10px; font-size: 15px; border-bottom: ${fi < m.foods.length - 1 ? '1px solid #f1f5f9' : 'none'}; padding-bottom: ${fi < m.foods.length - 1 ? '10px' : '0'};">
                    <div style="display: flex; justify-content: space-between;">
                        <strong style="font-weight: 700; color: #1e293b;">${f.name}</strong> 
                        <span style="font-weight: 600;">${f.quantity ? `${f.quantity} ${f.unit}` : ''}</span>
                    </div>
            `
            if (f.substitutes && f.substitutes.length > 0) {
                f.substitutes.forEach(s => {
                    html += `
                        <div style="margin-left: 15px; margin-top: 4px; color: #64748b; font-size: 0.9em; display: flex; align-items: center;">
                            <span style="margin-right: 5px;">↳</span> ou ${s.name} - ${s.quantity} ${s.unit}
                        </div>
                    `
                })
            }
            html += `</div>`
        })
        
        html += `</div>`
        
        if (m.notes) {
            html += `
                <div style="padding: 10px 15px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 13px; color: #475569;">
                    <strong>Obs:</strong> ${m.notes}
                </div>
            `
        }
        html += `</div>`
    })
    html += `</div>`

    if (d.supplements && d.supplements.length > 0) {
        html += `
            <div style="margin-top: 30px; break-inside: avoid;">
                <h3 style="border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; margin-bottom: 15px; font-size: 18px;">Suplementação</h3>
                <div style="display: grid; gap: 10px;">
        `
        d.supplements.forEach(s => {
            html += `
                <div style="font-size: 14px; padding: 8px; background: #f9fafb; border-radius: 6px;">
                    • <strong>${s.name}</strong> - ${s.quantity} ${s.unit}
                    ${s.notes ? `<span style="color: #666;"> (${s.notes})</span>` : ''}
                </div>
            `
        })
        html += `</div></div>`
    }

    html += `
        <div style="margin-top: 40px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 20px;">
            Gerado por BodyBrothers App • ${new Date().toLocaleDateString()}
        </div>
    `

    container.innerHTML = html
    document.body.appendChild(container)

    try {
        // Aguarda um pouco para garantir renderização de imagens
        await new Promise(r => setTimeout(r, 500))

        const canvas = await html2canvas(container, { 
            scale: 2,
            useCORS: true,
            allowTaint: true
        })
        const imgData = canvas.toDataURL('image/png')
        
        const pdf = new jsPDF('p', 'mm', 'a4')
        const pdfWidth = pdf.internal.pageSize.getWidth()
        const pdfHeight = pdf.internal.pageSize.getHeight()
        const imgWidth = pdfWidth
        const imgHeight = (canvas.height * imgWidth) / canvas.width
        
        let heightLeft = imgHeight
        let position = 0

        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
        heightLeft -= pdfHeight

        while (heightLeft > 0) {
          position = heightLeft - imgHeight
          pdf.addPage()
          pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
          heightLeft -= pdfHeight
        }
        
        pdf.save(`Dieta_${d.name.replace(/\s+/g, '_')}.pdf`)
    } catch (err) {
        console.error('Erro ao gerar PDF:', err)
        alert('Erro ao gerar PDF')
    } finally {
        document.body.removeChild(container)
    }
  }

  if (loading) return <div>Carregando...</div>

  return (
    <div>
      <h1>Protocolos • Dietas Ativas</h1>
      <div style={{ marginBottom: 10, display: 'flex', gap: 10 }}>
        <input placeholder="Buscar por nome, objetivo ou alimento" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn" onClick={loadData}>Atualizar</button>
      </div>
      <div style={{ display: 'grid', gap: 10 }}>
        {filtered.map(d => (
          <div key={d.id} className="diet-card">
            <div className="diet-header">
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <button 
                    onClick={(e) => { e.stopPropagation(); toggleFav(d); }}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4 }}
                    title={d.isFavorite ? "Remover dos favoritos" : "Favoritar"}
                >
                    <Star size={20} fill={d.isFavorite ? "#eab308" : "none"} color={d.isFavorite ? "#eab308" : "#94a3b8"} />
                </button>
                <div>
                  <div className="diet-title">{d.name}</div>
                  <div className="diet-goal">{d.goal || '—'}</div>
                </div>
              </div>
              <div className="diet-dates">
                <div><small>Início</small>: {d.startDate ? new Date(d.startDate).toLocaleDateString() : '—'}</div>
                <div><small>Fim</small>: {d.endDate ? new Date(d.endDate).toLocaleDateString() : '—'}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
                <button
                  className="btn"
                  style={{ background: '#e5e7eb', color: '#000' }}
                  onClick={() => setOpenDiet({ ...openDiet, [d.id]: !openDiet[d.id] })}
                >
                  {openDiet[d.id] ? '▾' : '▸'}
                </button>
                <a href={`/protocols/diet-create?id=${d.id}`} className="btn" style={{ background: 'var(--personal-accent)' }}>Editar</a>
                <button className="btn" onClick={() => archive(d)} style={{ background: '#ef4444' }}>Arquivar</button>
                <button className="btn" onClick={() => exportDietPdf(d)} style={{ background: '#0f172a' }}>Exportar PDF</button>
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
                    {m.foods.map((f, j) => {
                      const key = `${d.id}-${i}-${j}`
                      const open = !!openSubs[key]
                      return (
                        <div key={j}>
                          <div className="food-row">
                            <div className="food-name">{f.name}</div>
                            <div>{f.quantity}</div>
                            <div>{f.unit}</div>
                          </div>
                          {!!f.substitutes?.length && (
                            <div style={{ textAlign: 'left', marginTop: 6 }}>
                              <button className="btn subs-toggle" onClick={() => setOpenSubs({ ...openSubs, [key]: !open })}>
                                {open ? 'Ocultar substituições' : 'Ver substituições'}
                              </button>
                            </div>
                          )}
                          {open && (
                            <div className="subs-list">
                              <div className="food-header"><div>Substituição</div><div>Quantidade</div><div>Unidade</div></div>
                              {(f.substitutes || []).map((s, si) => (
                                <div key={si} className="food-row">
                                  <div className="food-name">ou {s.name}</div>
                                  <div>{s.quantity}</div>
                                  <div>{s.unit}</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
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
        {filtered.length === 0 && (
          <div className="form-card" style={{ padding: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <strong>Nenhuma dieta ativa</strong>
                <div style={{ color: '#64748b' }}>Crie uma dieta ou atualize a lista.</div>
              </div>
              <a href="/protocols/diet-create" className="btn">Criar Dieta</a>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
