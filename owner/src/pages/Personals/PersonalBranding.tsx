import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import Modal from '../../components/Modal'

type Personal = {
    id: string
    name: string
    email: string
    logoUrl?: string
    brandName?: string
    sidebarColor?: string
    buttonColor?: string
    accentColor?: string
}

export default function PersonalBranding() {
    const [personals, setPersonals] = useState<Personal[]>([])
    const [selected, setSelected] = useState<Personal | null>(null)
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [q, setQ] = useState('')
    
    // Estados do Modal
    const [brandName, setBrandName] = useState('')
    const [logoUrl, setLogoUrl] = useState('')
    const [uploadingLogo, setUploadingLogo] = useState(false)
    const [sidebarColor, setSidebarColor] = useState('#0f172a')
    const [buttonColor, setButtonColor] = useState('#3b82f6')
    const [accentColor, setAccentColor] = useState('#f59e0b')
    const [saving, setSaving] = useState(false)

    async function loadPersonals() {
        setLoading(true)
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('role', 'personal')
            .order('full_name')
        
        if (data) {
            setPersonals(data.map((p: any) => ({
                id: p.id,
                name: p.full_name || 'Sem nome',
                email: p.email || p.data?.email || '',
                logoUrl: p.data?.branding?.logoUrl,
                brandName: p.data?.branding?.brandName,
                sidebarColor: p.data?.branding?.sidebarColor || '#0f172a',
                buttonColor: p.data?.branding?.buttonColor || '#3b82f6',
                accentColor: p.data?.branding?.accentColor || '#f59e0b',
            })))
        }
        setLoading(false)
    }

    useEffect(() => {
        loadPersonals()
    }, [])

    const handleEdit = (p: Personal) => {
        setSelected(p)
        setBrandName(p.brandName || '')
        setLogoUrl(p.logoUrl || '')
        setSidebarColor(p.sidebarColor || '#0f172a')
        setButtonColor(p.buttonColor || '#3b82f6')
        setAccentColor(p.accentColor || '#f59e0b')
        setShowModal(true)
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

    const saveBranding = async () => {
        if (!selected) return
        setSaving(true)
        
        const { data: currentData } = await supabase
            .from('profiles')
            .select('data')
            .eq('id', selected.id)
            .single()
            
        const newData = {
            ...(currentData?.data || {}),
            branding: {
                brandName,
                logoUrl,
                sidebarColor,
                buttonColor,
                accentColor
            }
        }

        const { error } = await supabase
            .from('profiles')
            .update({ data: newData })
            .eq('id', selected.id)

        if (!error) {
            await loadPersonals()
            setShowModal(false)
        } else {
            alert('Erro ao salvar branding')
        }
        setSaving(false)
    }

    const filtered = personals.filter(p => 
        p.name.toLowerCase().includes(q.toLowerCase()) || 
        p.email.toLowerCase().includes(q.toLowerCase())
    )

    if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Carregando personais...</div>

    return (
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
                <div>
                    <h1 style={{ fontSize: '1.8rem', color: '#0f172a', margin: 0 }}>Branding e Personalização</h1>
                    <p style={{ color: '#64748b', marginTop: 4 }}>Gerencie a identidade visual de cada personal.</p>
                </div>
                <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}>🔍</span>
                    <input 
                        value={q} 
                        onChange={e => setQ(e.target.value)} 
                        placeholder="Buscar personal..." 
                        style={{ padding: '10px 12px 10px 36px', borderRadius: 8, border: '1px solid #cbd5e1', width: 200 }}
                    />
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 24 }}>
                {filtered.map(p => (
                    <div key={p.id} style={{ 
                        background: '#fff', borderRadius: 16, 
                        border: '1px solid #e2e8f0', overflow: 'hidden',
                        transition: 'transform 0.2s, box-shadow 0.2s'
                    }}
                    onMouseEnter={e => {
                        e.currentTarget.style.transform = 'translateY(-2px)'
                        e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                    }}
                    onMouseLeave={e => {
                        e.currentTarget.style.transform = 'translateY(0)'
                        e.currentTarget.style.boxShadow = 'none'
                    }}
                    >
                        {/* Preview do Branding (Simulando uma mini sidebar) */}
                        <div style={{ height: 100, background: p.sidebarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                            <div style={{ width: 64, height: 64, borderRadius: 12, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                                {p.logoUrl ? <img src={p.logoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '👤'}
                            </div>
                            {/* Badges de Cores */}
                            <div style={{ position: 'absolute', bottom: 12, right: 12, display: 'flex', gap: 6 }}>
                                <div title="Botão" style={{ width: 16, height: 16, borderRadius: '50%', background: p.buttonColor, border: '2px solid #fff' }} />
                                <div title="Destaque" style={{ width: 16, height: 16, borderRadius: '50%', background: p.accentColor, border: '2px solid #fff' }} />
                            </div>
                        </div>

                        <div style={{ padding: 24 }}>
                            <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '1.1rem' }}>{p.name}</div>
                            <div style={{ fontSize: '0.9rem', color: '#64748b' }}>{p.email}</div>
                            
                            <div style={{ marginTop: 12, fontSize: '0.9rem', color: '#475569', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span>Marca:</span>
                                {p.brandName ? (
                                    <span style={{ fontWeight: 600, color: '#0f172a' }}>{p.brandName}</span>
                                ) : (
                                    <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Não definida</span>
                                )}
                            </div>
                        </div>

                        <div style={{ padding: '16px 24px', background: '#f8fafc', borderTop: '1px solid #f1f5f9' }}>
                            <button 
                                onClick={() => handleEdit(p)}
                                style={{ 
                                    width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #cbd5e1',
                                    background: '#fff', color: '#0f172a', fontWeight: 600, cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                                }}
                            >
                                🎨 Personalizar Marca
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <Modal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title={`Branding: ${selected?.name}`}
                width={700}
                footer={
                    <>
                        <button className="btn" style={{ background: '#fff', border: '1px solid #e2e8f0', color: '#64748b', padding: '10px 20px', borderRadius: 8, cursor: 'pointer' }} onClick={() => setShowModal(false)}>Cancelar</button>
                        <button className="btn" style={{ background: '#0f172a', color: '#fff', padding: '10px 24px', borderRadius: 8, border: 'none', cursor: 'pointer', opacity: saving ? 0.7 : 1 }} disabled={saving} onClick={saveBranding}>
                            {saving ? 'Salvando...' : 'Salvar Branding'}
                        </button>
                    </>
                }
            >
                {selected && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                        <div style={{ display: 'grid', gap: 16 }}>
                            <label style={{ display: 'grid', gap: 6 }}>
                                <span style={{ fontWeight: 600, color: '#475569' }}>Nome da Marca / Estúdio</span>
                                <input 
                                    value={brandName} 
                                    onChange={e => setBrandName(e.target.value)} 
                                    placeholder="Ex: Studio Fitness"
                                    style={{ padding: 12, borderRadius: 8, border: '1px solid #cbd5e1' }}
                                />
                            </label>

                            <label style={{ display: 'grid', gap: 6 }}>
                                <span style={{ fontWeight: 600, color: '#475569' }}>Logo</span>
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
                            </label>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                                <label style={{ display: 'grid', gap: 6 }}>
                                    <span style={{ fontSize: '0.9rem', color: '#475569' }}>Menu Lateral</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #cbd5e1', padding: 8, borderRadius: 8 }}>
                                        <input type="color" value={sidebarColor} onChange={e => setSidebarColor(e.target.value)} style={{ width: 32, height: 32, border: 'none', background: 'none' }} />
                                    </div>
                                </label>
                                <label style={{ display: 'grid', gap: 6 }}>
                                    <span style={{ fontSize: '0.9rem', color: '#475569' }}>Botões</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #cbd5e1', padding: 8, borderRadius: 8 }}>
                                        <input type="color" value={buttonColor} onChange={e => setButtonColor(e.target.value)} style={{ width: 32, height: 32, border: 'none', background: 'none' }} />
                                    </div>
                                </label>
                                <label style={{ display: 'grid', gap: 6 }}>
                                    <span style={{ fontSize: '0.9rem', color: '#475569' }}>Destaque</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #cbd5e1', padding: 8, borderRadius: 8 }}>
                                        <input type="color" value={accentColor} onChange={e => setAccentColor(e.target.value)} style={{ width: 32, height: 32, border: 'none', background: 'none' }} />
                                    </div>
                                </label>
                            </div>
                        </div>

                        {/* Live Preview */}
                        <div style={{ background: '#f8fafc', padding: 20, borderRadius: 16, border: '1px solid #e2e8f0' }}>
                            <div style={{ fontWeight: 600, color: '#475569', marginBottom: 12, textAlign: 'center' }}>Pré-visualização</div>
                            
                            <div style={{ 
                                width: '100%', height: 300, background: '#fff', borderRadius: 12, overflow: 'hidden',
                                boxShadow: '0 10px 20px -5px rgba(0,0,0,0.1)', display: 'flex', border: '1px solid #e2e8f0'
                            }}>
                                {/* Fake Sidebar */}
                                <div style={{ width: 80, background: sidebarColor, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 12, gap: 16 }}>
                                    <div style={{ width: 40, height: 40, borderRadius: 8, background: '#fff', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        {logoUrl ? <img src={logoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : 'Logo'}
                                    </div>
                                    <div style={{ width: 30, height: 6, background: 'rgba(255,255,255,0.2)', borderRadius: 3 }} />
                                    <div style={{ width: 30, height: 6, background: 'rgba(255,255,255,0.2)', borderRadius: 3 }} />
                                    <div style={{ width: 30, height: 6, background: 'rgba(255,255,255,0.2)', borderRadius: 3 }} />
                                </div>
                                
                                {/* Fake Content */}
                                <div style={{ flex: 1, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
                                    <div style={{ fontSize: '1.2rem', fontWeight: 700, color: sidebarColor }}>
                                        {brandName || 'Minha Marca'}
                                    </div>
                                    
                                    <div style={{ padding: 16, background: '#f1f5f9', borderRadius: 8 }}>
                                        <div style={{ fontSize: '0.9rem', color: accentColor, fontWeight: 600, marginBottom: 4 }}>Destaque</div>
                                        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Exemplo de conteúdo com cor de destaque.</div>
                                    </div>

                                    <button style={{ 
                                        background: buttonColor, color: '#fff', border: 'none', 
                                        padding: '10px', borderRadius: 6, cursor: 'pointer', fontWeight: 600
                                    }}>
                                        Botão Principal
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    )
}
