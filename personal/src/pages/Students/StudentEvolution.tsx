import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Camera, ArrowRight, ArrowLeft } from 'lucide-react'

type PhotoRecord = {
    id: string
    date: string
    photos: string[]
}

export default function StudentEvolution() {
    const { id } = useParams() // ID do aluno
    const navigate = useNavigate()
    const [history, setHistory] = useState<PhotoRecord[]>([])
    const [loading, setLoading] = useState(true)
    const [studentName, setStudentName] = useState('')
    
    const [idA, setIdA] = useState('')
    const [idB, setIdB] = useState('')
    
    // Novos estados para modo Standalone
    const [evolutionMode, setEvolutionMode] = useState('anamnesis')
    const [isUploading, setIsUploading] = useState(false)
    const [uploadDate, setUploadDate] = useState(new Date().toISOString().split('T')[0])
    const [uploadFiles, setUploadFiles] = useState<FileList | null>(null)
    const [uploading, setUploading] = useState(false)

    useEffect(() => {
        if (id) {
            loadConfigAndPhotos()
        }
    }, [id])

    async function loadConfigAndPhotos() {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // 1. Carrega Nome do Aluno
        const { data: student } = await supabase.from('profiles').select('full_name').eq('id', id).single()
        if (student) setStudentName(student.full_name)

        // 2. Carrega Config do Personal
        const { data: personal } = await supabase.from('profiles').select('data').eq('id', user.id).single()
        const mode = personal?.data?.config?.evolutionMode || 'anamnesis'
        setEvolutionMode(mode)

        // 3. Carrega Fotos baseadas no modo
        loadPhotos(mode)
    }

    async function loadPhotos(mode: string) {
        let query = supabase
            .from('protocols')
            .select('*')
            .eq('student_id', id)
            .order('created_at', { ascending: true })

        if (mode === 'standalone') {
            query = query.eq('type', 'photos')
        } else {
            query = query.eq('type', 'anamnesis')
        }

        const { data, error } = await query

        if (error || !data || data.length === 0) {
            setHistory([]) // Limpa histórico se não tiver nada
            setLoading(false)
            return
        }

        // Função recursiva para achar imagens
        const extractImages = (obj: any): string[] => {
            const images: string[] = []
            if (!obj) return images

            if (typeof obj === 'string') {
                try {
                    const parsed = JSON.parse(obj)
                    if (typeof parsed === 'object') {
                        return extractImages(parsed)
                    }
                } catch (e) {}
            }

            const processValue = (val: any) => {
                if (typeof val === 'string') {
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

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', day: 'numeric' })
    }

    const getRecord = (recordId: string) => history.find(h => h.id === recordId)

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!uploadFiles || uploadFiles.length === 0) return
        setUploading(true)

        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('Usuário não logado')

            const uploadedUrls: string[] = []

            for (let i = 0; i < uploadFiles.length; i++) {
                const file = uploadFiles[i]
                const fileExt = file.name.split('.').pop()
                const fileName = `${id}/${Date.now()}_${i}.${fileExt}`

                const { error: uploadError } = await supabase.storage
                    .from('anamnesis-files')
                    .upload(fileName, file)

                if (uploadError) throw uploadError

                const { data } = supabase.storage.from('anamnesis-files').getPublicUrl(fileName)
                uploadedUrls.push(data.publicUrl)
            }

            // Salvar no banco
            const { error: dbError } = await supabase.from('protocols').insert({
                student_id: id,
                personal_id: user.id,
                type: 'photos',
                status: 'active',
                title: 'Evolução Fotográfica',
                data: {
                    date: uploadDate,
                    photos: uploadedUrls
                },
                created_at: new Date(uploadDate).toISOString() // Usa a data selecionada para ordenação
            })

            if (dbError) throw dbError

            setIsUploading(false)
            setUploadFiles(null)
            loadPhotos('standalone')
            alert('Fotos adicionadas com sucesso!')

        } catch (error: any) {
            console.error(error)
            alert('Erro ao enviar fotos: ' + error.message)
        } finally {
            setUploading(false)
        }
    }

    if (loading) return <div className="p-8 text-center text-gray-500">Carregando fotos...</div>

    const recordA = getRecord(idA)
    const recordB = getRecord(idB)

    return (
        <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: 40 }}>
            {/* Modal de Upload */}
            {isUploading && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div style={{ background: '#fff', padding: 24, borderRadius: 16, width: '100%', maxWidth: 500 }}>
                        <h3 style={{ marginTop: 0, marginBottom: 16 }}>Adicionar Fotos de Evolução</h3>
                        <form onSubmit={handleUpload}>
                            <label style={{ display: 'block', marginBottom: 16 }}>
                                <span style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>Data das Fotos</span>
                                <input 
                                    type="date" 
                                    value={uploadDate} 
                                    onChange={e => setUploadDate(e.target.value)}
                                    style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #cbd5e1' }}
                                    required
                                />
                            </label>
                            <label style={{ display: 'block', marginBottom: 24 }}>
                                <span style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>Selecione as Fotos (Frente, Costas, Lado...)</span>
                                <input 
                                    type="file" 
                                    multiple 
                                    accept="image/*"
                                    onChange={e => setUploadFiles(e.target.files)}
                                    style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #cbd5e1' }}
                                    required
                                />
                            </label>
                            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                                <button type="button" onClick={() => setIsUploading(false)} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}>Cancelar</button>
                                <button type="submit" disabled={uploading} style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: '#0f172a', color: '#fff', cursor: 'pointer', opacity: uploading ? 0.7 : 1 }}>
                                    {uploading ? 'Enviando...' : 'Salvar Fotos'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <button 
                onClick={() => navigate(-1)} 
                style={{ 
                    display: 'flex', alignItems: 'center', gap: 8, 
                    background: 'none', border: 'none', cursor: 'pointer',
                    marginBottom: 20, color: '#64748b', fontWeight: 600 
                }}
            >
                <ArrowLeft size={20} /> Voltar
            </button>

            <header style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ fontSize: '1.8rem', color: '#0f172a', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
                        <Camera /> Evolução: {studentName}
                    </h1>
                    <p style={{ color: '#64748b', margin: 0 }}>
                        {evolutionMode === 'standalone' 
                            ? 'Gerencie as fotos de evolução diretamente na biblioteca.' 
                            : 'Comparativo fotográfico baseado nas anamneses respondidas.'}
                    </p>
                </div>
                {evolutionMode === 'standalone' && (
                    <button 
                        onClick={() => setIsUploading(true)}
                        style={{ 
                            background: '#0f172a', color: '#fff', border: 'none', 
                            padding: '12px 24px', borderRadius: 8, cursor: 'pointer', fontWeight: 600 
                        }}
                    >
                        + Adicionar Fotos
                    </button>
                )}
            </header>

            {history.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', background: '#fff', borderRadius: 16 }}>
                    <div style={{ background: '#eff6ff', width: 64, height: 64, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: '#3b82f6' }}>
                        <Camera size={32} />
                    </div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1f2937', marginBottom: 8 }}>Nenhuma foto encontrada</h2>
                    <p style={{ color: '#6b7280', maxWidth: 400, margin: '0 auto' }}>
                        Este aluno ainda não enviou fotos nas anamneses.
                    </p>
                </div>
            ) : (
                <>
                    {/* Controles */}
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

                    {/* Visualização */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
                        <div style={{ background: '#fff', padding: 24, borderRadius: 16, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                            <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: 16, marginBottom: 16 }}>
                                <h3 style={{ margin: 0, color: '#0f172a', fontSize: '1.1rem' }}>{recordA ? formatDate(recordA.date) : 'Selecione'}</h3>
                                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Registro Inicial</span>
                            </div>
                            {recordA && (
                                <div style={{ display: 'grid', gap: 24 }}>
                                    {recordA.photos.map((photo, i) => (
                                        <div key={i} style={{ position: 'relative', height: 400, background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <img src={photo} alt={`Foto ${i+1}`} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', cursor: 'pointer' }} onClick={() => window.open(photo, '_blank')} />
                                            <div style={{ position: 'absolute', top: 10, left: 10, background: 'rgba(0,0,0,0.6)', color: '#fff', padding: '4px 8px', borderRadius: 4, fontSize: '0.75rem' }}>Foto {i+1}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div style={{ background: '#fff', padding: 24, borderRadius: 16, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                            <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: 16, marginBottom: 16 }}>
                                <h3 style={{ margin: 0, color: '#0f172a', fontSize: '1.1rem' }}>{recordB ? formatDate(recordB.date) : 'Selecione'}</h3>
                                <span style={{ fontSize: '0.85rem', color: '#16a34a', fontWeight: 600 }}>Registro Comparativo</span>
                            </div>
                            {recordB && (
                                <div style={{ display: 'grid', gap: 24 }}>
                                    {recordB.photos.map((photo, i) => (
                                        <div key={i} style={{ position: 'relative', height: 400, background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <img src={photo} alt={`Foto ${i+1}`} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', cursor: 'pointer' }} onClick={() => window.open(photo, '_blank')} />
                                            <div style={{ position: 'absolute', top: 10, left: 10, background: 'rgba(0,0,0,0.6)', color: '#fff', padding: '4px 8px', borderRadius: 4, fontSize: '0.75rem' }}>Foto {i+1}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
