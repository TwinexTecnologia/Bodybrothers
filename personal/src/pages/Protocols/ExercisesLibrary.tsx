import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Plus, Search, Edit2, Trash2, Video, Dumbbell, Copy } from 'lucide-react'
import { listExercises, createExercise, updateExercise, deleteExercise, type Exercise } from '../../store/exercises'
import Modal from '../../components/Modal'

function getYouTubeId(url: string) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*).*/
    const match = url.match(regExp)
    return (match && match[2].length === 11) ? match[2] : null
}

export default function ExercisesLibrary() {
    const [exercises, setExercises] = useState<Exercise[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    
    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [formData, setFormData] = useState({ name: '', muscle_group: '', video_url: '' })
    const [saving, setSaving] = useState(false)
    const [uploading, setUploading] = useState(false)

    useEffect(() => {
        load()
    }, [])

    async function load() {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                const list = await listExercises(user.id)
                setExercises(list)
            }
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    const handleSave = async () => {
        if (!formData.name.trim()) return alert('Nome é obrigatório')
        
        setSaving(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            if (editingId) {
                await updateExercise(editingId, formData)
            } else {
                await createExercise(user.id, formData)
            }
            
            await load()
            closeModal()
        } catch (error) {
            console.error(error)
            alert('Erro ao salvar exercício')
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Tem certeza? Isso não afetará treinos já criados.')) return
        try {
            await deleteExercise(id)
            setExercises(prev => prev.filter(e => e.id !== id))
        } catch (error) {
            console.error(error)
            alert('Erro ao excluir')
        }
    }

    const handleUpload = async (file?: File) => {
        if (!file) return
        
        if (file.size > 50 * 1024 * 1024) {
            alert('O vídeo deve ter no máximo 50MB.')
            return
        }

        try {
            setUploading(true)
            const fileExt = file.name.split('.').pop()
            const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`
            const filePath = `library/${fileName}`

            const { error: uploadError } = await supabase.storage
                .from('videos')
                .upload(filePath, file)

            if (uploadError) throw uploadError

            const { data } = supabase.storage.from('videos').getPublicUrl(filePath)
            setFormData(prev => ({ ...prev, video_url: data.publicUrl }))
        } catch (error: any) {
            console.error('Erro no upload:', error)
            alert('Erro ao fazer upload. Verifique se o bucket "videos" existe.')
        } finally {
            setUploading(false)
        }
    }

    const openModal = (exercise?: Exercise) => {
        if (exercise) {
            setEditingId(exercise.id)
            setFormData({ 
                name: exercise.name, 
                muscle_group: exercise.muscle_group || '', 
                video_url: exercise.video_url || '' 
            })
        } else {
            setEditingId(null)
            setFormData({ name: '', muscle_group: '', video_url: '' })
        }
        setIsModalOpen(true)
    }

    const handleDuplicate = (exercise: Exercise) => {
        setEditingId(null) // Modo criação
        setFormData({
            name: `${exercise.name} (Cópia)`,
            muscle_group: exercise.muscle_group || '',
            video_url: exercise.video_url || ''
        })
        setIsModalOpen(true)
    }

    const closeModal = () => {
        setIsModalOpen(false)
        setEditingId(null)
        setFormData({ name: '', muscle_group: '', video_url: '' })
    }

    const filtered = exercises.filter(e => 
        e.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        e.muscle_group?.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const muscleGroups = ['Peito', 'Costas', 'Pernas', 'Ombros', 'Bíceps', 'Tríceps', 'Abdômen', 'Cardio', 'Outros']

    return (
        <div style={{ maxWidth: 1000, margin: '0 auto', paddingBottom: 100 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '1.8rem', color: '#0f172a' }}>Biblioteca de Exercícios</h1>
                    <p style={{ margin: '4px 0 0 0', color: '#64748b' }}>Gerencie seus exercícios para usar nos treinos</p>
                </div>
                <button className="btn-primary" onClick={() => openModal()} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <Plus size={20} /> Novo Exercício
                </button>
            </div>

            {/* Busca */}
            <div style={{ background: '#fff', padding: 16, borderRadius: 12, boxShadow: '0 2px 4px rgba(0,0,0,0.05)', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
                <Search size={20} color="#94a3b8" />
                <input 
                    placeholder="Buscar por nome ou grupo muscular..." 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    style={{ border: 'none', outline: 'none', fontSize: '1rem', width: '100%', color: '#334155' }}
                />
            </div>

            {/* Lista */}
            {loading ? (
                <div>Carregando...</div>
            ) : filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
                    Nenhum exercício encontrado.
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                    {filtered.map(ex => (
                        <div key={ex.id} style={{ background: '#fff', padding: 20, borderRadius: 12, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                                    <h3 style={{ margin: 0, color: '#0f172a', fontSize: '1.1rem' }}>{ex.name}</h3>
                                    {ex.muscle_group && (
                                        <span style={{ fontSize: '0.75rem', background: '#f1f5f9', color: '#64748b', padding: '2px 8px', borderRadius: 12 }}>
                                            {ex.muscle_group}
                                        </span>
                                    )}
                                </div>
                                {ex.video_url && (
                                    <div style={{ marginTop: 12, borderRadius: 8, overflow: 'hidden', background: '#000', height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        {getYouTubeId(ex.video_url) ? (
                                            <iframe
                                                width="100%"
                                                height="100%"
                                                src={`https://www.youtube.com/embed/${getYouTubeId(ex.video_url)}`}
                                                frameBorder="0"
                                                allowFullScreen
                                                style={{ border: 'none' }}
                                            />
                                        ) : ex.video_url.match(/\.(mp4|mov|webm)$/i) || ex.video_url.includes('supabase.co') ? (
                                            <video 
                                                src={ex.video_url} 
                                                controls 
                                                style={{ maxHeight: '100%', maxWidth: '100%' }}
                                            />
                                        ) : (
                                            <a href={ex.video_url} target="_blank" rel="noopener noreferrer" style={{ color: '#fff', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <Video size={20} /> Link Externo
                                            </a>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16, borderTop: '1px solid #f1f5f9', paddingTop: 12 }}>
                                <button onClick={() => handleDuplicate(ex)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6' }} title="Duplicar">
                                    <Copy size={18} />
                                </button>
                                <button onClick={() => openModal(ex)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }} title="Editar">
                                    <Edit2 size={18} />
                                </button>
                                <button onClick={() => handleDelete(ex.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }} title="Excluir">
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal de Criação/Edição */}
            <Modal
                isOpen={isModalOpen}
                onClose={closeModal}
                title={editingId ? 'Editar Exercício' : 'Novo Exercício'}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <label className="label">
                        Nome do Exercício
                        <input 
                            className="input" 
                            value={formData.name} 
                            onChange={e => setFormData({...formData, name: e.target.value})}
                            placeholder="Ex: Supino Reto"
                            autoFocus
                        />
                    </label>

                    <label className="label">
                        Grupo Muscular
                        <select 
                            className="select"
                            value={formData.muscle_group}
                            onChange={e => setFormData({...formData, muscle_group: e.target.value})}
                        >
                            <option value="">Selecione...</option>
                            {muscleGroups.map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                    </label>

                    <label className="label">
                        Link do Vídeo (ou Upload)
                        <div style={{ display: 'flex', gap: 8 }}>
                            <input 
                                className="input" 
                                style={{ flex: 1 }}
                                value={formData.video_url} 
                                onChange={e => setFormData({...formData, video_url: e.target.value})}
                                placeholder="https://..."
                            />
                            <label className="btn" style={{ background: '#e0f2fe', color: '#0369a1', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, border: '1px solid #bae6fd' }}>
                                {uploading ? 'Enviando...' : '📁 Upload'}
                                <input 
                                    type="file" 
                                    accept="video/*" 
                                    style={{ display: 'none' }} 
                                    onChange={(e) => handleUpload(e.target.files?.[0])}
                                    disabled={uploading}
                                />
                            </label>
                        </div>
                        {formData.video_url && (
                            <div style={{ marginTop: 12, borderRadius: 8, overflow: 'hidden', background: '#000', height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {getYouTubeId(formData.video_url) ? (
                                    <iframe
                                        width="100%"
                                        height="100%"
                                        src={`https://www.youtube.com/embed/${getYouTubeId(formData.video_url)}`}
                                        frameBorder="0"
                                        allowFullScreen
                                        style={{ border: 'none' }}
                                    />
                                ) : formData.video_url.match(/\.(mp4|mov|webm)$/i) || formData.video_url.includes('supabase.co') ? (
                                    <video 
                                        src={formData.video_url} 
                                        controls 
                                        style={{ maxHeight: '100%', maxWidth: '100%' }}
                                    />
                                ) : (
                                    <a href={formData.video_url} target="_blank" rel="noopener noreferrer" style={{ color: '#fff' }}>Link Externo (sem preview)</a>
                                )}
                            </div>
                        )}
                    </label>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 16 }}>
                        <button className="btn" onClick={closeModal} style={{ background: '#f1f5f9', color: '#64748b' }}>Cancelar</button>
                        <button className="btn-primary" onClick={handleSave} disabled={saving}>
                            {saving ? 'Salvando...' : 'Salvar'}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}
