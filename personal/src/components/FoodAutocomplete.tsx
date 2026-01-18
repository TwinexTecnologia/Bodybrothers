
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

type FoodSuggestion = {
    food_id: string
    food_name: string
    food_description: string
}

type FoodDetails = {
    food_id: string
    name: string
    calories_100g: number
    protein_100g: number
    carbs_100g: number
    fat_100g: number
}

interface Props {
    value: string
    onChange: (name: string) => void
    onSelect: (details: FoodDetails) => void
    placeholder?: string
    className?: string
    style?: React.CSSProperties
}

export default function FoodAutocomplete({ value, onChange, onSelect, placeholder, className, style }: Props) {
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

        if (text.length < 3) {
            setSuggestions([])
            setShowSuggestions(false)
            return
        }

        timeoutRef.current = setTimeout(async () => {
            setLoading(true)
            try {
                // Chama a Edge Function
                // Em desenvolvimento local, tentamos chamar o servidor local do Supabase se estiver rodando
                // Para isso, usamos fetch direto se for localhost, ou o client se for prod
                
                let data, error
                
                const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
                
                // Tenta chamar localmente primeiro se estiver em dev
                if (isLocal) {
                    try {
                        const response = await fetch('http://localhost:54321/functions/v1/fatsecret-proxy', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ method: 'foods.search', search_expression: text })
                        })
                        if (response.ok) {
                            data = await response.json()
                        } else {
                            throw new Error('Local function failed')
                        }
                    } catch (e) {
                        // Se falhar local (ex: Docker não rodando), tenta produção
                        // Mas só funciona se tiver deployado.
                        // Vamos logar para debug
                        console.warn('Local function not found/error, trying production...', e)
                        const res = await supabase.functions.invoke('fatsecret-proxy', {
                            body: { method: 'foods.search', search_expression: text }
                        })
                        data = res.data
                        error = res.error
                    }
                } else {
                    // Produção
                    const res = await supabase.functions.invoke('fatsecret-proxy', {
                        body: { method: 'foods.search', search_expression: text }
                    })
                    data = res.data
                    error = res.error
                }

                if (error) throw error

                const foods = data?.foods?.food
                if (foods) {
                    // Se for um único objeto, transforma em array
                    const list = Array.isArray(foods) ? foods : [foods]
                    setSuggestions(list)
                    setShowSuggestions(true)
                } else {
                    setSuggestions([])
                    setErrorMsg('Nenhum alimento encontrado')
                    setShowSuggestions(true)
                }
            } catch (err: any) {
                console.error('Erro ao buscar alimentos:', err)
                setErrorMsg('Erro ao buscar. Verifique se o backend está rodando.')
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
            // 1. Verifica Cache
            const { data: cache } = await supabase
                .from('food_cache')
                .select('*')
                .eq('food_id', item.food_id)
                .single()

            if (cache) {
                onSelect({
                    food_id: cache.food_id,
                    name: cache.name,
                    calories_100g: Number(cache.calories_100g),
                    protein_100g: Number(cache.protein_100g),
                    carbs_100g: Number(cache.carbs_100g),
                    fat_100g: Number(cache.fat_100g)
                })
                return
            }

            // 2. Se não tem cache, busca detalhe na API
            let detailData, error
            const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'

            if (isLocal) {
                try {
                    const response = await fetch('http://localhost:54321/functions/v1/fatsecret-proxy', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ method: 'food.get', food_id: item.food_id })
                    })
                    if (response.ok) {
                        detailData = await response.json()
                    } else {
                        throw new Error('Local function failed')
                    }
                } catch (e) {
                    console.warn('Fallback to prod', e)
                    const res = await supabase.functions.invoke('fatsecret-proxy', {
                        body: { method: 'food.get', food_id: item.food_id }
                    })
                    detailData = res.data
                    error = res.error
                }
            } else {
                const res = await supabase.functions.invoke('fatsecret-proxy', {
                    body: { method: 'food.get', food_id: item.food_id }
                })
                detailData = res.data
                error = res.error
            }

            if (error || !detailData?.food) throw error

            const serving = detailData.food.servings.serving
            // Pode ser array, pega o primeiro (normalmente 100g ou padrão)
            const s = Array.isArray(serving) ? serving[0] : serving
            
            // Normaliza para 100g se possível, ou usa a porção informada
            // A API geralmente retorna '100 g' ou similar.
            // Vamos assumir que os valores são da porção retornada e salvar como referência.
            // Se a porção for '100 g', ótimo. Se não, precisaria converter.
            // O prompt diz "Os valores vêm por 100g". Vamos confiar ou tentar normalizar.
            
            // Tratamento simplificado conforme prompt: "Response (exemplo – por 100g)"
            
            const macros = {
                food_id: item.food_id,
                name: item.food_name,
                calories_100g: Number(s.calories),
                protein_100g: Number(s.protein),
                carbs_100g: Number(s.carbohydrate),
                fat_100g: Number(s.fat),
                source: 'fatsecret'
            }

            // 3. Salva no Cache
            await supabase.from('food_cache').insert(macros)

            onSelect(macros)

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
