import { useEffect, useMemo, useState } from 'react'
import { listActiveDiets, setDietStatus, toggleDietFavorite, duplicateDiet, type DietRecord } from '../../store/diets'
  import { supabase } from '../../lib/supabase'
  import jsPDF from 'jspdf'
  import html2canvas from 'html2canvas'
  import { Star, Copy } from 'lucide-react'
  import Modal from '../../components/Modal'

export default function DietsActive() {
  const [items, setItems] = useState<DietRecord[]>([])
  const [studentNames, setStudentNames] = useState<Record<string, string>>({})
  const [filterType, setFilterType] = useState<'all' | 'library' | 'student'>('all')
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [q, setQ] = useState('')
  const [openSubs, setOpenSubs] = useState<Record<string, boolean>>({})
  const [openDiet, setOpenDiet] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [logoUrl, setLogoUrl] = useState('')

  const [assignModalOpen, setAssignModalOpen] = useState(false)
  const [selectedDietForAssign, setSelectedDietForAssign] = useState<DietRecord | null>(null)
  const [assignStudentId, setAssignStudentId] = useState('')
  
  // Modal de Confirmação
  const [smartLinkState, setSmartLinkState] = useState<{
      itemId: string;
      itemName: string;
      targetStudentId: string;
  } | null>(null)

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

        // Carrega nomes de TODOS os alunos disponíveis
        const { data: students } = await supabase
          .from('profiles')
          .select('id, full_name')
          .eq('personal_id', user.id) // Filtra apenas alunos DESTE personal
          .or('role.eq.student,role.eq.aluno')
        
        const names: Record<string, string> = {}
        students?.forEach(s => {
            names[s.id] = s.full_name
        })
        setStudentNames(names)
        
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
      // Filtros
      if (filterType === 'library' && d.studentId) return false
      if (filterType === 'student' && !d.studentId) return false
      if (selectedStudentId && d.studentId !== selectedStudentId) return false

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
  }, [items, q, filterType, selectedStudentId])

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
    // 0. Converte logo para Base64 para evitar problemas de CORS no html2canvas
    let base64Logo = ''
    if (logoUrl && !logoUrl.includes('placehold.co')) {
         try {
             // Tenta converter via Image + Canvas (mais robusto para CORS se configurado)
             base64Logo = await new Promise((resolve) => {
                 const img = new Image()
                 img.crossOrigin = 'Anonymous'
                 img.onload = () => {
                     const canvas = document.createElement('canvas')
                     canvas.width = img.width
                     canvas.height = img.height
                     const ctx = canvas.getContext('2d')
                     if (ctx) {
                         ctx.drawImage(img, 0, 0)
                         resolve(canvas.toDataURL('image/png'))
                     } else {
                         resolve(logoUrl) // Fallback
                     }
                 }
                 img.onerror = (err) => {
                     console.error('Erro ao carregar imagem para base64:', err)
                     resolve(logoUrl)
                 }
                 // Cache buster
                 img.src = logoUrl + (logoUrl.includes('?') ? '&' : '?') + 't=' + new Date().getTime()
             })
         } catch (e) {
            console.error('Erro ao converter logo para base64:', e)
            base64Logo = logoUrl // Tenta usar URL normal como fallback
        }
    } else {
        base64Logo = logoUrl // Placeholder usa URL normal
    }

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
    
    if (base64Logo) {
        html += `
            <div style="text-align: center; margin-bottom: 30px;">
                <img src="${base64Logo}" style="max-height: 120px; object-fit: contain;" />
            </div>
        `
    } else {
        // Fallback texto se não tiver logo
        html += `
             <div style="text-align: center; margin-bottom: 30px; padding: 20px; background: #1e3a8a; color: #fff; font-size: 20px; font-weight: bold;">
                LOGO DO PERSONAL
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

  const openAssignModal = (d: DietRecord) => {
      setSelectedDietForAssign(d)
      setAssignStudentId('')
      setAssignModalOpen(true)
  }

  const handleAssign = async () => {
      if (!selectedDietForAssign || !assignStudentId) return
      
      setLoading(true)
      
      // Se a dieta selecionada JÁ pertence ao aluno escolhido:
      if (selectedDietForAssign.studentId === assignStudentId) {
          alert('Esta dieta já pertence a este aluno. Use o botão "Editar" para modificá-lo.')
          setLoading(false)
          return
      }

      // Verifica se é um item da biblioteca que PARECE ser do aluno
      // e oferece a opção de VINCULAR (Mover) ao invés de DUPLICAR
      const studentName = studentNames[assignStudentId]
      const firstName = studentName ? studentName.split(' ')[0] : ''
      
      let shouldMove = false
      if (!selectedDietForAssign.studentId && firstName && selectedDietForAssign.name.toLowerCase().includes(firstName.toLowerCase())) {
          shouldMove = true
      }

      if (shouldMove) {
          setSmartLinkState({
              itemId: selectedDietForAssign.id,
              itemName: selectedDietForAssign.name,
              targetStudentId: assignStudentId
          })
          setAssignModalOpen(false)
          setLoading(false)
          return
      }

      // Se for de OUTRO aluno ou da Biblioteca -> CRIA CÓPIA
      const newDiet = await duplicateDiet(selectedDietForAssign.id, assignStudentId)
      
      if (newDiet) {
          // Adiciona na lista
          setItems(prev => [newDiet, ...prev])
          setAssignModalOpen(false)
          setSelectedDietForAssign(null)
          setAssignStudentId('')
      }
      
      setLoading(false)
  }

  const confirmSmartLink = async (action: 'link' | 'copy') => {
      if (!smartLinkState) return
      setLoading(true)
      
      const { itemId, targetStudentId } = smartLinkState
      
      if (action === 'link') {
          await updateDiet(itemId, { studentId: targetStudentId })
          // Atualiza lista localmente
          setItems(prev => prev.map(d => d.id === itemId ? { ...d, studentId: targetStudentId } : d))
      } else {
          const newDiet = await duplicateDiet(itemId, targetStudentId)
          if (newDiet) {
              setItems(prev => [newDiet, ...prev])
          }
      }
      
      setSmartLinkState(null)
      setSelectedDietForAssign(null)
      setAssignStudentId('')
      setLoading(false)
  }

  if (loading) return <div>Carregando...</div>

  return (
    <div>
      <h1>Protocolos • Dietas Ativas</h1>
      <div style={{ marginBottom: 20, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', background: '#fff', padding: 12, borderRadius: 12, border: '1px solid #f1f5f9' }}>
        
        {/* Filtro de Tipo (Pills) */}
        <div style={{ display: 'flex', gap: 8 }}>
            {[
                { id: 'all', label: 'Todos' },
                { id: 'library', label: '📚 Biblioteca' },
                { id: 'student', label: '👤 Alunos' }
            ].map(opt => (
                <button
                    key={opt.id}
                    onClick={() => {
                        setFilterType(opt.id as any)
                        if (opt.id !== 'student') setSelectedStudentId('')
                    }}
                    style={{
                        padding: '8px 16px',
                        borderRadius: '20px',
                        border: filterType === opt.id ? 'none' : '1px solid #e2e8f0',
                        background: filterType === opt.id ? '#0f172a' : '#fff',
                        color: filterType === opt.id ? '#fff' : '#64748b',
                        cursor: 'pointer',
                        fontWeight: 500,
                        fontSize: '0.9rem',
                        transition: 'all 0.2s',
                        boxShadow: filterType === opt.id ? '0 2px 4px rgba(15,23,42,0.2)' : 'none'
                    }}
                >
                    {opt.label}
                </button>
            ))}
        </div>

        {/* Divisor Vertical */}
        <div style={{ width: 1, height: 24, background: '#e2e8f0' }}></div>

        {/* Filtro de Aluno (Select) */}
        <div style={{ flex: 1, display: 'flex', gap: 10 }}>
            {filterType === 'student' && (
                <div style={{ position: 'relative', minWidth: 200 }}>
                    <select 
                        className="select" 
                        style={{ 
                            padding: '8px 32px 8px 12px', 
                            width: '100%', 
                            borderRadius: 8,
                            borderColor: '#cbd5e1',
                            background: '#f8fafc',
                            fontSize: '0.9rem'
                        }}
                        value={selectedStudentId} 
                        onChange={e => setSelectedStudentId(e.target.value)}
                    >
                        <option value="">Todos os Alunos</option>
                        {Object.entries(studentNames).sort((a,b) => a[1].localeCompare(b[1])).map(([id, name]) => (
                            <option key={id} value={id}>{name}</option>
                        ))}
                    </select>
                    <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#64748b', fontSize: '0.8rem' }}>▼</div>
                </div>
            )}

            <input 
                placeholder="🔍 Buscar por nome, objetivo..." 
                value={q} 
                onChange={(e) => setQ(e.target.value)} 
                style={{ 
                    flex: 1, 
                    padding: '8px 12px', 
                    borderRadius: 8, 
                    border: '1px solid #cbd5e1',
                    fontSize: '0.9rem'
                }} 
            />
        </div>
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
                  <div className="diet-title">
                      {d.name}
                      {d.studentId ? (
                          <span style={{ 
                              fontSize: '0.75em', 
                              backgroundColor: '#eff6ff', 
                              color: '#3b82f6', 
                              padding: '2px 8px', 
                              borderRadius: 12, 
                              marginLeft: 8,
                              verticalAlign: 'middle',
                              border: '1px solid #dbeafe',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4
                          }}>
                              👤 {studentNames[d.studentId] || 'Aluno'}
                          </span>
                      ) : (
                          <span style={{ 
                              fontSize: '0.75em', 
                              backgroundColor: '#f1f5f9', 
                              color: '#64748b', 
                              padding: '2px 8px', 
                              borderRadius: 12, 
                              marginLeft: 8,
                              verticalAlign: 'middle',
                              border: '1px solid #e2e8f0',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4
                          }}>
                              📚 Biblioteca
                          </span>
                      )}
                  </div>
                  <div className="diet-goal">{d.goal || '—'}</div>
                </div>
              </div>
              <div className="diet-dates">
                <div><small>Início</small>: {d.startDate ? new Date(d.startDate).toLocaleDateString() : '—'}</div>
                <div><small>Fim</small>: {d.endDate ? new Date(d.endDate).toLocaleDateString() : '—'}</div>
              </div>
              
              {/* Resumo Nutricional Compacto no Card */}
              {(() => {
                  // Pega refeições da primeira variante ou padrão
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
                <button 
                    className="btn" 
                    onClick={() => openAssignModal(d)} 
                    style={{ background: '#3b82f6', display: 'flex', alignItems: 'center', gap: 6 }}
                    title="Duplicar para um aluno"
                >
                    <Copy size={16} /> Vincular
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

      <Modal
          isOpen={assignModalOpen}
          onClose={() => setAssignModalOpen(false)}
          title="Vincular Dieta a Aluno"
          footer={
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button className="btn" style={{ background: '#e2e8f0', color: '#1e293b' }} onClick={() => setAssignModalOpen(false)}>Cancelar</button>
                  <button className="btn" style={{ background: '#0f172a', color: '#fff' }} onClick={handleAssign} disabled={!assignStudentId}>Confirmar</button>
              </div>
          }
      >
          <div style={{ padding: 10 }}>
              <p style={{ color: '#64748b', marginBottom: 16 }}>
                  Selecione o aluno para quem deseja copiar esta dieta.
                  <br/>
                  <small>Será criada uma cópia independente com o nome do aluno.</small>
              </p>
              
              <label className="label">
                  Selecione o Aluno
                  <select 
                      className="select" 
                      style={{ width: '100%' }}
                      value={assignStudentId} 
                      onChange={e => setAssignStudentId(e.target.value)}
                  >
                      <option value="">Selecione...</option>
                      {Object.entries(studentNames)
                          .sort((a,b) => a[1].localeCompare(b[1]))
                          .map(([id, name]) => (
                              <option key={id} value={id}>{name}</option>
                          ))
                      }
                  </select>
              </label>
          </div>
      </Modal>

      <Modal
        isOpen={!!smartLinkState}
        onClose={() => setSmartLinkState(null)}
        title="Vincular ou Copiar?"
        footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                <button className="btn" style={{ background: '#e2e8f0', color: '#1e293b' }} onClick={() => setSmartLinkState(null)}>Cancelar</button>
                <button className="btn" style={{ background: '#fff', color: '#0f172a', border: '1px solid #cbd5e1' }} onClick={() => confirmSmartLink('copy')}>Criar Cópia</button>
                <button className="btn" style={{ background: '#0f172a', color: '#fff' }} onClick={() => confirmSmartLink('link')}>Vincular (Mover)</button>
            </div>
        }
      >
        <div style={{ textAlign: 'center', padding: 10 }}>
            <div style={{ fontSize: '3rem', marginBottom: 16 }}>🔄</div>
            <h3 style={{ color: '#1e293b', marginBottom: 12 }}>Item encontrado na Biblioteca</h3>
            <p style={{ color: '#64748b', fontSize: '1.05em', marginBottom: 20 }}>
                O item <strong>"{smartLinkState?.itemName}"</strong> parece já pertencer ao aluno selecionado.
            </p>
            <div style={{ textAlign: 'left', background: '#f8fafc', padding: 16, borderRadius: 8, fontSize: '0.95em', color: '#475569' }}>
                <p style={{ margin: '0 0 10px 0' }}><strong>O que você deseja fazer?</strong></p>
                <ul style={{ paddingLeft: 20, margin: 0 }}>
                    <li style={{ marginBottom: 8 }}>
                        <strong>Vincular (Mover):</strong> Retira da biblioteca e atribui ao aluno.
                    </li>
                    <li>
                        <strong>Criar Cópia:</strong> Mantém o original na biblioteca e cria um novo para o aluno.
                    </li>
                </ul>
            </div>
        </div>
      </Modal>
    </div>
  )
}
