
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

    const controllerRef = useRef<AbortController | null>(null)

    const searchWeb = async (text: string) => {
        setLoading(true)
        if (controllerRef.current) controllerRef.current.abort()
        controllerRef.current = new AbortController()

        try {
            // Nova API: FatSecret via Supabase Edge Function
            const { data, error } = await supabase.functions.invoke('fatsecret-proxy', {
                body: { 
                    method: 'foods.search',
                    search_expression: text,
                    max_results: 50 // Mudado para 50
                }
            })

            if (error) throw error

            // O FatSecret pode retornar um objeto único se houver só 1 resultado, ou nada se não achar
            if (!data.foods || !data.foods.food) {
                setSuggestions([])
                setErrorMsg('Nenhum alimento encontrado na Web para este termo.')
                return
            }

            const response = data.foods.food
            const products = Array.isArray(response) ? response : [response]
            
            let apiMatches = products.map((p: any) => ({
                food_id: p.food_id,
                food_name: p.food_name,
                food_description: p.food_description || '',
                _raw: p 
            }))

            setSuggestions(prev => {
                const term = text.toLowerCase()
                const validLocals = commonFoods
                    .filter(f => f.name.toLowerCase().includes(term))
                    .map(f => ({
                        food_id: f.id,
                        food_name: f.name,
                        food_description: 'Alimento Natural / Básico',
                        _local: f
                    }))
                    .slice(0, 10)

                return [...validLocals, ...apiMatches]
            })
        } catch (err: any) {
            if (err.name === 'AbortError') return 
            console.error('Erro na busca FatSecret:', err)
            // Se for erro real da API, mostra algo amigável.
            setErrorMsg('Não foi possível conectar ao banco de alimentos no momento.')
        } finally {
            setLoading(false)
        }
    }

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

        // OTIMIZAÇÃO: Se já encontrou muitos resultados locais (>= 5), não busca na API automaticamente
        if (localMatches.length >= 5) {
            setLoading(false)
            return
        }

        timeoutRef.current = setTimeout(() => searchWeb(text), 600) 
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

            // B. Se é FatSecret (Web)
            if ((item as any)._raw) {
                // Precisamos fazer uma segunda chamada para pegar os macros detalhados do alimento selecionado
                const { data: detailData, error } = await supabase.functions.invoke('fatsecret-proxy', {
                    body: { 
                        method: 'food.get',
                        food_id: item.food_id
                    }
                })

                if (error || !detailData?.food?.servings?.serving) throw new Error('Falha ao obter detalhes do FatSecret')

                const servings = detailData.food.servings.serving
                // Se for array, pega o primeiro, senão pega o objeto direto
                const serving = Array.isArray(servings) ? servings[0] : servings

                // Converte os valores (FatSecret retorna strings como "10.5")
                const calories = parseFloat(serving.calories || '0')
                const protein = parseFloat(serving.protein || '0')
                const carbs = parseFloat(serving.carbohydrate || '0')
                const fat = parseFloat(serving.fat || '0')
                const sodiumMg = parseFloat(serving.sodium || '0') // FatSecret já retorna em mg
                
                // Tenta achar peso da porção para padronizar para 100g se necessário, 
                // mas vamos enviar o valor base que o FatSecret deu e deixar o usuário ajustar.
                // O ideal seria pegar a porção de 100g se existir, mas vamos simplificar pegando a primeira disponível
                let metricQty = parseFloat(serving.metric_serving_amount || '100')
                
                // Normaliza para 100g
                const ratio = 100 / metricQty

                const macros = {
                    food_id: item.food_id,
                    name: item.food_name,
                    calories_100g: Number((calories * ratio).toFixed(1)),
                    protein_100g: Number((protein * ratio).toFixed(1)),
                    carbs_100g: Number((carbs * ratio).toFixed(1)),
                    fat_100g: Number((fat * ratio).toFixed(1)),
                    sodium_100g: Number((sodiumMg * ratio).toFixed(1)),
                    source: 'fatsecret',
                    unit_weight: metricQty
                }
                onSelect(macros)
                return
            }

        } catch (err) {
            console.error('Erro ao selecionar alimento:', err)
            alert('Erro ao carregar detalhes do alimento')
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault()
            setShowSuggestions(false)
            // Se apertar Enter sem selecionar nada, o valor digitado fica
        }
        if (e.key === 'Escape') {
            setShowSuggestions(false)
        }
    }

    return (
        <div ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
            <input
                className={className}
                style={style}
                value={value}
                onChange={(e) => handleSearch(e.target.value)}
                onKeyDown={handleKeyDown}
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

                    {!loading && !errorMsg && Array.isArray(suggestions) && suggestions.map((s) => (
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

                    {!loading && value.length >= 2 && (
                        <div 
                            onClick={() => searchWeb(value)}
                            style={{ 
                                padding: '12px', textAlign: 'center', cursor: 'pointer', 
                                color: '#3b82f6', fontWeight: 600, borderTop: '1px solid #e2e8f0',
                                background: '#f8fafc', fontSize: '0.9em'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#eff6ff'}
                            onMouseLeave={(e) => e.currentTarget.style.background = '#f8fafc'}
                        >
                            🌍 Buscar "{value}" na Web
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
