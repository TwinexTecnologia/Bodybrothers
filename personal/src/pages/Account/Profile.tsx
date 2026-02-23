import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function Profile() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  // Dados do Perfil
  const [id, setId] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  
  // Configuração de Evolução
  const [evolutionMode, setEvolutionMode] = useState('anamnesis') // 'anamnesis' | 'standalone'
  const [evolutionFields, setEvolutionFields] = useState<any[]>([]) 

  // Dados de Senha
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  useEffect(() => {
    loadProfile()
  }, [])

  async function loadProfile() {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) throw new Error('Usuário não autenticado')
      
      setId(user.id)
      setEmail(user.email || '')

      // Buscar dados do profile
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profile) {
        setName(profile.full_name || '')
        setPhone(profile.data?.phone || '')
        setEvolutionMode(profile.data?.config?.evolutionMode || 'anamnesis')
        setEvolutionFields(profile.data?.config?.evolutionFields || [])
      }
    } catch (error: any) {
      console.error(error)
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleAddField = () => {
    setEvolutionFields(prev => [...prev, { id: Date.now().toString(), label: '', exampleUrl: '' }])
  }

  const handleRemoveField = (fieldId: string) => {
    setEvolutionFields(prev => prev.filter(f => f.id !== fieldId))
  }

  const handleUpdateField = (fieldId: string, key: string, value: string) => {
    setEvolutionFields(prev => prev.map(f => f.id === fieldId ? { ...f, [key]: value } : f))
  }

  const handleFieldExampleUpload = async (fieldId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    const file = e.target.files[0]
    const fileExt = file.name.split('.').pop()
    const fileName = `examples/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`

    try {
        const { error: uploadError } = await supabase.storage
            .from('logos') // Usando bucket logos por conveniência
            .upload(fileName, file)

        if (uploadError) throw uploadError

        const { data } = supabase.storage.from('logos').getPublicUrl(fileName)
        handleUpdateField(fieldId, 'exampleUrl', data.publicUrl)
    } catch (err: any) {
        alert('Erro upload: ' + err.message)
    }
  }

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMsg('')
    setError('')

    try {
      // 1. Atualizar Profile (Nome, Telefone, Config Evolução)
      // Primeiro buscamos o dado atual para não perder outros campos do JSONB
      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('data')
        .eq('id', id)
        .single()

      const newData = {
        ...(currentProfile?.data || {}),
        phone: phone,
        config: {
          ...(currentProfile?.data?.config || {}),
          evolutionMode,
          evolutionFields
        }
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          full_name: name,
          data: newData
        })
        .eq('id', id)

      if (updateError) throw updateError

      // 2. Atualizar Senha (se preenchida)
      if (newPassword) {
        if (newPassword.length < 6) {
            throw new Error('A senha deve ter no mínimo 6 caracteres.')
        }
        if (newPassword !== confirmPassword) {
            throw new Error('As senhas não conferem.')
        }

        const { error: passwordError } = await supabase.auth.updateUser({
            password: newPassword
        })

        if (passwordError) throw passwordError
        setNewPassword('')
        setConfirmPassword('')
      }

      setMsg('Perfil atualizado com sucesso!')
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Erro ao atualizar perfil.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Carregando perfil...</div>

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: '1.8rem', color: '#0f172a', margin: 0 }}>Minha Conta</h1>
        <p style={{ color: '#64748b', marginTop: 4 }}>Gerencie suas informações pessoais e segurança.</p>
      </div>

      <form onSubmit={handleUpdateProfile} style={{ display: 'grid', gap: 24 }}>
        
        {/* Card: Informações Pessoais */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>Informações Pessoais</h3>
          </div>
          <div style={{ padding: 24, display: 'grid', gap: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ fontWeight: 500, color: '#475569' }}>Nome Completo</span>
                <input 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  style={{ padding: 12, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '1rem' }}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ fontWeight: 500, color: '#475569' }}>Telefone</span>
                <input 
                  value={phone} 
                  onChange={e => setPhone(e.target.value)} 
                  placeholder="(00) 00000-0000"
                  style={{ padding: 12, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '1rem' }}
                />
              </label>
            </div>
            
            <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontWeight: 500, color: '#475569' }}>Email (Não alterável)</span>
              <input 
                value={email} 
                disabled
                style={{ padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', background: '#f1f5f9', color: '#94a3b8', fontSize: '1rem' }}
              />
            </label>
          </div>
        </div>

        {/* Card: Configuração de Evolução */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>Evolução dos Alunos</h3>
          </div>
          <div style={{ padding: 24, display: 'grid', gap: 20 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontWeight: 500, color: '#475569' }}>Modo de Evolução</span>
              <select 
                value={evolutionMode} 
                onChange={e => setEvolutionMode(e.target.value)}
                style={{ padding: 12, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '1rem' }}
              >
                <option value="anamnesis">Via Anamnese (Padrão)</option>
                <option value="standalone">Fotos Avulsas (Standalone)</option>
              </select>
              <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                <strong>Via Anamnese:</strong> Fotos são extraídas automaticamente das respostas das anamneses.<br/>
                <strong>Avulso:</strong> O aluno envia fotos diretamente na tela de evolução, sem precisar responder questionário.
              </span>
            </label>

            {/* Editor de Campos de Evolução (Apenas Standalone) */}
            {evolutionMode === 'standalone' && (
                <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#334155' }}>Campos Personalizados de Upload</h4>
                        <button type="button" onClick={handleAddField} style={{ fontSize: '0.8rem', padding: '6px 12px', background: '#e0f2fe', color: '#0369a1', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}>+ Adicionar Campo</button>
                    </div>
                    
                    {evolutionFields.length === 0 ? (
                        <div style={{ fontSize: '0.85rem', color: '#94a3b8', fontStyle: 'italic' }}>Nenhum campo definido (Upload livre).</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {evolutionFields.map((field, idx) => (
                                <div key={field.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', background: '#fff', padding: 12, borderRadius: 8, border: '1px solid #cbd5e1' }}>
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        <input 
                                            placeholder="Nome do Campo (ex: Frente Relaxado)" 
                                            value={field.label}
                                            onChange={e => handleUpdateField(field.id, 'label', e.target.value)}
                                            style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #e2e8f0', fontSize: '0.9rem' }}
                                        />
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            {field.exampleUrl ? (
                                                <img src={field.exampleUrl} alt="Exemplo" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6, border: '1px solid #e2e8f0' }} />
                                            ) : (
                                                <div style={{ width: 40, height: 40, borderRadius: 6, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', color: '#94a3b8', border: '1px solid #e2e8f0' }}>Sem foto</div>
                                            )}
                                            <label style={{ cursor: 'pointer', fontSize: '0.85rem', color: '#3b82f6', fontWeight: 500 }}>
                                                {field.exampleUrl ? 'Alterar Foto Exemplo' : 'Adicionar Foto Exemplo'}
                                                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleFieldExampleUpload(field.id, e)} />
                                            </label>
                                        </div>
                                    </div>
                                    <button type="button" onClick={() => handleRemoveField(field.id)} style={{ background: '#fee2e2', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 8, borderRadius: 6 }}>✕</button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
          </div>
        </div>

        {/* Card: Segurança */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>Segurança</h3>
          </div>
          <div style={{ padding: 24, display: 'grid', gap: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ fontWeight: 500, color: '#475569' }}>Nova Senha</span>
                <input 
                  type="password"
                  value={newPassword} 
                  onChange={e => setNewPassword(e.target.value)} 
                  placeholder="Deixe em branco para manter a atual"
                  style={{ padding: 12, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '1rem' }}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ fontWeight: 500, color: '#475569' }}>Confirmar Nova Senha</span>
                <input 
                  type="password"
                  value={confirmPassword} 
                  onChange={e => setConfirmPassword(e.target.value)} 
                  placeholder="Repita a nova senha"
                  style={{ padding: 12, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '1rem' }}
                />
              </label>
            </div>
          </div>
        </div>

        {error && <div style={{ background: '#fef2f2', color: '#ef4444', padding: 16, borderRadius: 12, textAlign: 'center', fontWeight: 500 }}>{error}</div>}
        {msg && <div style={{ background: '#dcfce7', color: '#166534', padding: 16, borderRadius: 12, textAlign: 'center', fontWeight: 500 }}>{msg}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button 
            type="submit" 
            disabled={saving}
            style={{ 
              background: '#0f172a', color: '#fff', padding: '14px 32px', borderRadius: 8, border: 'none', 
              fontSize: '1rem', fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.7 : 1,
              boxShadow: '0 4px 6px -1px rgba(15, 23, 42, 0.1)'
            }}
          >
            {saving ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>

      </form>
    </div>
  )
}
