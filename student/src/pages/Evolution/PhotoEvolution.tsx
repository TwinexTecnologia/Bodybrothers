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

    // Controle de modo e upload
    const [evolutionMode, setEvolutionMode] = useState('anamnesis')
    const [evolutionFields, setEvolutionFields] = useState<any[]>([]) // Campos customizados
    const [isUploading, setIsUploading] = useState(false)
    const [uploadDate, setUploadDate] = useState(new Date().toISOString().split('T')[0])
    const [uploadFiles, setUploadFiles] = useState<FileList | null>(null)
    const [fieldFiles, setFieldFiles] = useState<Record<string, File>>({}) // Mapa de arquivos por campo
    const [uploading, setUploading] = useState(false)

    useEffect(() => {
        if (user) loadConfigAndPhotos()
    }, [user])

    async function loadConfigAndPhotos() {
        setLoading(true)
        try {
            // 1. Busca personal_id do aluno
            const { data: student } = await supabase
                .from('profiles')
                .select('personal_id')
                .eq('id', user.id)
                .single()
            
            let mode = 'anamnesis'

            if (student?.personal_id) {
                // 2. Busca config do personal
                const { data: personal } = await supabase
                    .from('profiles')
                    .select('data')
                    .eq('id', student.personal_id)
                    .single()
                
                if (personal?.data?.config?.evolutionMode) {
                    mode = personal.data.config.evolutionMode
                }
                
                if (personal?.data?.config?.evolutionFields) {
                    setEvolutionFields(personal.data.config.evolutionFields)
                }
            }

            setEvolutionMode(mode)
            await loadPhotos(mode)

        } catch (error) {
            console.error('Erro ao carregar configurações:', error)
            setLoading(false)
        }
    }

    async function loadPhotos(mode: string) {
        console.log('Carregando fotos para modo:', mode)
        
        let query = supabase
            .from('protocols')
            .select('*')
            .eq('student_id', user.id)
            .order('created_at', { ascending: true })

        // Se for standalone, busca fotos avulsas
        // Se for anamnesis, busca anamneses
        // PODE SER que queiramos mostrar AMBOS se o modo mudou recentemente?
        // O pedido diz: "se o personal dele tiver a evolucao pela anamnese nao precisa, continua como esta"
        // Então vou filtrar estritamente.
        
        if (mode === 'standalone') {
            query = query.in('type', ['photos', 'anamnesis']) // Mostra legado também
        } else {
            query = query.eq('type', 'anamnesis')
        }

        const { data, error } = await query

        if (error) {
            console.error('Erro Supabase:', error)
            setLoading(false)
            return
        }

        if (!data || data.length === 0) {
            setHistory([])
            setLoading(false)
            return
        }

        // Salva o primeiro item para debug visual
        setDebugData(data[0])

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
            const photos = extractImages(rawData)
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

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault()
        
        // Validação
        let filesToUpload: File[] = []
        
        if (evolutionFields.length > 0) {
            // Se tem campos definidos, verifica se todos foram preenchidos (opcional, mas recomendado)
            // Vamos iterar na ordem dos campos para garantir a ordem das fotos
            filesToUpload = evolutionFields.map(f => fieldFiles[f.id]).filter(Boolean)
            
            if (filesToUpload.length === 0) {
                alert('Selecione pelo menos uma foto.')
                return
            }
        } else {
            // Upload livre
            if (!uploadFiles || uploadFiles.length === 0) return
            filesToUpload = Array.from(uploadFiles)
        }

        setUploading(true)

        try {
            // Precisa do personal_id novamente para salvar o registro corretamente
            const { data: student } = await supabase
                .from('profiles')
                .select('personal_id')
                .eq('id', user.id)
                .single()

            if (!student?.personal_id) throw new Error('Personal não encontrado')

            const uploadedUrls: string[] = []

            for (let i = 0; i < filesToUpload.length; i++) {
                const file = filesToUpload[i]
                const fileExt = file.name.split('.').pop()
                const fileName = `${user.id}/${Date.now()}_${i}.${fileExt}`

                const { error: uploadError } = await supabase.storage
                    .from('anamnesis-files')
                    .upload(fileName, file)

                if (uploadError) throw uploadError

                const { data } = supabase.storage.from('anamnesis-files').getPublicUrl(fileName)
                uploadedUrls.push(data.publicUrl)
            }

            // Salvar no banco
            const { error: dbError } = await supabase.from('protocols').insert({
                student_id: user.id,
                personal_id: student.personal_id,
                type: 'photos',
                status: 'active',
                title: 'Evolução (Aluno)',
                data: {
                    date: uploadDate,
                    photos: uploadedUrls
                },
                created_at: new Date(uploadDate).toISOString()
            })

            if (dbError) throw dbError

            setIsUploading(false)
            setUploadFiles(null)
            setFieldFiles({})
            await loadPhotos(evolutionMode)
            alert('Fotos enviadas com sucesso!')

        } catch (error: any) {
            console.error(error)
            alert('Erro ao enviar fotos: ' + error.message)
        } finally {
            setUploading(false)
        }
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
                    {evolutionMode === 'standalone' 
                        ? 'Você ainda não enviou fotos de evolução.' 
                        : 'Nenhuma foto encontrada nas suas anamneses.'}
                </p>

                {evolutionMode === 'standalone' && (
                    <div style={{ marginTop: 24 }}>
                        <button 
                            onClick={() => setIsUploading(true)}
                            style={{ background: '#0f172a', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
                        >
                            + Adicionar Primeiras Fotos
                        </button>
                    </div>
                )}
                
                {/* Modal de Upload dentro do empty state também */}
                {isUploading && (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, textAlign: 'left' }}>
                        <div style={{ background: '#fff', padding: 32, borderRadius: 24, width: '100%', maxWidth: 480, boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                                <h3 style={{ margin: 0, fontSize: '1.5rem', color: '#0f172a', fontWeight: 700 }}>Nova Evolução</h3>
                                <button onClick={() => setIsUploading(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#94a3b8' }}>✕</button>
                            </div>
                            
                            <form onSubmit={handleUpload}>
                                <div style={{ marginBottom: 20 }}>
                                    <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: '#334155', marginBottom: 8 }}>Quando as fotos foram tiradas?</label>
                                    <input 
                                        type="date" 
                                        value={uploadDate} 
                                        onChange={e => setUploadDate(e.target.value)}
                                        style={{ 
                                            width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #e2e8f0', 
                                            fontSize: '1rem', background: '#f8fafc', color: '#0f172a', outline: 'none',
                                            transition: 'all 0.2s'
                                        }}
                                        required
                                    />
                                </div>

                                <div style={{ marginBottom: 32 }}>
                                    <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: '#334155', marginBottom: 8 }}>Selecione as Fotos</label>
                                    <div style={{ 
                                        border: '2px dashed #cbd5e1', borderRadius: 16, padding: 24, 
                                        textAlign: 'center', background: '#f8fafc', cursor: 'pointer',
                                        position: 'relative', transition: 'all 0.2s'
                                    }}>
                                        <input 
                                            type="file" 
                                            multiple 
                                            accept="image/*"
                                            onChange={e => setUploadFiles(e.target.files)}
                                            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                                            required
                                        />
                                        <div style={{ pointerEvents: 'none' }}>
                                            <div style={{ color: '#64748b', marginBottom: 8 }}>
                                                <ImageIcon size={32} />
                                            </div>
                                            {uploadFiles && uploadFiles.length > 0 ? (
                                                <div style={{ color: '#0f172a', fontWeight: 600 }}>
                                                    {uploadFiles.length} foto(s) selecionada(s)
                                                </div>
                                            ) : (
                                                <>
                                                    <div style={{ color: '#0f172a', fontWeight: 600, marginBottom: 4 }}>Clique para enviar</div>
                                                    <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Frente, Costas, Lado...</div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                    <button 
                                        type="button" 
                                        onClick={() => setIsUploading(false)} 
                                        style={{ 
                                            padding: '14px', borderRadius: 12, border: 'none', background: '#f1f5f9', 
                                            color: '#475569', fontWeight: 600, cursor: 'pointer', fontSize: '1rem'
                                        }}
                                    >
                                        Cancelar
                                    </button>
                                    <button 
                                        type="submit" 
                                        disabled={uploading} 
                                        style={{ 
                                            padding: '14px', borderRadius: 12, border: 'none', background: '#0f172a', 
                                            color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '1rem',
                                            opacity: uploading ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                                        }}
                                    >
                                        {uploading ? 'Enviando...' : (
                                            <>
                                                <Camera size={18} /> Salvar Fotos
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

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
            {/* Modal de Upload Moderno */}
            {isUploading && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div style={{ background: '#fff', padding: 32, borderRadius: 24, width: '100%', maxWidth: 480, boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                            <h3 style={{ margin: 0, fontSize: '1.5rem', color: '#0f172a', fontWeight: 700 }}>Nova Evolução</h3>
                            <button onClick={() => setIsUploading(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#94a3b8' }}>✕</button>
                        </div>
                        
                        <form onSubmit={handleUpload}>
                            <div style={{ marginBottom: 20 }}>
                                <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: '#334155', marginBottom: 8 }}>Quando as fotos foram tiradas?</label>
                                <input 
                                    type="date" 
                                    value={uploadDate} 
                                    onChange={e => setUploadDate(e.target.value)}
                                    style={{ 
                                        width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #e2e8f0', 
                                        fontSize: '1rem', background: '#f8fafc', color: '#0f172a', outline: 'none',
                                        transition: 'all 0.2s'
                                    }}
                                    required
                                />
                            </div>

                            <div style={{ marginBottom: 32 }}>
                                <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: '#334155', marginBottom: 8 }}>
                                    {evolutionFields.length > 0 ? 'Fotos' : 'Selecione as Fotos'}
                                </label>
                                
                                {evolutionFields.length > 0 ? (
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                        {evolutionFields.map(field => (
                                            <div key={field.id} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>{field.label}</label>
                                                <div 
                                                    style={{ 
                                                        border: '2px dashed #cbd5e1', borderRadius: 12, padding: 16, 
                                                        textAlign: 'center', background: '#f8fafc', cursor: 'pointer',
                                                        position: 'relative', height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        overflow: 'hidden'
                                                    }}
                                                >
                                                    <input 
                                                        type="file" 
                                                        accept="image/*"
                                                        onChange={e => {
                                                            if (e.target.files?.[0]) {
                                                                setFieldFiles(prev => ({ ...prev, [field.id]: e.target.files![0] }))
                                                            }
                                                        }}
                                                        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', zIndex: 2 }}
                                                    />
                                                    
                                                    {fieldFiles[field.id] ? (
                                                        <img 
                                                            src={URL.createObjectURL(fieldFiles[field.id])} 
                                                            alt="Preview" 
                                                            style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', zIndex: 1 }} 
                                                        />
                                                    ) : field.exampleUrl ? (
                                                        <div style={{ width: '100%', height: '100%', position: 'absolute', zIndex: 0 }}>
                                                            <img src={field.exampleUrl} alt="Referência" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.5, filter: 'grayscale(100%)' }} />
                                                            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.3)' }}>
                                                                <span style={{ background: 'rgba(0,0,0,0.6)', color: '#fff', padding: '4px 8px', borderRadius: 4, fontSize: '0.75rem' }}>+ Adicionar</span>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div style={{ color: '#94a3b8' }}>
                                                            <Camera size={24} />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div style={{ 
                                        border: '2px dashed #cbd5e1', borderRadius: 16, padding: 24, 
                                        textAlign: 'center', background: '#f8fafc', cursor: 'pointer',
                                        position: 'relative', transition: 'all 0.2s'
                                    }}>
                                        <input 
                                            type="file" 
                                            multiple 
                                            accept="image/*"
                                            onChange={e => setUploadFiles(e.target.files)}
                                            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                                            required
                                        />
                                        <div style={{ pointerEvents: 'none' }}>
                                            <div style={{ color: '#64748b', marginBottom: 8 }}>
                                                <ImageIcon size={32} />
                                            </div>
                                            {uploadFiles && uploadFiles.length > 0 ? (
                                                <div style={{ color: '#0f172a', fontWeight: 600 }}>
                                                    {uploadFiles.length} foto(s) selecionada(s)
                                                </div>
                                            ) : (
                                                <>
                                                    <div style={{ color: '#0f172a', fontWeight: 600, marginBottom: 4 }}>Clique para enviar</div>
                                                    <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Frente, Costas, Lado...</div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <button 
                                    type="button" 
                                    onClick={() => setIsUploading(false)} 
                                    style={{ 
                                        padding: '14px', borderRadius: 12, border: 'none', background: '#f1f5f9', 
                                        color: '#475569', fontWeight: 600, cursor: 'pointer', fontSize: '1rem'
                                    }}
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={uploading} 
                                    style={{ 
                                        padding: '14px', borderRadius: 12, border: 'none', background: '#0f172a', 
                                        color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '1rem',
                                        opacity: uploading ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                                    }}
                                >
                                    {uploading ? 'Enviando...' : (
                                        <>
                                            <Camera size={18} /> Salvar Fotos
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <header style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ fontSize: '1.8rem', color: '#0f172a', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
                        <Camera /> Evolução Fotográfica
                    </h1>
                    <p style={{ color: '#64748b', margin: 0 }}>Compare seu progresso físico ao longo do tempo.</p>
                </div>
                {evolutionMode === 'standalone' && (
                    <button 
                        onClick={() => setIsUploading(true)}
                        style={{ background: '#0f172a', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
                    >
                        + Adicionar Fotos
                    </button>
                )}
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
