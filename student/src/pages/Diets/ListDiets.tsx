import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/useAuth'
import { Utensils, ChevronRight, Clock, Info, X, ChevronDown, ChevronUp, Download } from 'lucide-react'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

// Tipos
type Food = {
  name: string
  quantity: string
  unit: string
  calories?: string
  protein?: string
  carbs?: string
  fat?: string
  sodium?: string
  notes?: string
  substitutes?: { name: string; quantity: string; unit: string }[]
}

type Meal = {
  title: string
  time: string
  foods: Food[]
  notes?: string
}

type Variant = {
    id: string
    name: string
    meals: Meal[]
}

type Diet = {
  id: string
  title: string
  data: {
    goal?: string
    notes?: string
    meals: Meal[]
    variants?: Variant[]
    supplements?: Food[]
  }
  updated_at: string
}

export default function ListDiets() {
  const { user } = useAuth()
  const [diets, setDiets] = useState<Diet[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDiet, setSelectedDiet] = useState<Diet | null>(null)
  
  // Estado para controlar qual variante está sendo visualizada (padrão 'default' ou id da variante)
  const [activeVariant, setActiveVariant] = useState<string>('default')
  // Estado para acordeão de refeições (índices abertos)
  const [openMeals, setOpenMeals] = useState<number[]>([])
  
  // Bloqueio de inativos
  const [isBlocked, setIsBlocked] = useState(false)
  
  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (user) loadDiets()
  }, [user])

  async function loadDiets() {
    try {
        setLoading(true)
        
        // 1. Busca perfil para ver IDs vinculados
        const { data: profile } = await supabase
            .from('profiles')
            .select('data')
            .eq('id', user?.id)
            .single()
        
        const status = profile?.data?.status || 'ativo'
        if (status !== 'ativo' && status !== 'active') {
            setIsBlocked(true)
            setLoading(false)
            return
        }

        const linkedIds = profile?.data?.dietIds || []

        // 2. Monta query
        let query = supabase
            .from('protocols')
            .select('*')
            .eq('type', 'diet')
            .eq('status', 'active')
        
        if (linkedIds.length > 0) {
            query = query.or(`student_id.eq.${user?.id},id.in.(${linkedIds.join(',')})`)
        } else {
            query = query.eq('student_id', user?.id)
        }

        const { data, error } = await query

        if (error) throw error
        
        const sorted = (data || []).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        setDiets(sorted)

    } catch (error) {
        console.error('Erro ao carregar dietas:', error)
    } finally {
        setLoading(false)
    }
  }

  const handleOpenDiet = (d: Diet) => {
    setSelectedDiet(d)
    setActiveVariant('default')
    setOpenMeals([0, 1, 2, 3, 4, 5, 6]) // Abre todas por padrão para facilitar visualização
  }

  const handleClose = () => {
    setSelectedDiet(null)
  }

  const toggleMeal = (index: number) => {
    setOpenMeals(prev => 
        prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    )
  }

  // Define quais refeições exibir com base na variante selecionada
  // Se activeVariant for 'default', tenta pegar a primeira variante disponível OU as refeições da raiz
  const currentMeals = selectedDiet 
    ? (() => {
        if (activeVariant === 'default') {
            // Se tiver variantes, pega a primeira como padrão visual
            if (selectedDiet.data.variants && selectedDiet.data.variants.length > 0) {
                return selectedDiet.data.variants[0].meals
            }
            // Senão, pega as da raiz (compatibilidade antiga)
            return selectedDiet.data.meals
        }
        // Se selecionou uma variante específica
        const v = selectedDiet.data.variants?.find(v => v.id === activeVariant)
        return v ? v.meals : []
    })()
    : []

  const exportPDF = async () => {
      if (!printRef.current || !selectedDiet) return
      
      try {
          // Detecta se é mobile para ajustar escala e evitar crash
          const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
          const scale = isMobile ? 1.5 : 2

          const canvas = await html2canvas(printRef.current, { 
              scale: scale,
              useCORS: true,
              allowTaint: true,
              logging: false,
              windowWidth: 794, // A4 width in px at 96dpi approx
          })
          
          const imgData = canvas.toDataURL('image/jpeg', 0.95) // JPEG is lighter than PNG
          
          const pdf = new jsPDF('p', 'mm', 'a4')
          const pdfWidth = pdf.internal.pageSize.getWidth()
          const pdfHeight = pdf.internal.pageSize.getHeight()
          const imgWidth = pdfWidth
          const imgHeight = (canvas.height * imgWidth) / canvas.width
          
          let heightLeft = imgHeight
          let position = 0

          pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight)
          heightLeft -= pdfHeight

          while (heightLeft > 0) {
            position = heightLeft - imgHeight
            pdf.addPage()
            pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight)
            heightLeft -= pdfHeight
          }
          
          // Nome do arquivo sanitizado
          const fileName = `Dieta_${selectedDiet.title.replace(/[^a-z0-9]/gi, '_')}.pdf`
          
          // Salva o PDF
          pdf.save(fileName)

      } catch (err) {
          console.error('Erro ao gerar PDF:', err)
          alert('Não foi possível gerar o PDF. Tente novamente.')
      }
  }

  // Efeito para garantir que ao abrir, selecione a primeira variante se existir
  useEffect(() => {
      if (selectedDiet && selectedDiet.data.variants && selectedDiet.data.variants.length > 0) {
          // Se acabou de abrir e está 'default', seta para o ID da primeira variante real
          if (activeVariant === 'default') {
              setActiveVariant(selectedDiet.data.variants[0].id)
          }
      }
  }, [selectedDiet])

  if (loading) return <div style={{ padding: 24 }}>Carregando dietas...</div>

  if (isBlocked) {
      return (
          <div style={{ padding: 40, textAlign: 'center', marginTop: 60 }}>
              <div style={{ background: '#fef2f2', padding: 32, borderRadius: 24, border: '1px solid #fee2e2' }}>
                  <div style={{ background: '#fee2e2', width: 64, height: 64, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px auto' }}>
                      <X size={32} color="#dc2626" />
                  </div>
                  <h2 style={{ color: '#991b1b', marginBottom: 12 }}>Acesso Bloqueado</h2>
                  <p style={{ color: '#b91c1c', lineHeight: 1.6 }}>
                      Sua conta está inativa no momento.<br/>
                      Entre em contato com seu personal trainer para regularizar seu acesso à dieta.
                  </p>
              </div>
          </div>
      )
  }

  return (
    <>
      <div style={{ padding: 24 }}>
        <header style={{ marginBottom: 32 }}>
            <h1 style={{ fontSize: '1.8rem', color: '#0f172a', marginBottom: 8 }}>Minhas Dietas</h1>
            <p style={{ color: '#64748b' }}>Seus planos alimentares ativos.</p>
        </header>

        {diets.length === 0 ? (
            <div style={{ background: '#fff', padding: 48, borderRadius: 16, border: '1px solid #e2e8f0', textAlign: 'center' }}>
                <div style={{ background: '#f0fdf4', width: 64, height: 64, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto' }}>
                    <Utensils size={32} color="#16a34a" />
                </div>
                <h3 style={{ color: '#0f172a', marginBottom: 8 }}>Nenhuma dieta encontrada</h3>
                <p style={{ color: '#64748b' }}>Seu personal ainda não atribuiu uma dieta para você.</p>
            </div>
        ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 24 }}>
                {diets.map(d => (
                    <div 
                        key={d.id}
                        onClick={() => handleOpenDiet(d)}
                        style={{ 
                            background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', 
                            overflow: 'hidden', cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s'
                        }}
                        onMouseEnter={e => {
                            e.currentTarget.style.transform = 'translateY(-4px)'
                            e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.transform = 'translateY(0)'
                            e.currentTarget.style.boxShadow = 'none'
                        }}
                    >
                        <div style={{ padding: 24 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                                <div style={{ background: '#f0fdf4', padding: 12, borderRadius: 12 }}>
                                    <Utensils size={24} color="#16a34a" />
                                </div>
                                <span style={{ background: '#dcfce7', color: '#166534', fontSize: '0.75rem', fontWeight: 700, padding: '4px 10px', borderRadius: 20 }}>
                                    ATIVA
                                </span>
                            </div>
                            <h3 style={{ margin: '0 0 8px 0', color: '#0f172a', fontSize: '1.2rem' }}>{d.title}</h3>
                            {d.data.goal && <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>Objetivo: {d.data.goal}</p>}
                            
                            <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', fontSize: '0.9rem' }}>
                                <span>{d.data.meals?.length || 0} refeições</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#16a34a', fontWeight: 600 }}>
                                    Ver Detalhes <ChevronRight size={16} />
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        )}

        {/* Modal de Detalhes */}
        {selectedDiet && (
            <div style={{ 
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
                background: 'rgba(0,0,0,0.5)', zIndex: 2000, 
                display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 24
            }} onClick={handleClose}>
                <div 
                    onClick={e => e.stopPropagation()}
                    style={{ 
                        background: '#fff', width: '100%', maxWidth: 600, maxHeight: '90vh', 
                        borderRadius: 24, overflow: 'hidden', display: 'flex', flexDirection: 'column',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
                    }}
                >
                    <div className="diet-modal-header">
                        <div style={{ width: '100%' }}>
                            <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#0f172a', lineHeight: 1.2 }}>{selectedDiet.title}</h2>
                            {selectedDiet.data.goal && <p style={{ margin: '8px 0 0 0', color: '#64748b', lineHeight: 1.4 }}>{selectedDiet.data.goal}</p>}
                        </div>
                        <div className="diet-modal-header-actions" style={{ display: 'flex', gap: 12, marginTop: '10px' }}>
                            <button onClick={exportPDF} style={{ background: '#f1f5f9', border: 'none', padding: '8px 16px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: '#64748b', fontWeight: 600 }}>
                                <Download size={18} /> Exportar PDF
                            </button>
                            <button onClick={handleClose} style={{ background: '#f1f5f9', border: 'none', width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}>
                                <X size={20} />
                            </button>
                        </div>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', padding: 32 }}>
                        
                        {/* Seletor de Variantes (se houver) */}
                        {selectedDiet.data.variants && selectedDiet.data.variants.length > 0 && (
                            <div style={{ marginBottom: 24 }}>
                                <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8 }}>
                                    {/* Botão Padrão removido, mostra apenas as variantes cadastradas */}
                                    {selectedDiet.data.variants.map(v => (
                                        <button 
                                            key={v.id}
                                            onClick={() => setActiveVariant(v.id)}
                                            style={{
                                                padding: '10px 18px', borderRadius: 12, border: activeVariant === v.id ? '2px solid #16a34a' : '2px solid #e2e8f0',
                                                background: activeVariant === v.id ? '#f0fdf4' : '#fff',
                                                color: activeVariant === v.id ? '#166534' : '#64748b',
                                                fontWeight: activeVariant === v.id ? 700 : 500, 
                                                cursor: 'pointer', whiteSpace: 'nowrap',
                                                boxShadow: activeVariant === v.id ? '0 4px 6px -1px rgba(22, 163, 74, 0.1)' : 'none',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            {v.name}
                                        </button>
                                    ))}
                                </div>
                                <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '8px 0 0 0', fontStyle: 'italic' }}>
                                    Selecione acima a variação da dieta para ver as refeições correspondentes.
                                </p>
                            </div>
                        )}

                        {selectedDiet.data.notes && (
                            <div style={{ background: '#fffbeb', padding: 16, borderRadius: 12, border: '1px solid #fcd34d', marginBottom: 24, color: '#92400e', fontSize: '0.95rem' }}>
                                <strong>Notas do Personal:</strong> {selectedDiet.data.notes}
                            </div>
                        )}

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            {currentMeals.map((meal, i) => {
                                const isOpen = openMeals.includes(i)
                                
                                // Calcula totais da refeição
                                const mealTotals = meal.foods.reduce((acc, f) => {
                                    acc.kcal += Number(f.calories || 0)
                                    acc.p += Number(f.protein || 0)
                                    acc.c += Number(f.carbs || 0)
                                    acc.g += Number(f.fat || 0)
                                    acc.s += Number(f.sodium || 0)
                                    return acc
                                }, { kcal: 0, p: 0, c: 0, g: 0, s: 0 })

                                return (
                                    <div key={i} style={{ border: '1px solid #e2e8f0', borderRadius: 16, overflow: 'hidden' }}>
                                        <div 
                                            onClick={() => toggleMeal(i)}
                                            style={{ 
                                                background: '#f8fafc', padding: '16px 20px', borderBottom: isOpen ? '1px solid #e2e8f0' : 'none', 
                                                display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' 
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                <div style={{ background: '#dcfce7', width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16a34a', fontWeight: 700, fontSize: '0.9rem' }}>
                                                    {i + 1}
                                                </div>
                                                <div>
                                                    <h4 style={{ margin: 0, color: '#0f172a', fontSize: '1rem' }}>{meal.title}</h4>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#64748b', fontSize: '0.85rem', marginTop: 2 }}>
                                                        <Clock size={14} /> {meal.time}
                                                    </div>
                                                </div>
                                            </div>
                                            {isOpen ? <ChevronUp size={20} color="#94a3b8" /> : <ChevronDown size={20} color="#94a3b8" />}
                                        </div>
                                        
                                        {isOpen && (
                                            <div style={{ padding: 20 }}>
                                                {meal.notes && (
                                                    <p style={{ margin: '0 0 16px 0', fontSize: '0.9rem', color: '#64748b', fontStyle: 'italic' }}>
                                                        Obs: {meal.notes}
                                                    </p>
                                                )}
                                                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 12 }}>
                                                    {meal.foods.map((food, fIndex) => (
                                                        <li key={fIndex} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                            <div className="meal-food-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                                <span style={{ color: '#0f172a', fontWeight: 500 }}>{food.name}</span>
                                                                <span className="meal-food-qty" style={{ color: '#16a34a', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                                                    {food.quantity} {food.unit}
                                                                </span>
                                                            </div>
                                                            {/* Macros do Alimento */}
                                                            {food.calories && (
                                                                <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', gap: 8 }}>
                                                                    <span>{food.calories}kcal</span>
                                                                    <span>P:{food.protein}g</span>
                                                                    <span>C:{food.carbs}g</span>
                                                                    <span>G:{food.fat}g</span>
                                                                    {food.sodium && <span>Sod:{food.sodium}mg</span>}
                                                                </div>
                                                            )}

                                                            {food.notes && <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>({food.notes})</span>}
                                                            
                                                            {food.substitutes && food.substitutes.length > 0 && (
                                                                <div style={{ fontSize: '0.85rem', color: '#64748b', background: '#f1f5f9', padding: 8, borderRadius: 8, marginTop: 4 }}>
                                                                    <strong>Substituições:</strong>
                                                                    {food.substitutes.map((sub, sIndex) => (
                                                                        <div key={sIndex} style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                                                                            <span>{sub.name}</span>
                                                                            <span>{sub.quantity} {sub.unit}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </li>
                                                    ))}
                                                </ul>
                                                
                                                {/* Resumo da Refeição (Mobile Friendly) */}
                                                <div style={{ marginTop: 20, paddingTop: 15, borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 600, color: '#475569', flexWrap: 'wrap', gap: 10 }}>
                                                    <span style={{ color: '#1e3a8a' }}>{Math.round(mealTotals.kcal)} kcal</span>
                                                    <span style={{ color: '#166534' }}>P: {mealTotals.p.toFixed(1)}g</span>
                                                    <span style={{ color: '#1e40af' }}>C: {mealTotals.c.toFixed(1)}g</span>
                                                    <span style={{ color: '#9a3412' }}>G: {mealTotals.g.toFixed(1)}g</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                        
                        {/* Suplementação */}
                        {selectedDiet.data.supplements && selectedDiet.data.supplements.length > 0 && (
                            <div style={{ marginTop: 32 }}>
                                <h3 style={{ fontSize: '1.2rem', color: '#0f172a', marginBottom: 16 }}>Suplementação</h3>
                                <div style={{ background: '#fff7ed', border: '1px solid #ffedd5', borderRadius: 16, padding: 20 }}>
                                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 12 }}>
                                        {selectedDiet.data.supplements.map((sup, sIndex) => (
                                            <li key={sIndex} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div>
                                                    <span style={{ color: '#9a3412', fontWeight: 500 }}>{sup.name}</span>
                                                    {sup.notes && <div style={{ fontSize: '0.85rem', color: '#c2410c' }}>{sup.notes}</div>}
                                                </div>
                                                <span style={{ color: '#ea580c', fontWeight: 600 }}>
                                                    {sup.quantity} {sup.unit}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        )}
                    </div>

                    <div style={{ padding: 24, borderTop: '1px solid #e2e8f0', textAlign: 'center' }}>
                        <button 
                            onClick={handleClose}
                            style={{ 
                                background: '#0f172a', color: '#fff', border: 'none', 
                                padding: '12px 32px', borderRadius: 12, fontWeight: 600, cursor: 'pointer' 
                            }}
                        >
                            Fechar
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Hidden Printable Area */}
        {selectedDiet && (
            <div ref={printRef} style={{ position: 'absolute', left: -9999, top: 0, width: '210mm', minHeight: '297mm', background: '#fff', padding: '15mm', color: '#000', fontFamily: 'Arial, sans-serif' }}>
                <h1 style={{ textAlign: 'center', marginBottom: 5, fontSize: '24px', background: '#16a34a', color: '#fff', padding: '12px', borderRadius: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    {selectedDiet.title}
                </h1>
                <div style={{ textAlign: 'center', marginBottom: 25, color: '#4b5563', fontSize: '18px', marginTop: 10, fontWeight: 600 }}>
                    {activeVariant === 'default' 
                        ? (selectedDiet.data.variants && selectedDiet.data.variants.length > 0 ? selectedDiet.data.variants[0].name : 'Padrão')
                        : selectedDiet.data.variants?.find(v => v.id === activeVariant)?.name}
                </div>
                
                {selectedDiet.data.goal && (
                    <div style={{ marginBottom: 30, display: 'flex', gap: 20, justifyContent: 'center', fontSize: '14px', color: '#444', borderBottom: '1px solid #e5e7eb', paddingBottom: 20 }}>
                        <div><strong>Objetivo:</strong> {selectedDiet.data.goal}</div>
                    </div>
                )}

                {selectedDiet.data.notes && (
                    <div style={{ marginBottom: 30, fontStyle: 'italic', background: '#f8fafc', padding: 15, borderRadius: 8, borderLeft: '4px solid #16a34a' }}>
                        {selectedDiet.data.notes}
                    </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 25 }}>
                    {currentMeals.map((m, i) => {
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
                                <div style={{ background: '#16a34a', color: '#fff', padding: '10px 15px', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
                                                    {f.calories}kcal &nbsp; P:{f.protein}g &nbsp; C:{f.carbs}g &nbsp; G:{f.fat}g
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
                                {/* Rodapé da Refeição com Totais - Estilo Reforçado */}
                                <div style={{ backgroundColor: '#f0f9ff', padding: '10px 15px', borderTop: '2px solid #e2e8f0', fontSize: '12px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', color: '#334155', fontWeight: 'bold', fontFamily: 'Arial, sans-serif' }}>
                                    <span style={{ marginRight: 15, textTransform: 'uppercase', fontSize: '11px', color: '#64748b' }}>Total Refeição:</span>
                                    <span style={{ color: '#1e3a8a', marginRight: 12 }}>{Math.round(mealTotals.kcal)} kcal</span>
                                    <span style={{ color: '#166534', marginRight: 12 }}>P: {mealTotals.p.toFixed(1)}g</span>
                                    <span style={{ color: '#1e40af', marginRight: 12 }}>C: {mealTotals.c.toFixed(1)}g</span>
                                    <span style={{ color: '#9a3412', marginRight: 12 }}>G: {mealTotals.g.toFixed(1)}g</span>
                                    <span style={{ color: '#475569' }}>SOD: {Math.round(mealTotals.s)}mg</span>
                                </div>

                                {m.notes && (
                                    <div style={{ padding: '10px 15px', background: '#fff', borderTop: '1px solid #e2e8f0', fontSize: '13px', color: '#475569' }}>
                                        <strong>Obs:</strong> {m.notes}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>

                {/* Resumo Nutricional Geral (Ao final) */}
                <div style={{ marginTop: 30, breakInside: 'avoid', borderTop: '3px solid #16a34a', paddingTop: 20 }}>
                     <h3 style={{ margin: '0 0 15px 0', color: '#16a34a', fontSize: '18px', textTransform: 'uppercase' }}>Resumo Diário Total</h3>
                     
                     {/* Tabela de Resumo Total */}
                     {(() => {
                         const total = currentMeals.reduce((acc, m) => {
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
                            <div style={{ display: 'flex', width: '100%', background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0', overflow: 'hidden' }}>
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

                {selectedDiet.data.supplements && selectedDiet.data.supplements.length > 0 && (
                    <div style={{ marginTop: 30, breakInside: 'avoid' }}>
                        <h3 style={{ borderBottom: '2px solid #e5e7eb', paddingBottom: 8, marginBottom: 15, fontSize: '18px' }}>Suplementação</h3>
                        <div style={{ display: 'grid', gap: 10 }}>
                            {selectedDiet.data.supplements.map((s, si) => (
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
        )}
      </div>
    </>
  )
}
