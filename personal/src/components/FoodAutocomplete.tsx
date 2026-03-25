
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

    // Timeout maior para não metralhar a API enquanto digita a palavra inteira
    const timeoutRef = useRef<any>(null)
    const [errorMsg, setErrorMsg] = useState('')

    const controllerRef = useRef<AbortController | null>(null)

    const searchWeb = async (text: string) => {
        setLoading(true)
        // Limpa erro anterior ao tentar de novo
        setErrorMsg('')
        
        if (controllerRef.current) controllerRef.current.abort()
        controllerRef.current = new AbortController()

        try {
            // Nova API: Open Food Facts + Backup (FatSecret aberto)
            // Vamos usar o OpenFoodFacts para a busca primária que é livre de CORS e tokens
            const offResponse = await fetch(
                `https://br.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(text)}&search_simple=1&action=process&json=1&page_size=20`,
                { 
                    signal: controllerRef.current.signal,
                    headers: {
                        'User-Agent': 'GerencialBodybrothers - Web - 1.0' // Exigência da API para não dar block fácil
                    }
                }
            )
            
            if (!offResponse.ok) {
                if (offResponse.status === 429) {
                    throw new Error('Rate limit atingido')
                }
                throw new Error(`Erro na API: ${offResponse.status}`)
            }

            const data = await offResponse.json()

            if (!data.products || data.products.length === 0) {
                setSuggestions(prev => {
                    if (prev.length === 0) {
                        setErrorMsg('Nenhum alimento encontrado na Web para este termo.')
                    }
                    return prev // Mantém os locais se houver
                })
                return
            }

            let apiMatches = data.products.map((p: any) => ({
                food_id: p._id || p.code,
                food_name: p.product_name_pt || p.product_name || 'Produto Sem Nome',
                food_description: p.brands ? `Marca: ${p.brands}` : 'Produto Industrializado',
                _raw: p // Usado para extrair macros depois
            }))

            // Filtra os que não tem nome
            apiMatches = apiMatches.filter((m: any) => m.food_name && m.food_name !== 'Produto Sem Nome')

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

                // Filtra duplicatas (remove da API os que já temos localmente)
                const localNames = new Set(validLocals.map(l => l.food_name.toLowerCase()))
                const filteredApi = apiMatches.filter(a => !localNames.has(a.food_name.toLowerCase()))

                return [...validLocals, ...filteredApi]
            })
        } catch (err: any) {
            if (err.name === 'AbortError') return 
            console.error('Erro na busca OpenFoodFacts:', err)
            
            // Só mostra erro se não tiver nenhuma sugestão local na tela
            setSuggestions(prev => {
                if (prev.length === 0) {
                    if (err.message === 'Rate limit atingido') {
                        setErrorMsg('Muitas buscas seguidas. Aguarde alguns segundos...')
                    } else if (err instanceof TypeError) {
                        setErrorMsg('Não foi possível conectar. Verifique sua conexão com a internet.')
                    } else {
                        setErrorMsg('Não foi possível conectar ao banco de alimentos no momento.')
                    }
                }
                return prev
            })
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

        // OTIMIZAÇÃO: Não trava a busca da API só porque achou local. 
        // Aumentei o tempo para 800ms. Assim se você digitar "Iorgute" rápido, ele não tenta buscar
        // "Ior", "Iorg", "Iorgu" e acabar sendo bloqueado.
        timeoutRef.current = setTimeout(() => searchWeb(text), 800) 
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

            // B. Se é Web (Open Food Facts)
            if ((item as any)._raw) {
                const p = (item as any)._raw;
                const nut = p.nutriments || {};
                
                // Pega os valores por 100g, se não tiver, usa o valor da porção, se não tiver, usa 0
                const calories = nut['energy-kcal_100g'] || nut['energy-kcal_serving'] || nut['energy-kcal_value'] || 0;
                const protein = nut.proteins_100g || nut.proteins_serving || nut.proteins_value || 0;
                const carbs = nut.carbohydrates_100g || nut.carbohydrates_serving || nut.carbohydrates_value || 0;
                const fat = nut.fat_100g || nut.fat_serving || nut.fat_value || 0;
                
                // Sódio no OFF geralmente vem em gramas ou miligramas. Se vier salt, divide por 2.5
                let sodiumMg = 0;
                if (nut.sodium_100g !== undefined) {
                    sodiumMg = nut.sodium_100g * 1000; // de gramas para mg
                } else if (nut.salt_100g !== undefined) {
                    sodiumMg = (nut.salt_100g / 2.5) * 1000;
                }

                const macros = {
                    food_id: item.food_id,
                    name: item.food_name,
                    calories_100g: Number(calories.toFixed(1)),
                    protein_100g: Number(protein.toFixed(1)),
                    carbs_100g: Number(carbs.toFixed(1)),
                    fat_100g: Number(fat.toFixed(1)),
                    sodium_100g: Number(sodiumMg.toFixed(1)),
                    source: 'openfoodfacts',
                    unit_weight: 100
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
            // Se apertar Enter sem selecionar nada, o valor digitado fica e fecha a busca
            // Mostramos o erro como aviso se a API falhar, mas deixamos usar o texto livre
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
                         <div style={{ padding: '12px 16px', color: '#64748b', fontSize: '0.9em', fontStyle: 'italic', background: '#f8fafc' }}>
                            ℹ️ {errorMsg}
                            <div style={{ marginTop: 4, fontSize: '0.85em', color: '#94a3b8' }}>Você pode continuar digitando e preencher os macros manualmente.</div>
                         </div>
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
