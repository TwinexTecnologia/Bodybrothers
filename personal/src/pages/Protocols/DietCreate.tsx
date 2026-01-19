import { useState, useEffect, useRef } from 'react'
import { addDiet, updateDiet, getDietById, deleteDietIfPersonalized, type DietMeal, type DietFood, type DietSubstitute, type DietVariant } from '../../store/diets'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { getStudent, updateStudent } from '../../store/students'
import { supabase } from '../../lib/supabase'
import FoodAutocomplete from '../../components/FoodAutocomplete'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

export default function DietCreate() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const printRef = useRef<HTMLDivElement>(null)
  
  // IDs
  const dietIdFromParams = params.get('id')
  const [editId, setEditId] = useState<string | null>(null)
  const [studentId, setStudentId] = useState<string | undefined>(undefined)
  
  // Form States
  const [name, setName] = useState('')
  const [goal, setGoal] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [notes, setNotes] = useState('')
  const [meals, setMeals] = useState<DietMeal[]>([])
  const [variants, setVariants] = useState<DietVariant[]>([])
  const [activeVariantId, setActiveVariantId] = useState<string>('default')
  const [supplements, setSupplements] = useState<DietFood[]>([])
  
  // Modal State
  const [showVariantModal, setShowVariantModal] = useState(false)
  const [newVariantName, setNewVariantName] = useState('')

  const [editingVariantId, setEditingVariantId] = useState<string | null>(null)
  const [editingVariantName, setEditingVariantName] = useState('')

  const startEditingVariant = (v: DietVariant) => {
      setEditingVariantId(v.id)
      setEditingVariantName(v.name)
  }

  const saveEditingVariant = () => {
      if (editingVariantId && editingVariantName.trim()) {
          setVariants(prev => prev.map(v => v.id === editingVariantId ? { ...v, name: editingVariantName.trim() } : v))
          setEditingVariantId(null)
      }
  }

  // UI States
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(true)
  const [personalId, setPersonalId] = useState('')
  const [logoUrl, setLogoUrl] = useState('')

  // Load Data
  useEffect(() => {
    async function load() {
        setLoading(true)
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
            setPersonalId(user.id)
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

        if (dietIdFromParams) {
            const d = await getDietById(dietIdFromParams)
            if (d) {
                setEditId(d.id)
                setStudentId(d.studentId)
                setName(d.name)
                setGoal(d.goal || '')
                setStartDate(d.startDate || '')
                setEndDate(d.endDate || '')
                setNotes(d.notes || '')
                setSupplements(d.supplements || [])
                
                if (d.variants && d.variants.length > 0) {
                    setVariants(d.variants)
                    setActiveVariantId(d.variants[0].id)
                    setMeals(d.variants[0].meals)
                } else {
                    const def = { id: 'default', name: 'Padrão', meals: d.meals || [] }
                    setVariants([def])
                    setActiveVariantId('default')
                    setMeals(def.meals)
                }
            }
        } else {
            // Nova dieta
            const def = { id: 'default', name: 'Padrão', meals: [] }
            setVariants([def])
            setActiveVariantId('default')
            setMeals([])
        }
        setLoading(false)
    }
    load()
  }, [dietIdFromParams])

  // Sincroniza meals com a variante ativa sempre que meals mudar
  useEffect(() => {
      setVariants(prev => prev.map(v => v.id === activeVariantId ? { ...v, meals } : v))
  }, [meals])

  const switchVariant = (vid: string) => {
      const target = variants.find(v => v.id === vid)
      if (target) {
          setActiveVariantId(vid)
          setMeals(target.meals) 
      }
  }

  const addVariant = () => {
      setNewVariantName('')
      setShowVariantModal(true)
  }

  const confirmAddVariant = () => {
      if (!newVariantName.trim()) return
      const newVar = { id: crypto.randomUUID(), name: newVariantName.trim(), meals: [] }
      setVariants([...variants, newVar])
      setActiveVariantId(newVar.id)
      setMeals([])
      setShowVariantModal(false)
  }

  const removeVariant = (vid: string, e: any) => {
      e.stopPropagation()
      if (variants.length <= 1) {
          alert('A dieta precisa ter pelo menos uma variação.')
          return
      }
      if (confirm('Excluir esta variação?')) {
          const newVars = variants.filter(v => v.id !== vid)
          setVariants(newVars)
          if (activeVariantId === vid) {
              setActiveVariantId(newVars[0].id)
              setMeals(newVars[0].meals)
          }
      }
  }

  const duplicateVariant = (vid: string, e: any) => {
      e.stopPropagation()
      const target = variants.find(v => v.id === vid)
      if (!target) return
      
      const newName = `${target.name} (Cópia)`
      const newVar = { 
          id: crypto.randomUUID(), 
          name: newName, 
          meals: JSON.parse(JSON.stringify(target.meals)) 
      }
      
      setVariants([...variants, newVar])
      setActiveVariantId(newVar.id)
      setMeals(newVar.meals)
  }

  // Helpers
  const recalculateMacros = (f: DietFood): DietFood => {
    // Se não tem base, não calcula
    if (!f.base_calories_100g) return f
    
    const qtyStr = f.quantity ? f.quantity.toString().replace(',', '.') : '0'
    const qty = Number(qtyStr)
    
    if (isNaN(qty)) return f

    let grams = 0
    const unit = f.unit ? f.unit.toLowerCase().trim() : 'g'

    if (unit === 'g' || unit === 'ml') {
        grams = qty
    } else if (f.base_unit_weight) {
        // Se temos o peso da unidade cadastrado
        grams = qty * f.base_unit_weight
    } else {
        // Se não temos peso de referência para a unidade, não calculamos automaticamente
        // para não sobrescrever edições manuais com valores errados.
        return f
    }

    const factor = grams / 100
    return {
        ...f,
        calories: (Number(f.base_calories_100g) * factor).toFixed(0),
        protein: (Number(f.base_protein_100g) * factor).toFixed(1),
        carbs: (Number(f.base_carbs_100g) * factor).toFixed(1),
        fat: (Number(f.base_fat_100g) * factor).toFixed(1),
        sodium: (Number(f.base_sodium_100g || 0) * factor).toFixed(0)
    }
  }

  const addMeal = () => {
      // Tenta pegar o horário da última refeição e somar 3h
      let newTime = ''
      if (meals.length > 0) {
          const lastTime = meals[meals.length - 1].time
          if (lastTime && lastTime.includes(':')) {
              const [h, m] = lastTime.split(':').map(Number)
              if (!isNaN(h)) {
                  const nextH = (h + 3) % 24
                  newTime = `${nextH.toString().padStart(2, '0')}:${m ? m.toString().padStart(2, '0') : '00'}`
              }
          }
      }
      setMeals([...meals, { title: '', time: newTime, foods: [] }])
  }

  const addMealAfter = (index: number) => {
    const next = meals.slice()
    
    // Tenta calcular horário baseado na refeição anterior
    let newTime = ''
    const prevTime = meals[index].time
    if (prevTime && prevTime.includes(':')) {
        const [h, m] = prevTime.split(':').map(Number)
        if (!isNaN(h)) {
            const nextH = (h + 3) % 24
            newTime = `${nextH.toString().padStart(2, '0')}:${m ? m.toString().padStart(2, '0') : '00'}`
        }
    }

    next.splice(index + 1, 0, { title: '', time: newTime, foods: [] })
    setMeals(next)
  }
  const duplicateMeal = (i: number) => {
    const next = meals.slice()
    next.splice(i + 1, 0, JSON.parse(JSON.stringify(next[i])))
    setMeals(next)
  }
  const removeMeal = (i: number) => setMeals(meals.filter((_, idx) => idx !== i))
  const updateMeal = (i: number, patch: Partial<DietMeal>) => {
    const next = meals.slice()
    next[i] = { ...next[i], ...patch }
    setMeals(next)
  }
  const reorderMeals = (from: number, to: number) => {
    const arr = meals.slice()
    const [m] = arr.splice(from, 1)
    arr.splice(to, 0, m)
    setMeals(arr)
  }

  const addFood = (mi: number) => {
    const next = meals.slice()
    const foods = next[mi].foods.slice()
    foods.push({ name: '', quantity: '', unit: 'g' })
    next[mi] = { ...next[mi], foods }
    setMeals(next)
  }
  const updateFood = (mi: number, fi: number, patch: Partial<DietFood>) => {
    const next = meals.slice()
    const foods = next[mi].foods.slice()
    
    let updatedFood = { ...foods[fi], ...patch }
    
    // Recalcula macros se quantidade, unidade ou base mudar
    if (patch.quantity !== undefined || patch.base_calories_100g !== undefined || patch.unit !== undefined) {
        updatedFood = recalculateMacros(updatedFood)
    }
    
    foods[fi] = updatedFood
    next[mi] = { ...next[mi], foods }
    setMeals(next)
  }
  const removeFood = (mi: number, fi: number) => {
    const next = meals.slice()
    const foods = next[mi].foods.filter((_, idx) => idx !== fi)
    next[mi] = { ...next[mi], foods }
    setMeals(next)
  }
  
  const addSubstitute = (mi: number, fi: number) => {
    const next = meals.slice()
    const foods = next[mi].foods.slice()
    const subs = foods[fi].substitutes ? foods[fi].substitutes!.slice() : []
    subs.push({ name: '', quantity: '', unit: '' })
    foods[fi] = { ...foods[fi], substitutes: subs }
    next[mi] = { ...next[mi], foods }
    setMeals(next)
  }
  const updateSubstitute = (mi: number, fi: number, si: number, patch: Partial<DietSubstitute>) => {
    const next = meals.slice()
    const foods = next[mi].foods.slice()
    const subs = (foods[fi].substitutes || []).slice()
    subs[si] = { ...subs[si], ...patch }
    foods[fi] = { ...foods[fi], substitutes: subs }
    next[mi] = { ...next[mi], foods }
    setMeals(next)
  }
  const removeSubstitute = (mi: number, fi: number, si: number) => {
    const next = meals.slice()
    const foods = next[mi].foods.slice()
    const subs = (foods[fi].substitutes || []).filter((_, idx) => idx !== si)
    foods[fi] = { ...foods[fi], substitutes: subs }
    next[mi] = { ...next[mi], foods }
    setMeals(next)
  }

  const addSupplement = () => setSupplements([...supplements, { name: '', quantity: '', unit: '' }])
  const updateSupplement = (i: number, patch: Partial<DietFood>) => {
    const next = supplements.slice()
    next[i] = { ...next[i], ...patch }
    setSupplements(next)
  }
  const removeSupplement = (i: number) => setSupplements(supplements.filter((_, idx) => idx !== i))

  const save = async () => {
    if (!personalId) {
        alert('Erro: Personal não identificado. Faça login novamente.')
        return
    }
    
    if (!name.trim()) {
        setMsg('Erro: Nome da dieta é obrigatório.')
        return
    }

    setLoading(true)
    setMsg('')

    try {
        const payload = {
            name: name.trim(),
            goal: goal || undefined,
            startDate: startDate || undefined,
            endDate: endDate || undefined,
            notes: notes || undefined,
            meals,
            variants,
            supplements,
        }

        if (editId) {
            const rec = await updateDiet(editId, payload)
            if (rec) setMsg(`Dieta atualizada: ${rec.name}`)
        } else {
            const rec = await addDiet({ ...payload, personalId })
            if (rec) {
                setMsg(`Dieta criada: ${rec.name}`)
                if (!editId) {
                    setName('')
                    setGoal('')
                    setStartDate('')
                    setEndDate('')
                    setNotes('')
                    setMeals([])
                    const def = { id: 'default', name: 'Padrão', meals: [] }
                    setVariants([def])
                    setActiveVariantId('default')
                    setSupplements([])
                }
            } else {
                throw new Error('Falha ao criar dieta')
            }
        }
    } catch (err: any) {
        console.error('Erro ao salvar dieta:', err)
        setMsg(`Erro ao salvar: ${err.message}`)
    } finally {
        setLoading(false)
    }
  }

  const deletePersonalized = async () => {
      if (!editId || !studentId) return
      const ok = await deleteDietIfPersonalized(editId)
      if (ok) {
          setMsg('Dieta personalizada excluída')
          setTimeout(() => navigate('/students/list'), 1000)
      } else {
          setMsg('Não é possível excluir uma dieta fixa')
      }
  }

  const exportPDF = async () => {
      if (!printRef.current) return
      
      try {
          const canvas = await html2canvas(printRef.current, { 
              scale: 2,
              useCORS: true,
              allowTaint: true,
              logging: true 
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
          
          pdf.save(`Dieta_${name.replace(/\s+/g, '_')}.pdf`)
      } catch (err) {
          console.error('Erro ao gerar PDF:', err)
          alert('Erro ao gerar PDF')
      }
  }

  if (loading && !personalId) return <div style={{ padding: 20 }}>Carregando dados...</div>

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', paddingBottom: 100 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h1 style={{ margin: 0 }}>{editId ? 'Editar Dieta' : 'Criar Dieta'}</h1>
          <div style={{ display: 'flex', gap: 10 }}>
            {editId && studentId && (
                <button
                    className="btn"
                    style={{ background: '#ef4444', padding: '10px 16px' }}
                    onClick={deletePersonalized}
                >
                    Excluir
                </button>
            )}
            <button className="btn" onClick={exportPDF} style={{ background: '#1e293b', padding: '10px 16px' }}>PDF</button>
            <button
                className="btn"
                disabled={loading}
                onClick={save}
                style={{ background: 'var(--personal-primary)', padding: '10px 24px', fontSize: '1em' }}
            >
                {loading ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
      </div>
      {msg && <div className="form-success" style={{ marginBottom: 20 }}>{msg}</div>}
      
      {/* Dados Gerais */}
      <div className="form-card" style={{ padding: 20, marginBottom: 24, borderLeft: '4px solid var(--personal-primary)' }}>
        <div className="form-grid">
          <label className="label">
            Nome da Dieta
            <input className="input" style={{ fontSize: '1.1em', fontWeight: 600 }} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Hipertrofia Fase 1" />
          </label>
          <label className="label">
            Objetivo
            <input className="input" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Ex: Ganho de massa" />
          </label>
          <label className="label">
            Início
            <input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>
          <label className="label">
            Fim (opcional)
            <input className="input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </label>
        </div>
        <div style={{ marginTop: 16 }}>
            <label className="label">
            Observações Gerais
            <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Instruções gerais..." />
            </label>
        </div>
      </div>



      {/* Variantes (Abas) */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflowX: 'auto', paddingBottom: 8 }}>
            {variants.map(v => (
                <div 
                    key={v.id}
                    onClick={() => switchVariant(v.id)}
                    style={{
                        padding: '10px 20px',
                        borderRadius: '8px',
                        background: activeVariantId === v.id ? '#fff' : '#e2e8f0',
                        color: activeVariantId === v.id ? '#2563eb' : '#64748b',
                        boxShadow: activeVariantId === v.id ? '0 4px 6px -1px rgba(0,0,0,0.1)' : 'none',
                        fontWeight: activeVariantId === v.id ? 700 : 500,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        display: 'flex', alignItems: 'center', gap: 8,
                        transition: 'all 0.2s ease',
                        border: activeVariantId === v.id ? '1px solid #bfdbfe' : '1px solid transparent'
                    }}
                    onDoubleClick={() => startEditingVariant(v)}
                >
                    {editingVariantId === v.id ? (
                        <input 
                            value={editingVariantName}
                            onChange={(e) => setEditingVariantName(e.target.value)}
                            onBlur={saveEditingVariant}
                            onKeyDown={(e) => e.key === 'Enter' && saveEditingVariant()}
                            autoFocus
                            style={{ width: 100, border: 'none', background: 'transparent', outline: 'none', fontWeight: 700, color: '#2563eb' }}
                            onClick={(e) => e.stopPropagation()}
                        />
                    ) : (
                        v.name
                    )}
                    
                    {variants.length > 1 && !editingVariantId && (
                        <span 
                            onClick={(e) => removeVariant(v.id, e)}
                            style={{ 
                                marginLeft: 8, fontSize: '1.2em', lineHeight: 0.5,
                                color: activeVariantId === v.id ? '#ef4444' : '#9ca3af',
                            }}
                            title="Remover variação"
                        >×</span>
                    )}
                </div>
            ))}
            <button 
                onClick={addVariant} 
                style={{ 
                    border: '1px dashed #94a3b8',
                    borderRadius: '8px', 
                    padding: '8px 16px', 
                    background: 'transparent', 
                    color: '#64748b',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                }}
            >
                + Nova Variação
            </button>
        </div>
        <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: 4 }}>
            * Dica: Clique duas vezes no nome da aba para renomear.
        </div>
      </div>

      {/* Refeições */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {meals.map((m, mi) => (
            <div
              key={mi}
              className="form-card"
              style={{ padding: 0, overflow: 'visible', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}
              draggable
              onDragStart={() => setDragIndex(mi)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragIndex !== null && dragIndex !== mi) reorderMeals(dragIndex, mi)
                setDragIndex(null)
              }}
            >
              {/* Header da Refeição */}
              <div style={{ background: '#f8fafc', padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'center', flex: 1 }}>
                      <div style={{ 
                          width: 32, height: 32, background: '#3b82f6', color: '#fff', 
                          borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 
                      }}>{mi + 1}</div>
                      
                      <div style={{ display: 'flex', gap: 12, flex: 1 }}>
                        <input 
                            className="input" 
                            style={{ flex: 1, fontWeight: 600, fontSize: '1.05em', border: '1px solid transparent', background: 'transparent' }} 
                            value={m.title} 
                            onChange={(e) => updateMeal(mi, { title: e.target.value })} 
                            placeholder="Nome da Refeição (ex: Café da Manhã)"
                            onFocus={(e) => e.target.style.background = '#fff'}
                            onBlur={(e) => e.target.style.background = 'transparent'}
                        />
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <span style={{ fontSize: '0.85em', color: '#64748b', fontWeight: 600 }}>Horário:</span>
                            <input
                                type="time"
                                className="input"
                                style={{ width: 110, textAlign: 'center', border: '1px solid #cbd5e1', background: '#fff', fontWeight: 600, padding: '6px' }}
                                value={m.time}
                                onChange={(e) => updateMeal(mi, { time: e.target.value })} 
                            />
                        </div>
                      </div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: 8, marginLeft: 16 }}>
                      <button className="btn" style={{ padding: 6, background: '#f1f5f9', color: '#64748b' }} onClick={() => reorderMeals(mi, mi - 1)} disabled={mi === 0} title="Subir">↑</button>
                      <button className="btn" style={{ padding: 6, background: '#f1f5f9', color: '#64748b' }} onClick={() => reorderMeals(mi, mi + 1)} disabled={mi === meals.length - 1} title="Descer">↓</button>
                      <button className="btn" style={{ padding: 6, background: '#f1f5f9', color: '#ef4444' }} onClick={() => removeMeal(mi)} title="Remover">✕</button>
                  </div>
              </div>

              <div style={{ padding: 20 }}>
                {/* Tabela de Alimentos */}
                <div style={{ display: 'grid', gridTemplateColumns: '3fr 0.8fr 0.6fr 0.7fr 0.5fr 0.5fr 0.5fr 0.5fr 40px', gap: 8, marginBottom: 8, padding: '0 8px' }}>
                    <div style={{ fontSize: '0.75em', fontWeight: 700, color: '#94a3b8' }}>ALIMENTO</div>
                    <div style={{ fontSize: '0.75em', fontWeight: 700, color: '#94a3b8' }}>QTD</div>
                    <div style={{ fontSize: '0.75em', fontWeight: 700, color: '#94a3b8' }}>UNID</div>
                    <div style={{ fontSize: '0.75em', fontWeight: 700, color: '#94a3b8' }} title="Calorias">KCAL</div>
                    <div style={{ fontSize: '0.75em', fontWeight: 700, color: '#94a3b8' }} title="Proteína">P</div>
                    <div style={{ fontSize: '0.75em', fontWeight: 700, color: '#94a3b8' }} title="Carboidrato">C</div>
                    <div style={{ fontSize: '0.75em', fontWeight: 700, color: '#94a3b8' }} title="Gordura">G</div>
                    <div style={{ fontSize: '0.75em', fontWeight: 700, color: '#94a3b8' }} title="Sódio (mg)">SOD</div>
                    <div></div>
                </div>

                {m.foods.map((f, fi) => (
                    <div key={fi} style={{ marginBottom: 12, padding: '8px', background: '#fff', borderRadius: 8, border: '1px solid #f1f5f9' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '3fr 0.8fr 0.6fr 0.7fr 0.5fr 0.5fr 0.5fr 0.5fr 40px', gap: 8, alignItems: 'center' }}>
                            <FoodAutocomplete 
                                className="input" 
                                style={{ width: '100%', minWidth: 0 }} 
                                placeholder="Ex: Arroz Branco" 
                                value={f.name} 
                                onChange={(val) => updateFood(mi, fi, { name: val })}
                                onSelect={(details) => updateFood(mi, fi, {
                                    name: details.name,
                                    food_id: details.food_id,
                                    base_calories_100g: String(details.calories_100g || 0),
                                    base_protein_100g: String(details.protein_100g || 0),
                                    base_carbs_100g: String(details.carbs_100g || 0),
                                    base_fat_100g: String(details.fat_100g || 0),
                                    base_sodium_100g: String(details.sodium_100g || 0),
                                    base_unit_weight: details.unit_weight,
                                    unit: details.unit_weight ? 'unid' : 'g',
                                    quantity: details.unit_weight ? '1' : '100'
                                })}
                            />
                            <input className="input" style={{ width: '100%', minWidth: 0 }} placeholder="100" value={f.quantity} onChange={(e) => updateFood(mi, fi, { quantity: e.target.value })} />
                            
                            <select 
                                className="input" 
                                style={{ width: '100%', minWidth: 0, padding: '8px 4px', background: '#fff' }} 
                                value={f.unit || 'g'} 
                                onChange={(e) => updateFood(mi, fi, { unit: e.target.value })}
                            >
                                <option value="g">g</option>
                                <option value="ml">ml</option>
                                <option value="unid">unid</option>
                                <option value="fatia">fatia</option>
                                <option value="colher">colher</option>
                                <option value="scoop">scoop</option>
                            </select>
                            
                            {/* Macros Readonly */}
                            <input className="input" style={{ background: '#f8fafc', color: '#64748b', fontSize: '0.85em', padding: 4, textAlign: 'center', cursor: 'default' }} readOnly value={f.calories || '-'} />
                            <input className="input" style={{ background: '#f0fdf4', color: '#166534', fontSize: '0.85em', padding: 4, textAlign: 'center', cursor: 'default' }} readOnly value={f.protein || '-'} />
                            <input className="input" style={{ background: '#eff6ff', color: '#1e40af', fontSize: '0.85em', padding: 4, textAlign: 'center', cursor: 'default' }} readOnly value={f.carbs || '-'} />
                            <input className="input" style={{ background: '#fff7ed', color: '#9a3412', fontSize: '0.85em', padding: 4, textAlign: 'center', cursor: 'default' }} readOnly value={f.fat || '-'} />
                            <input className="input" style={{ background: '#f5f5f5', color: '#555', fontSize: '0.85em', padding: 4, textAlign: 'center', cursor: 'default' }} readOnly value={f.sodium || '-'} />

                            <button onClick={() => removeFood(mi, fi)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
                        </div>
                        
                        {/* Substitutos */}
                        {(f.substitutes || []).map((s, si) => (
                            <div key={si} style={{ display: 'flex', gap: 10, marginTop: 8, alignItems: 'center', paddingLeft: 20 }}>
                                <div style={{ color: '#cbd5e1' }}>↳</div>
                                <div style={{ flex: 3 }}>
                                    <FoodAutocomplete 
                                        className="input" 
                                        style={{ width: '100%', minWidth: 0, fontSize: '0.9em', background: '#f8fafc' }} 
                                        placeholder="Buscar Substituto..." 
                                        value={s.name} 
                                        onChange={(val) => updateSubstitute(mi, fi, si, { name: val })}
                                        onSelect={(details) => updateSubstitute(mi, fi, si, {
                                            name: details.name,
                                            unit: details.unit_weight ? 'unid' : 'g',
                                            quantity: details.unit_weight ? '1' : '100'
                                        })}
                                    />
                                </div>
                                <input className="input" style={{ flex: 1, fontSize: '0.9em', background: '#f8fafc' }} placeholder="Qtd" value={s.quantity} onChange={(e) => updateSubstitute(mi, fi, si, { quantity: e.target.value })} />
                                <input className="input" style={{ flex: 1, fontSize: '0.9em', background: '#f8fafc' }} placeholder="Unid" value={s.unit} onChange={(e) => updateSubstitute(mi, fi, si, { unit: e.target.value })} />
                                <button onClick={() => removeSubstitute(mi, fi, si)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.8em', padding: '0 8px' }}>✕</button>
                            </div>
                        ))}
                        
                        <div style={{ marginTop: 6, display: 'flex', gap: 12 }}>
                            <button onClick={() => addSubstitute(mi, fi)} style={{ background: 'transparent', border: 'none', color: '#3b82f6', fontSize: '0.8em', cursor: 'pointer', textDecoration: 'underline' }}>+ Adicionar Substituto</button>
                        </div>
                    </div>
                ))}
                
                <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button className="btn" onClick={() => addFood(mi)} style={{ background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1' }}>+ Adicionar Alimento</button>
                    <div style={{ flex: 1, marginLeft: 20 }}>
                        <input className="input" style={{ width: '100%', fontSize: '0.9em' }} value={m.notes || ''} onChange={(e) => updateMeal(mi, { notes: e.target.value })} placeholder="Observações desta refeição..." />
                    </div>
                </div>

                {/* Ações da Refeição */}
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #f1f5f9', display: 'flex', gap: 10 }}>
                     <button className="btn" onClick={() => duplicateMeal(mi)} style={{ fontSize: '0.85em', padding: '6px 12px' }}>Duplicar Refeição</button>
                     <button className="btn" onClick={() => addMealAfter(mi)} style={{ fontSize: '0.85em', padding: '6px 12px', background: '#10b981' }}>+ Refeição Abaixo</button>
                </div>
              </div>
            </div>
          ))}

          <button className="btn" onClick={addMeal} style={{ padding: '16px', background: '#fff', border: '2px dashed #cbd5e1', color: '#64748b', fontSize: '1.1em' }}>
            + Adicionar Nova Refeição
          </button>
      </div>

      {/* Suplementos */}
      <div className="form-card" style={{ padding: 20, marginTop: 24 }}>
        <h3 style={{ marginTop: 0, marginBottom: 16, color: '#1e293b' }}>Suplementação</h3>
        <div style={{ display: 'grid', gap: 12 }}>
            {supplements.map((s, si) => (
                <div key={si} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 2fr 40px', gap: 10, alignItems: 'center' }}>
                    <input className="input" placeholder="Suplemento" value={s.name} onChange={(e) => updateSupplement(si, { name: e.target.value })} />
                    <input className="input" placeholder="Qtd" value={s.quantity} onChange={(e) => updateSupplement(si, { quantity: e.target.value })} />
                    <input className="input" placeholder="Unid" value={s.unit} onChange={(e) => updateSupplement(si, { unit: e.target.value })} />
                    <input className="input" placeholder="Obs (opcional)" value={s.notes || ''} onChange={(e) => updateSupplement(si, { notes: e.target.value })} />
                    <button onClick={() => removeSupplement(si)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
                </div>
            ))}
            <button className="btn" onClick={addSupplement} style={{ width: 'fit-content', background: '#f1f5f9', color: '#334155' }}>+ Adicionar Suplemento</button>
        </div>
      </div>

      {/* Rodapé removido - Botões movidos para o topo */}

      {/* Modal Nova Variação */}
      {showVariantModal && (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999
        }}>
            <div className="form-card" style={{ width: '100%', maxWidth: 400, padding: 20 }}>
                <div className="form-title" style={{ marginBottom: 16 }}>Nova Variação de Dieta</div>
                <label className="label">
                    Nome (ex: Dia de Treino)
                    <input 
                        className="input" 
                        value={newVariantName} 
                        onChange={e => setNewVariantName(e.target.value)}
                        autoFocus
                        placeholder="Digite o nome..."
                        onKeyDown={e => e.key === 'Enter' && confirmAddVariant()}
                    />
                </label>
                <div className="form-actions" style={{ marginTop: 20 }}>
                    <button className="btn" onClick={confirmAddVariant} disabled={!newVariantName.trim()}>Criar</button>
                    <button className="btn" style={{ background: '#e5e7eb', color: '#374151' }} onClick={() => setShowVariantModal(false)}>Cancelar</button>
                </div>
            </div>
        </div>
      )}

      {/* Hidden Printable Area (Mantida igual para não quebrar o PDF) */}
      <div ref={printRef} style={{ position: 'absolute', left: -9999, top: 0, width: '210mm', minHeight: '297mm', background: '#fff', padding: '15mm', color: '#000', fontFamily: 'Arial, sans-serif' }}>
        {/* ...Conteúdo do PDF mantido... */}
        {logoUrl && (
            <div style={{ textAlign: 'center', marginBottom: 30 }}>
                <img src={logoUrl} style={{ maxHeight: '220px', objectFit: 'contain' }} crossOrigin="anonymous" />
            </div>
        )}
        <h1 style={{ textAlign: 'center', marginBottom: 5, fontSize: '24px', background: '#1e3a8a', color: '#fff', padding: '12px', borderRadius: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
            {name}
        </h1>
        <div style={{ textAlign: 'center', marginBottom: 25, color: '#4b5563', fontSize: '18px', marginTop: 10, fontWeight: 600 }}>
            {variants.find(v => v.id === activeVariantId)?.name}
        </div>
        {(goal || startDate || endDate) && (
            <div style={{ marginBottom: 30, display: 'flex', gap: 20, justifyContent: 'center', fontSize: '14px', color: '#444', borderBottom: '1px solid #e5e7eb', paddingBottom: 20 }}>
                {goal && <div><strong>Objetivo:</strong> {goal}</div>}
                {startDate && <div><strong>Início:</strong> {new Date(startDate).toLocaleDateString()}</div>}
                {endDate && <div><strong>Fim:</strong> {new Date(endDate).toLocaleDateString()}</div>}
            </div>
        )}
        {notes && (
            <div style={{ marginBottom: 30, fontStyle: 'italic', background: '#f8fafc', padding: 15, borderRadius: 8, borderLeft: '4px solid #1e3a8a' }}>
                {notes}
            </div>
        )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 25 }}>
                    {/* (Removido Resumo Geral do Topo - Mover para o Fim) */}

                    {meals.map((m, i) => {
                        // Calcula totais da refeição
                        const mealTotals = m.foods.reduce((acc, f) => {
                            acc.kcal += Number(f.calories || 0)
                            acc.p += Number(f.protein || 0)
                            acc.c += Number(f.carbs || 0)
                            acc.g += Number(f.fat || 0)
                            acc.s += Number(f.sodium || 0)
                            return acc
                        }, { kcal: 0, p: 0, c: 0, g: 0, s: 0 })

                        return (
                            <div key={i} style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden', breakInside: 'avoid', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                                <div style={{ background: '#1e3a8a', color: '#fff', padding: '10px 15px', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '16px', textTransform: 'uppercase' }}>{m.title || `Refeição ${i+1}`}</span>
                                    <span style={{ fontSize: '15px', fontWeight: 500 }}>{m.time}</span>
                                </div>
                                <div style={{ padding: '15px' }}>
                                    {m.foods.map((f, fi) => (
                                        <div key={fi} style={{ marginBottom: 10, fontSize: '15px', borderBottom: fi < m.foods.length - 1 ? '1px solid #f1f5f9' : 'none', paddingBottom: fi < m.foods.length - 1 ? 10 : 0 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <strong style={{ fontWeight: 700, color: '#1e293b' }}>{f.name}</strong>
                                                <span style={{ fontWeight: 600 }}>{f.quantity && `${f.quantity} ${f.unit}`}</span>
                                            </div>
                                            {f.calories && (
                                                <div style={{ fontSize: '12px', color: '#64748b', marginTop: 2 }}>
                                                    {f.calories}kcal &nbsp; P:{f.protein}g &nbsp; C:{f.carbs}g &nbsp; G:{f.fat}g &nbsp; SOD:{f.sodium || 0}mg
                                                </div>
                                            )}
                                            {(f.substitutes || []).map((s, si) => (
                                                <div key={si} style={{ marginLeft: 15, marginTop: 4, color: '#64748b', fontSize: '0.9em', display: 'flex', alignItems: 'center' }}>
                                                    <span style={{ marginRight: 5 }}>↳</span> ou {s.name} - {s.quantity} {s.unit}
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            {/* Rodapé da Refeição com Totais - Estilo Reforçado para PDF */}
                            <div style={{ backgroundColor: '#f0f9ff', padding: '10px 15px', borderTop: '2px solid #e2e8f0', fontSize: '12px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', color: '#334155', fontWeight: 'bold', fontFamily: 'Arial, sans-serif' }}>
                                <span style={{ marginRight: 15, textTransform: 'uppercase', fontSize: '11px', color: '#64748b' }}>Total Refeição:</span>
                                <span style={{ color: '#1e3a8a', marginRight: 12 }}>{Math.round(mealTotals.kcal)} kcal</span>
                                <span style={{ color: '#166534', marginRight: 12 }}>P: {mealTotals.p.toFixed(1)}g</span>
                                <span style={{ color: '#1e40af', marginRight: 12 }}>C: {mealTotals.c.toFixed(1)}g</span>
                                <span style={{ color: '#9a3412', marginRight: 12 }}>G: {mealTotals.g.toFixed(1)}g</span>
                                <span style={{ color: '#475569' }}>SOD: {Math.round(mealTotals.s)}mg</span>
                            </div>
                                {m.notes && (
                                    <div style={{ padding: '10px 15px', background: '#fff', borderTop: '1px solid #e2e8f0', fontSize: '13px', color: '#475569', fontStyle: 'italic' }}>
                                        <strong>Obs:</strong> {m.notes}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>

                {/* Resumo Nutricional Geral (Ao final) */}
                <div style={{ marginTop: 30, breakInside: 'avoid', borderTop: '3px solid #1e3a8a', paddingTop: 20 }}>
                     <h3 style={{ margin: '0 0 15px 0', color: '#1e3a8a', fontSize: '18px', textTransform: 'uppercase' }}>Resumo Diário Total</h3>
                     
                     {/* Tabela de Resumo Total (Mais robusto para PDF) */}
                     {(() => {
                         const total = meals.reduce((acc, m) => {
                             m.foods.forEach(f => {
                                 acc.kcal += Number(f.calories || 0)
                                 acc.p += Number(f.protein || 0)
                                 acc.c += Number(f.carbs || 0)
                                 acc.g += Number(f.fat || 0)
                                 acc.s += Number(f.sodium || 0)
                             })
                             return acc
                         }, { kcal: 0, p: 0, c: 0, g: 0, s: 0 })

                         return (
                            <div style={{ display: 'flex', width: '100%', background: '#f0f9ff', borderRadius: 8, border: '1px solid #bfdbfe', overflow: 'hidden' }}>
                                <div style={{ flex: 1, textAlign: 'center', padding: '15px 5px', borderRight: '1px solid #cbd5e1' }}>
                                    <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#334155', marginBottom: 5 }}>CALORIAS</div>
                                    <div style={{ color: '#1e3a8a', fontSize: '1.6em', fontWeight: 800 }}>{Math.round(total.kcal)}</div>
                                    <div style={{ fontSize: '12px', color: '#64748b' }}>kcal</div>
                                </div>
                                <div style={{ flex: 1, textAlign: 'center', padding: '15px 5px', borderRight: '1px solid #cbd5e1' }}>
                                    <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#334155', marginBottom: 5 }}>PROTEÍNA</div>
                                    <div style={{ color: '#166534', fontSize: '1.6em', fontWeight: 800 }}>{total.p.toFixed(0)}g</div>
                                </div>
                                <div style={{ flex: 1, textAlign: 'center', padding: '15px 5px', borderRight: '1px solid #cbd5e1' }}>
                                    <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#334155', marginBottom: 5 }}>CARBOIDRATO</div>
                                    <div style={{ color: '#1e40af', fontSize: '1.6em', fontWeight: 800 }}>{total.c.toFixed(0)}g</div>
                                </div>
                                <div style={{ flex: 1, textAlign: 'center', padding: '15px 5px', borderRight: '1px solid #cbd5e1' }}>
                                    <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#334155', marginBottom: 5 }}>GORDURA</div>
                                    <div style={{ color: '#9a3412', fontSize: '1.6em', fontWeight: 800 }}>{total.g.toFixed(0)}g</div>
                                </div>
                                <div style={{ flex: 1, textAlign: 'center', padding: '15px 5px' }}>
                                    <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#334155', marginBottom: 5 }}>SÓDIO</div>
                                    <div style={{ color: '#555', fontSize: '1.6em', fontWeight: 800 }}>{Math.round(total.s)}mg</div>
                                </div>
                            </div>
                         )
                     })()}
                </div>
        {supplements.length > 0 && (
            <div style={{ marginTop: 30, breakInside: 'avoid' }}>
                <h3 style={{ borderBottom: '2px solid #e5e7eb', paddingBottom: 8, marginBottom: 15, fontSize: '18px' }}>Suplementação</h3>
                <div style={{ display: 'grid', gap: 10 }}>
                    {supplements.map((s, si) => (
                        <div key={si} style={{ fontSize: '14px', padding: '8px', background: '#f9fafb', borderRadius: 6 }}>
                            • <strong>{s.name}</strong> - {s.quantity} {s.unit}
                            {s.notes && <span style={{ color: '#666' }}> ({s.notes})</span>}
                        </div>
                    ))}
                </div>
            </div>
        )}
        {/* Rodapé removido */}
      </div>
    </div>
  )
}
