import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function Branding() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  // Estados de Branding
  const [brandName, setBrandName] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [uploadingLogo, setUploadingLogo] = useState(false)
  
  // Cores
  const [sidebarColor, setSidebarColor] = useState('#0f172a')
  const [buttonColor, setButtonColor] = useState('#3b82f6')
  const [accentColor, setAccentColor] = useState('#f59e0b')

  const [userId, setUserId] = useState('')

  useEffect(() => {
    loadConfig()
  }, [])

  async function loadConfig() {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
          setUserId(user.id)
          // Buscar do perfil (unificado com o Owner)
          const { data } = await supabase
              .from('profiles')
              .select('data')
              .eq('id', user.id)
              .single()
          
          if (data?.data?.branding) {
              const b = data.data.branding
              setBrandName(b.brandName || '')
              setLogoUrl(b.logoUrl || '')
              setSidebarColor(b.sidebarColor || '#0f172a')
              setButtonColor(b.buttonColor || '#3b82f6')
              setAccentColor(b.accentColor || '#f59e0b')
          }
      }
      setLoading(false)
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    const file = e.target.files[0]
    
    if (file.size > 2 * 1024 * 1024) {
        setError('A imagem deve ter no máximo 2MB.')
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
        setError('')
    } catch (err: any) {
        console.error(err)
        setError('Erro ao fazer upload: ' + err.message)
    } finally {
        setUploadingLogo(false)
    }
  }

  const save = async () => {
    setSaving(true)
    setMsg('')
    setError('')

    try {
        const { data: currentData } = await supabase
            .from('profiles')
            .select('data')
            .eq('id', userId)
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
            .eq('id', userId)

        if (error) throw error

        setMsg('Identidade visual atualizada com sucesso!')
        
        // Disparar evento para atualizar a Sidebar em tempo real
        const brandingEvent = { 
            brandTitle: brandName, 
            brandLogoUrl: logoUrl,
            // Cores podem ser usadas se a sidebar suportar customização via CSS variables ou similar
        }
        localStorage.setItem('personal_branding', JSON.stringify(brandingEvent))
        window.dispatchEvent(new Event('personal-branding-changed'))

    } catch (err: any) {
        console.error(err)
        setError('Erro ao salvar: ' + err.message)
    } finally {
        setSaving(false)
    }
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Carregando...</div>

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: '1.8rem', color: '#0f172a', margin: 0 }}>Identidade Visual</h1>
        <p style={{ color: '#64748b', marginTop: 4 }}>Personalize a aparência do seu painel e do app dos seus alunos.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, alignItems: 'start' }}>
        
        {/* Coluna da Esquerda: Formulário */}
        <div style={{ display: 'grid', gap: 24 }}>
            
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 24 }}>
                <h3 style={{ margin: '0 0 20px 0', fontSize: '1.1rem', color: '#0f172a' }}>Marca e Logo</h3>
                <div style={{ display: 'grid', gap: 20 }}>
                    <label style={{ display: 'grid', gap: 8 }}>
                        <span style={{ fontWeight: 500, color: '#475569' }}>Nome da Marca / Estúdio</span>
                        <input 
                            value={brandName} 
                            onChange={e => setBrandName(e.target.value)} 
                            placeholder="Ex: Studio Fitness"
                            style={{ padding: 12, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '1rem' }}
                        />
                    </label>

                    <label style={{ display: 'grid', gap: 8 }}>
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
                                whiteSpace: 'nowrap', fontSize: '0.9rem', color: '#475569', fontWeight: 500
                            }}>
                                {uploadingLogo ? '⏳ ...' : '📁 Upload'}
                                <input type="file" accept="image/*" onChange={handleLogoUpload} style={{ display: 'none' }} disabled={uploadingLogo} />
                            </label>
                        </div>
                    </label>
                </div>
            </div>

            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 24 }}>
                <h3 style={{ margin: '0 0 20px 0', fontSize: '1.1rem', color: '#0f172a' }}>Cores do Tema</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <label style={{ display: 'grid', gap: 8 }}>
                        <span style={{ fontSize: '0.9rem', color: '#475569', fontWeight: 500 }}>Menu Lateral</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #cbd5e1', padding: 8, borderRadius: 8 }}>
                            <input type="color" value={sidebarColor} onChange={e => setSidebarColor(e.target.value)} style={{ width: 32, height: 32, border: 'none', background: 'none', cursor: 'pointer' }} />
                            <span style={{ fontSize: '0.9rem', color: '#64748b' }}>{sidebarColor}</span>
                        </div>
                    </label>
                    <label style={{ display: 'grid', gap: 8 }}>
                        <span style={{ fontSize: '0.9rem', color: '#475569', fontWeight: 500 }}>Botões</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #cbd5e1', padding: 8, borderRadius: 8 }}>
                            <input type="color" value={buttonColor} onChange={e => setButtonColor(e.target.value)} style={{ width: 32, height: 32, border: 'none', background: 'none', cursor: 'pointer' }} />
                            <span style={{ fontSize: '0.9rem', color: '#64748b' }}>{buttonColor}</span>
                        </div>
                    </label>
                    <label style={{ display: 'grid', gap: 8 }}>
                        <span style={{ fontSize: '0.9rem', color: '#475569', fontWeight: 500 }}>Destaque</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #cbd5e1', padding: 8, borderRadius: 8 }}>
                            <input type="color" value={accentColor} onChange={e => setAccentColor(e.target.value)} style={{ width: 32, height: 32, border: 'none', background: 'none', cursor: 'pointer' }} />
                            <span style={{ fontSize: '0.9rem', color: '#64748b' }}>{accentColor}</span>
                        </div>
                    </label>
                </div>
            </div>

            {error && <div style={{ background: '#fef2f2', color: '#ef4444', padding: 16, borderRadius: 12, textAlign: 'center', fontWeight: 500 }}>{error}</div>}
            {msg && <div style={{ background: '#dcfce7', color: '#166534', padding: 16, borderRadius: 12, textAlign: 'center', fontWeight: 500 }}>{msg}</div>}

            <button 
                onClick={save}
                disabled={saving}
                style={{ 
                    background: '#0f172a', color: '#fff', padding: '16px', borderRadius: 12, border: 'none', 
                    fontSize: '1rem', fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.7 : 1,
                    boxShadow: '0 4px 6px -1px rgba(15, 23, 42, 0.1)'
                }}
            >
                {saving ? 'Salvando...' : 'Salvar Identidade Visual'}
            </button>

        </div>

        {/* Coluna da Direita: Preview */}
        <div style={{ position: 'sticky', top: 24 }}>
            <div style={{ background: '#f8fafc', padding: 24, borderRadius: 24, border: '1px solid #e2e8f0' }}>
                <div style={{ fontWeight: 600, color: '#475569', marginBottom: 16, textAlign: 'center', textTransform: 'uppercase', fontSize: '0.85rem', letterSpacing: '0.05em' }}>
                    Pré-visualização
                </div>
                
                <div style={{ 
                    width: '100%', height: 400, background: '#fff', borderRadius: 16, overflow: 'hidden',
                    boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)', 
                    display: 'flex', border: '1px solid #e2e8f0'
                }}>
                    {/* Fake Sidebar */}
                    <div style={{ width: 80, background: sidebarColor, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 16, gap: 20 }}>
                        <div style={{ width: 48, height: 48, borderRadius: 10, background: '#fff', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 2 }}>
                            {logoUrl ? <img src={logoUrl} style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <span style={{fontSize: '1.5rem'}}>💪</span>}
                        </div>
                        <div style={{ width: 32, height: 6, background: 'rgba(255,255,255,0.2)', borderRadius: 3 }} />
                        <div style={{ width: 32, height: 6, background: 'rgba(255,255,255,0.2)', borderRadius: 3 }} />
                        <div style={{ width: 32, height: 6, background: 'rgba(255,255,255,0.2)', borderRadius: 3 }} />
                        <div style={{ marginTop: 'auto', width: 24, height: 24, borderRadius: '50%', background: 'rgba(255,255,255,0.2)' }} />
                    </div>
                    
                    {/* Fake Content */}
                    <div style={{ flex: 1, padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
                                {brandName || 'Minha Marca'}
                            </div>
                            <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#f1f5f9' }} />
                        </div>
                        
                        <div style={{ padding: 20, background: '#f8fafc', borderRadius: 12, border: '1px solid #f1f5f9' }}>
                            <div style={{ fontSize: '0.9rem', color: accentColor, fontWeight: 700, marginBottom: 6, textTransform: 'uppercase' }}>Destaque</div>
                            <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#0f172a', marginBottom: 4 }}>Treino A - Hipertrofia</div>
                            <div style={{ fontSize: '0.9rem', color: '#64748b' }}>Exemplo de como as cores interagem com o conteúdo.</div>
                        </div>

                        <div style={{ display: 'flex', gap: 12 }}>
                            <button style={{ 
                                background: buttonColor, color: '#fff', border: 'none', 
                                padding: '12px 24px', borderRadius: 8, cursor: 'pointer', fontWeight: 600,
                                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
                            }}>
                                Botão Principal
                            </button>
                            <button style={{ 
                                background: '#fff', color: '#475569', border: '1px solid #cbd5e1', 
                                padding: '12px 24px', borderRadius: 8, cursor: 'pointer', fontWeight: 600
                            }}>
                                Secundário
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  )
}
