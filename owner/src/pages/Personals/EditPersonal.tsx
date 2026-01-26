import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export default function EditPersonal() {
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()
    const id = searchParams.get('id')

    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [msg, setMsg] = useState('')
    const [error, setError] = useState('')

    // Form states
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [phone, setPhone] = useState('')
    const [status, setStatus] = useState('active')
    const [brandName, setBrandName] = useState('')
    const [logoUrl, setLogoUrl] = useState('')
    const [uploadingLogo, setUploadingLogo] = useState(false)
    const [evolutionMode, setEvolutionMode] = useState('anamnesis') // 'anamnesis' | 'standalone'

    useEffect(() => {
        if (!id) {
            navigate('/personals/list')
            return
        }
        loadPersonal(id)
    }, [id])

    async function loadPersonal(personalId: string) {
        setLoading(true)
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', personalId)
            .single()

        if (error || !data) {
            console.error(error)
            setError('Personal não encontrado.')
            setLoading(false)
            return
        }

        setName(data.full_name || '')
        setEmail(data.email || '')
        setPhone(data.data?.phone || '')
        setStatus(data.data?.status || 'active')
        setBrandName(data.data?.branding?.brandName || '')
        setLogoUrl(data.data?.branding?.logoUrl || '')
        setEvolutionMode(data.data?.config?.evolutionMode || 'anamnesis')
        setLoading(false)
    }

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return
        const file = e.target.files[0]
        
        if (file.size > 2 * 1024 * 1024) {
            alert('A imagem deve ter no máximo 2MB.')
            return
        }

        const fileExt = file.name.split('.').pop()
        const fileName = `personal-logos/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`

        setUploadingLogo(true)
        try {
            const { error: uploadError } = await supabase.storage
                .from('logos')
                .upload(fileName, file)

            if (uploadError) throw uploadError

            const { data } = supabase.storage.from('logos').getPublicUrl(fileName)
            setLogoUrl(data.publicUrl)
        } catch (error: any) {
            console.error(error)
            alert('Erro ao fazer upload: ' + error.message)
        } finally {
            setUploadingLogo(false)
        }
    }

    const onSave = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!id) return

        setSaving(true)
        setError('')
        setMsg('')

        // Fetch current data to merge (avoid overwriting other fields)
        const { data: currentProfile } = await supabase.from('profiles').select('data').eq('id', id).single()
        const currentData = currentProfile?.data || {}

        const newData = {
            ...currentData,
            phone,
            status,
            branding: {
                ...(currentData.branding || {}),
                brandName,
                logoUrl
            },
            config: {
                ...(currentData.config || {}),
                evolutionMode
            }
        }

        const { error } = await supabase.from('profiles').update({
            full_name: name,
            data: newData
        }).eq('id', id)

        if (error) {
            setError('Erro ao atualizar: ' + error.message)
        } else {
            setMsg('Dados atualizados com sucesso!')
        }
        setSaving(false)
    }

    if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Carregando...</div>

    return (
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
            <h1 style={{ fontSize: '1.8rem', color: '#0f172a', marginBottom: 24 }}>Editar Personal</h1>
            
            <div style={{ background: '#fff', padding: 32, borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                <form onSubmit={onSave} style={{ display: 'grid', gap: 20 }}>
                    
                    {/* Campos Principais */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <span style={{ fontWeight: 500, color: '#475569' }}>Nome Completo</span>
                            <input 
                                value={name} 
                                onChange={e => setName(e.target.value)} 
                                style={{ padding: 12, borderRadius: 8, border: '1px solid #cbd5e1' }}
                            />
                        </label>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <span style={{ fontWeight: 500, color: '#475569' }}>Email (Login)</span>
                            <input 
                                value={email} 
                                disabled
                                style={{ padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc', color: '#94a3b8' }}
                            />
                        </label>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <span style={{ fontWeight: 500, color: '#475569' }}>Telefone</span>
                            <input 
                                value={phone} 
                                onChange={e => setPhone(e.target.value)} 
                                style={{ padding: 12, borderRadius: 8, border: '1px solid #cbd5e1' }}
                            />
                        </label>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <span style={{ fontWeight: 500, color: '#475569' }}>Status</span>
                            <select 
                                value={status} 
                                onChange={e => setStatus(e.target.value)}
                                style={{ padding: 12, borderRadius: 8, border: '1px solid #cbd5e1' }}
                            >
                                <option value="active">Ativo</option>
                                <option value="inactive">Inativo</option>
                                <option value="blocked">Bloqueado</option>
                            </select>
                        </label>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20 }}>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <span style={{ fontWeight: 500, color: '#475569' }}>Modo de Evolução Fotográfica</span>
                            <select 
                                value={evolutionMode} 
                                onChange={e => setEvolutionMode(e.target.value)}
                                style={{ padding: 12, borderRadius: 8, border: '1px solid #cbd5e1' }}
                            >
                                <option value="anamnesis">Via Anamnese (Padrão)</option>
                                <option value="standalone">Avulso / Biblioteca (Sem Anamnese)</option>
                            </select>
                            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                                <strong>Via Anamnese:</strong> Fotos são extraídas automaticamente das respostas das anamneses.<br/>
                                <strong>Avulso:</strong> O personal envia fotos diretamente na tela de evolução, sem precisar de formulário.
                            </span>
                        </label>
                    </div>

                    <div style={{ borderTop: '1px solid #f1f5f9', margin: '10px 0' }}></div>
                    <h3 style={{ margin: 0, color: '#0f172a' }}>Identidade Visual</h3>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <span style={{ fontWeight: 500, color: '#475569' }}>Nome da Marca</span>
                            <input 
                                value={brandName} 
                                onChange={e => setBrandName(e.target.value)} 
                                style={{ padding: 12, borderRadius: 8, border: '1px solid #cbd5e1' }}
                            />
                        </label>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <span style={{ fontWeight: 500, color: '#475569' }}>Logo</span>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <input 
                                    value={logoUrl} 
                                    onChange={e => setLogoUrl(e.target.value)} 
                                    placeholder="https://..." 
                                    style={{ padding: 12, borderRadius: 8, border: '1px solid #cbd5e1', flex: 1 }}
                                />
                                <label style={{ 
                                    background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 8, 
                                    padding: '0 16px', display: 'flex', alignItems: 'center', cursor: 'pointer',
                                    whiteSpace: 'nowrap', fontSize: '0.9rem', color: '#475569'
                                }}>
                                    {uploadingLogo ? '⏳' : '📁 Upload'}
                                    <input type="file" accept="image/*" onChange={handleLogoUpload} style={{ display: 'none' }} disabled={uploadingLogo} />
                                </label>
                            </div>
                            {logoUrl && (
                                <div style={{ marginTop: 4 }}>
                                    <img src={logoUrl} alt="Preview" style={{ height: 40, borderRadius: 4, objectFit: 'contain', border: '1px solid #e2e8f0' }} />
                                </div>
                            )}
                        </label>
                    </div>

                    {error && <div style={{ background: '#fef2f2', color: '#ef4444', padding: 12, borderRadius: 8, textAlign: 'center' }}>{error}</div>}
                    {msg && <div style={{ background: '#dcfce7', color: '#166534', padding: 12, borderRadius: 8, textAlign: 'center' }}>{msg}</div>}

                    <div style={{ display: 'flex', gap: 12 }}>
                        <button 
                            type="button" 
                            onClick={() => navigate('/personals/list')}
                            style={{ 
                                background: '#fff', border: '1px solid #cbd5e1', color: '#475569', 
                                padding: 14, borderRadius: 8, cursor: 'pointer', fontWeight: 600, flex: 1
                            }}
                        >
                            Voltar
                        </button>
                        <button 
                            type="submit" 
                            disabled={saving}
                            style={{ 
                                background: '#0f172a', color: '#fff', border: 'none',
                                padding: 14, borderRadius: 8, cursor: 'pointer', fontWeight: 600, flex: 2,
                                opacity: saving ? 0.7 : 1
                            }}
                        >
                            {saving ? 'Salvando...' : 'Salvar Alterações'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
