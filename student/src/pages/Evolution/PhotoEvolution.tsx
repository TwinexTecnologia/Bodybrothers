import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/useAuth'
import { Camera, Calendar, ArrowRight, Image as ImageIcon } from 'lucide-react'

type PhotoRecord = {
    id: string
    date: string
    photos: string[]
}

export default function PhotoEvolution() {
    const { user } = useAuth()
    const [history, setHistory] = useState<PhotoRecord[]>([])
    const [loading, setLoading] = useState(true)
    const [debugData, setDebugData] = useState<any>(null)
    
    const [idA, setIdA] = useState('')
    const [idB, setIdB] = useState('')

    useEffect(() => {
        if (user) loadPhotos()
    }, [user])

    async function loadPhotos() {
        console.log('Carregando fotos...')
        const { data, error } = await supabase
            .from('protocols')
            .select('*') // Busca tudo para garantir
            .eq('student_id', user.id)
            .eq('type', 'anamnesis')
            .order('created_at', { ascending: true })

        if (error) {
            console.error('Erro Supabase:', error)
            setLoading(false)
            return
        }

        if (!data || data.length === 0) {
            setLoading(false)
            return
        }

        // Salva o primeiro item para debug visual
        setDebugData(data[0])

        console.log('Anamneses encontradas:', data.length)

        // Função recursiva para achar imagens em qualquer lugar do JSON
        const extractImages = (obj: any): string[] => {
            const images: string[] = []
            if (!obj) return images

            // Se for string JSON, tenta parsear
            if (typeof obj === 'string') {
                try {
                    const parsed = JSON.parse(obj)
                    if (typeof parsed === 'object') {
                        return extractImages(parsed)
                    }
                } catch (e) {
                    // Não é JSON válido
                }
            }

            const processValue = (val: any) => {
                if (typeof val === 'string') {
                    // Critérios para considerar imagem (mais permissivo)
                    if (val.includes('supabase') && val.includes('/storage/')) {
                        images.push(val)
                    } else if (val.match(/\.(jpeg|jpg|png|webp|heic)(\?.*)?$/i)) {
                        images.push(val)
                    }
                } else if (typeof val === 'object' && val !== null) {
                    Object.values(val).forEach(processValue)
                }
            }
            
            processValue(obj)
            return images
        }

        const processed = data.map(item => {
            // Tenta pegar de content ou data
            const rawData = item.content || item.data || {}
            console.log(`Processando item ${item.id}. Tipo: ${typeof rawData}`)
            
            const photos = extractImages(rawData)
            console.log(`Item ${item.id}:`, photos.length, 'fotos encontradas')

            return {
                id: item.id,
                date: item.created_at,
                photos
            }
        }).filter(item => item.photos.length > 0)

        setHistory(processed)
        
        if (processed.length >= 2) {
            setIdA(processed[0].id)
            setIdB(processed[processed.length - 1].id)
        } else if (processed.length === 1) {
            setIdA(processed[0].id)
            setIdB(processed[0].id)
        }
        
        setLoading(false)
    }

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', day: 'numeric' })
    }

    const getRecord = (id: string) => history.find(h => h.id === id)

    if (loading) return <div className="p-8 text-center text-gray-500">Carregando fotos...</div>

    if (history.length === 0) {
        return (
            <div style={{ padding: 40, textAlign: 'center' }}>
                <div style={{ background: '#eff6ff', width: 64, height: 64, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: '#3b82f6' }}>
                    <Camera size={32} />
                </div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1f2937', marginBottom: 8 }}>Evolução Fotográfica</h2>
                <p style={{ color: '#6b7280', maxWidth: 400, margin: '0 auto' }}>
                    Nenhuma foto encontrada nas suas anamneses. 
                </p>
                
                {debugData && (
                    <div style={{ marginTop: 40, textAlign: 'left', background: '#f1f5f9', padding: 20, borderRadius: 8, overflowX: 'auto' }}>
                        <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#475569', marginBottom: 10 }}>DADOS BRUTOS (DEBUG):</h4>
                        <pre style={{ fontSize: '0.8rem', color: '#334155' }}>
                            {JSON.stringify(debugData, null, 2)}
                        </pre>
                    </div>
                )}
            </div>
        )
    }

    const recordA = getRecord(idA)
    const recordB = getRecord(idB)

    return (
        <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: 40 }}>
            <header style={{ marginBottom: 32 }}>
                <h1 style={{ fontSize: '1.8rem', color: '#0f172a', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Camera /> Evolução Fotográfica
                </h1>
                <p style={{ color: '#64748b', margin: 0 }}>Compare seu progresso físico ao longo do tempo.</p>
            </header>

            {/* Controles de Comparação */}
            <div style={{ background: '#fff', padding: 20, borderRadius: 16, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', marginBottom: 32 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
                    
                    <div style={{ flex: 1, minWidth: 200 }}>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#64748b', marginBottom: 8 }}>PERÍODO 1 (ANTES)</label>
                        <select 
                            value={idA} 
                            onChange={e => setIdA(e.target.value)}
                            style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '1rem', background: '#f8fafc' }}
                        >
                            {history.map(h => (
                                <option key={h.id} value={h.id}>{formatDate(h.date)} ({h.photos.length} fotos)</option>
                            ))}
                        </select>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 24 }}>
                        <div style={{ background: '#eff6ff', padding: 8, borderRadius: '50%', color: '#2563eb' }}>
                            <ArrowRight size={24} />
                        </div>
                    </div>

                    <div style={{ flex: 1, minWidth: 200 }}>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#64748b', marginBottom: 8 }}>PERÍODO 2 (DEPOIS)</label>
                        <select 
                            value={idB} 
                            onChange={e => setIdB(e.target.value)}
                            style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '1rem', background: '#f8fafc' }}
                        >
                            {history.map(h => (
                                <option key={h.id} value={h.id}>{formatDate(h.date)} ({h.photos.length} fotos)</option>
                            ))}
                        </select>
                    </div>

                </div>
            </div>

            {/* Área de Visualização */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                
                {/* Cabeçalho das Colunas (Data) */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, textAlign: 'center' }}>
                    <div style={{ background: '#f8fafc', padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.9rem' }}>
                            {recordA ? formatDate(recordA.date) : 'Selecione'}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>ANTES</div>
                    </div>
                    <div style={{ background: '#f0fdf4', padding: 10, borderRadius: 8, border: '1px solid #bbf7d0' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.9rem' }}>
                            {recordB ? formatDate(recordB.date) : 'Selecione'}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#16a34a' }}>DEPOIS</div>
                    </div>
                </div>

                {/* Lista de Fotos Lado a Lado */}
                {(() => {
                    const countA = recordA?.photos.length || 0
                    const countB = recordB?.photos.length || 0
                    const maxPhotos = Math.max(countA, countB)

                    if (maxPhotos === 0) return <div className="text-center text-gray-500 py-8">Nenhuma foto para comparar nos períodos selecionados.</div>

                    return Array.from({ length: maxPhotos }).map((_, i) => {
                        const photoA = recordA?.photos[i]
                        const photoB = recordB?.photos[i]

                        return (
                            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                {/* Lado A */}
                                <div style={{ 
                                    position: 'relative',
                                    height: 300,
                                    background: '#f8fafc',
                                    borderRadius: 12,
                                    border: '1px solid #e2e8f0',
                                    overflow: 'hidden',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    {photoA ? (
                                        <img 
                                            src={photoA} 
                                            alt={`Foto ${i+1} Antes`} 
                                            style={{ 
                                                maxWidth: '100%', 
                                                maxHeight: '100%', 
                                                objectFit: 'contain',
                                                cursor: 'pointer' 
                                            }}
                                            onClick={() => window.open(photoA, '_blank')}
                                        />
                                    ) : (
                                        <div style={{ color: '#cbd5e1', fontSize: '0.8rem' }}>Sem foto</div>
                                    )}
                                    {photoA && <div style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(0,0,0,0.6)', color: '#fff', padding: '2px 6px', borderRadius: 4, fontSize: '0.7rem' }}>{i+1}</div>}
                                </div>

                                {/* Lado B */}
                                <div style={{ 
                                    position: 'relative',
                                    height: 300,
                                    background: '#f0fdf4',
                                    borderRadius: 12,
                                    border: '1px solid #bbf7d0',
                                    overflow: 'hidden',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    {photoB ? (
                                        <img 
                                            src={photoB} 
                                            alt={`Foto ${i+1} Depois`} 
                                            style={{ 
                                                maxWidth: '100%', 
                                                maxHeight: '100%', 
                                                objectFit: 'contain',
                                                cursor: 'pointer' 
                                            }}
                                            onClick={() => window.open(photoB, '_blank')}
                                        />
                                    ) : (
                                        <div style={{ color: '#cbd5e1', fontSize: '0.8rem' }}>Sem foto</div>
                                    )}
                                    {photoB && <div style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(0,0,0,0.6)', color: '#fff', padding: '2px 6px', borderRadius: 4, fontSize: '0.7rem' }}>{i+1}</div>}
                                </div>
                            </div>
                        )
                    })
                })()}

            </div>
        </div>
    )
}
