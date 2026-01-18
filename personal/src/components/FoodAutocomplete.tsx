
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { commonFoods } from '../lib/common_foods'

type FoodSuggestion = {
    food_id: string
    food_name: string
    food_description: string
}

interface FoodDetails {
    food_id: string
    name: string
    calories_100g: number
    protein_100g: number
    carbs_100g: number
    fat_100g: number
    sodium_100g: number // mg
    source?: string
    unit_weight?: number
}

export default function FoodAutocomplete({ 
    value, onChange, onSelect, className, style, placeholder 
}: { 
    value: string
    onChange: (val: string) => void
    onSelect: (details: FoodDetails) => void
    className?: string
    style?: React.CSSProperties
    placeholder?: string
}) {
    const [suggestions, setSuggestions] = useState<FoodSuggestion[]>([])
    const [showSuggestions, setShowSuggestions] = useState(false)
    const [loading, setLoading] = useState(false)
    const wrapperRef = useRef<HTMLDivElement>(null)

    // Fechar ao clicar fora
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setShowSuggestions(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    const timeoutRef = useRef<any>(null)
    const [errorMsg, setErrorMsg] = useState('')

    const handleSearch = (text: string) => {
        onChange(text)
        setErrorMsg('')
        
        if (timeoutRef.current) clearTimeout(timeoutRef.current)

        if (text.length < 2) {
            setSuggestions([])
            setShowSuggestions(false)
            return
        }

        // 1. Busca Local (Síncrona e Instantânea)
        const term = text.toLowerCase()
        const localMatches = commonFoods
            .filter(f => f.name.toLowerCase().includes(term))
            .map(f => ({
                food_id: f.id,
                food_name: f.name,
                food_description: 'Alimento Natural / Básico',
                _local: f // Flag para identificar que é local
            }))
            // Ordena: Começa com termo > Nome menor
            .sort((a, b) => {
                const startsA = a.food_name.toLowerCase().startsWith(term)
                const startsB = b.food_name.toLowerCase().startsWith(term)
                if (startsA && !startsB) return -1
                if (!startsA && startsB) return 1
                return a.food_name.length - b.food_name.length
            })

        // Mostra resultados locais imediatamente enquanto busca na API
        setSuggestions(localMatches)
        setShowSuggestions(true)

        timeoutRef.current = setTimeout(async () => {
            setLoading(true)
            try {
                // TENTATIVA: OpenFoodFacts (Direto do Frontend, sem Proxy)
                // Ajuste de filtros para priorizar alimentos básicos e nomes simples
                // Aumentando page_size para 100 (Limite seguro para não travar a busca)
                
                const response = await fetch(`https://br.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(text)}&search_simple=1&action=process&json=1&page_size=100`)
                
                if (!response.ok) throw new Error('Erro na API OpenFoodFacts')
                
                const data = await response.json()
                let products = data.products || []
                
                let apiMatches: any[] = []

                if (products.length > 0) {
                    // Ordenação customizada API
                    products.sort((a: any, b: any) => {
                        const nameA = a.product_name || ''
                        const nameB = b.product_name || ''
                        
                        const startsA = nameA.toLowerCase().startsWith(term)
                        const startsB = nameB.toLowerCase().startsWith(term)
                        
                        // Prioridade para quem começa com o termo
                        if (startsA && !startsB) return -1
                        if (!startsA && startsB) return 1
                        
                        // Se ambos começam (ou não), ordena por tamanho (menor primeiro = mais "puro")
                        return nameA.length - nameB.length
                    })

                    apiMatches = products.map((p: any) => ({
                        food_id: p.code, 
                        food_name: p.product_name,
                        food_description: p.brands ? `${p.brands}` : '',
                        _raw: p 
                    }))
                }

                // MERGE: Locais no topo + API embaixo
                // Remove duplicatas (se o nome for idêntico, prefere o local)
                const combined = [...localMatches]
                const localNames = new Set(localMatches.map(m => m.food_name.toLowerCase()))

                apiMatches.forEach(apiItem => {
                    if (!localNames.has(apiItem.food_name.toLowerCase())) {
                        combined.push(apiItem)
                    }
                })

                if (combined.length > 0) {
                    setSuggestions(combined)
                    setShowSuggestions(true)
                } else {
                    setSuggestions([])
                    setErrorMsg('Nenhum alimento encontrado')
                    setShowSuggestions(true)
                }
            } catch (err: any) {
                console.error('Erro ao buscar alimentos:', err)
                // Se der erro na API, mantemos os locais se houver
                if (localMatches.length === 0) {
                    setErrorMsg('Erro ao buscar.')
                }
                setShowSuggestions(true)
            } finally {
                setLoading(false)
            }
        }, 500)
    }

    const handleSelect = async (item: FoodSuggestion) => {
        onChange(item.food_name)
        setShowSuggestions(false)

        try {
            // A. Se é Alimento Local (Database interna)
            if ((item as any)._local) {
                const l = (item as any)._local
                onSelect({
                    food_id: l.id,
                    name: l.name,
                    calories_100g: l.calories,
                    protein_100g: l.protein,
                    carbs_100g: l.carbs,
                    fat_100g: l.fat,
                    sodium_100g: l.sodium || 0,
                    source: 'local_db',
                    unit_weight: l.unit_weight
                })
                return
            }

            // B. Se é OpenFoodFacts
            if ((item as any)._raw) {
                const p = (item as any)._raw
                const nutriments = p.nutriments || {}
                
                // Tenta estimar peso unitário (ex: "serving_quantity": 30)
                let unitWeight: number | undefined = undefined
                if (p.serving_quantity) {
                    unitWeight = Number(p.serving_quantity)
                }

                // Sódio (sodium_100g vem em gramas na API, converter para mg)
                // Se não tiver sodium, tenta salt (sodium = salt / 2.5)
                let sodiumMg = 0
                if (nutriments.sodium_100g) {
                    sodiumMg = Number(nutriments.sodium_100g) * 1000
                } else if (nutriments.salt_100g) {
                    sodiumMg = (Number(nutriments.salt_100g) / 2.5) * 1000
                }

                const macros = {
                    food_id: item.food_id,
                    name: item.food_name,
                    calories_100g: Number(nutriments['energy-kcal_100g'] || nutriments['energy-kcal'] || 0),
                    protein_100g: Number(nutriments.proteins_100g || nutriments.proteins || 0),
                    carbs_100g: Number(nutriments.carbohydrates_100g || nutriments.carbohydrates || 0),
                    fat_100g: Number(nutriments.fat_100g || nutriments.fat || 0),
                    sodium_100g: sodiumMg,
                    source: 'openfoodfacts',
                    unit_weight: unitWeight
                }
                onSelect(macros)
                return
            }

        } catch (err) {
            console.error('Erro ao selecionar alimento:', err)
            alert('Erro ao carregar detalhes do alimento')
        }
    }

    return (
        <div ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
            <input
                className={className}
                style={style}
                value={value}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder={placeholder}
            />
            {showSuggestions && (
                <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0,
                    background: '#fff', border: '1px solid #e2e8f0', borderRadius: '0 0 8px 8px',
                    maxHeight: 200, overflowY: 'auto', zIndex: 1000, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
                }}>
                    {loading && <div style={{ padding: 10, color: '#64748b' }}>Buscando...</div>}
                    
                    {!loading && errorMsg && (
                         <div style={{ padding: 10, color: '#ef4444', fontSize: '0.9em' }}>{errorMsg}</div>
                    )}

                    {!loading && !errorMsg && suggestions.map((s) => (
                        <div
                            key={s.food_id}
                            onClick={() => handleSelect(s)}
                            style={{ padding: '10px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                            onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
                        >
                            <div style={{ fontWeight: 600, color: '#1e293b' }}>{s.food_name}</div>
                            <div style={{ fontSize: '0.75em', color: '#64748b' }}>{s.food_description}</div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
