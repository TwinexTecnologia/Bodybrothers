import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'

// Cria um cliente secundário ISOLADO para não deslogar o owner
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Cliente descartável que não salva sessão no localStorage
const supabaseCreator = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
})

function validEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

function validPassword(v: string) {
  if (v.length < 6) return false
  return true
}

export default function CreatePersonal() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  // Campos de Branding (Salvos no campo 'data' do profile)
  const [brandName, setBrandName] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [uploadingLogo, setUploadingLogo] = useState(false)

  const [evolutionMode, setEvolutionMode] = useState('anamnesis')
  const [anamnesisReviewRequired, setAnamnesisReviewRequired] = useState(false)

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    
    const file = e.target.files[0]
    
    // Validar tamanho (ex: 2MB)
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
        alert('Erro ao fazer upload. Verifique se o bucket "logos" foi criado no Supabase (use o script create_logos_bucket.sql).')
    } finally {
        setUploadingLogo(false)
    }
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setMsg('')
    setLoading(true)

    if (!name || !email || !password) {
        setError('Preencha nome, email e senha.')
        setLoading(false)
        return
    }

    if (!validEmail(email)) {
        setError('Email inválido.')
        setLoading(false)
        return
    }

    if (!validPassword(password)) {
        setError('Senha deve ter no mínimo 6 caracteres.')
        setLoading(false)
        return
    }

    try {
        console.log('Tentando criar personal:', { email })

        // 1. Criar Usuário no Auth (Cliente Isolado)
        const { data: authData, error: authError } = await supabaseCreator.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: name,
                    role: 'personal', // Importante: Metadado que o trigger usa
                    phone: phone,
                    branding: {
                        brandName,
                        logoUrl
                    },
                    config: {
                        evolutionMode,
                        anamnesisReviewRequired
                    }
                }
            }
        })

        if (authError) throw authError

        if (authData.user) {
            console.log('Usuário Auth criado com ID:', authData.user.id)

            // 2. Garantir Perfil (Tentativa direta via tabela profiles)
            // O Owner DEVE ter permissão RLS para fazer isso.
            const { error: profileError } = await supabase.from('profiles').upsert({
                id: authData.user.id,
                email: email,
                role: 'personal',
                full_name: name,
                data: {
                    phone: phone,
                    branding: {
                        brandName,
                        logoUrl
                    }
                }
            })

            if (profileError) {
                console.error('Erro ao criar perfil:', profileError)
                // Se der erro de permissão (42501), significa que o Owner não tem permissão de INSERT no banco.
                // Nesse caso, só resolvendo no banco. Mas vamos tentar.
                setError('Erro ao salvar perfil: ' + profileError.message + ' (Código: ' + profileError.code + ')')
                return
            }

            setMsg(`Personal criado com sucesso! ID: ${authData.user.id}`)
            // Limpar form
            setName('')
            setEmail('')
            setPassword('')
            setPhone('')
            setBrandName('')
            setLogoUrl('')
        } else {
            setError('Usuário criado, mas sem confirmação. Verifique se o email requer confirmação.')
        }

    } catch (err: any) {
        console.error(err)
        if (err.message?.includes('User already registered') || err.message?.includes('already registered')) {
            setError('Este email já está cadastrado no sistema.')
        } else {
            setError(err.message || 'Erro ao criar personal.')
        }
    } finally {
        setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.8rem', color: '#0f172a', marginBottom: 24 }}>Criar Novo Personal</h1>
      
      <div style={{ background: '#fff', padding: 32, borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
        <form onSubmit={onSubmit} style={{ display: 'grid', gap: 20 }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ fontWeight: 500, color: '#475569' }}>Nome Completo</span>
                <input 
                    value={name} 
                    onChange={e => setName(e.target.value)} 
                    placeholder="Ex: João Silva" 
                    style={{ padding: 12, borderRadius: 8, border: '1px solid #cbd5e1' }}
                />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ fontWeight: 500, color: '#475569' }}>Telefone (Opcional)</span>
                <input 
                    value={phone} 
                    onChange={e => setPhone(e.target.value)} 
                    placeholder="(11) 99999-9999" 
                    style={{ padding: 12, borderRadius: 8, border: '1px solid #cbd5e1' }}
                />
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ fontWeight: 500, color: '#475569' }}>Email de Acesso</span>
                <input 
                    type="email"
                    value={email} 
                    onChange={e => setEmail(e.target.value)} 
                    placeholder="email@exemplo.com" 
                    style={{ padding: 12, borderRadius: 8, border: '1px solid #cbd5e1' }}
                />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ fontWeight: 500, color: '#475569' }}>Senha Inicial</span>
                <input 
                    type="password"
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                    placeholder="Mínimo 6 caracteres" 
                    style={{ padding: 12, borderRadius: 8, border: '1px solid #cbd5e1' }}
                />
            </label>
          </div>

          <div style={{ borderTop: '1px solid #f1f5f9', margin: '10px 0' }}></div>
          <h3 style={{ margin: 0, color: '#0f172a' }}>Configurações</h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ fontWeight: 500, color: '#475569' }}>Modo de Evolução</span>
                <select 
                    value={evolutionMode} 
                    onChange={e => setEvolutionMode(e.target.value)} 
                    style={{ padding: 12, borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff' }}
                >
                    <option value="anamnesis">Anamnese</option>
                    <option value="manual">Manual</option>
                </select>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 30 }}>
                <input 
                    type="checkbox"
                    checked={anamnesisReviewRequired}
                    onChange={e => setAnamnesisReviewRequired(e.target.checked)}
                    style={{ width: 18, height: 18 }}
                />
                <span style={{ fontWeight: 500, color: '#475569' }}>Exigir Revisão de Anamnese?</span>
            </label>
          </div>

          <div style={{ borderTop: '1px solid #f1f5f9', margin: '10px 0' }}></div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#f8fafc', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <input 
                    type="checkbox"
                    checked={anamnesisReviewRequired}
                    onChange={e => setAnamnesisReviewRequired(e.target.checked)}
                    style={{ width: 20, height: 20, cursor: 'pointer' }}
                />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 600, color: '#0f172a' }}>Exigir aprovação manual de anamneses?</span>
                    <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                        Se marcado, o personal deve aprovar cada anamnese manualmente antes de ela contar como válida/renovada.
                    </span>
                </div>
            </label>
          </div>

          <div style={{ borderTop: '1px solid #f1f5f9', margin: '10px 0' }}></div>
          <h3 style={{ margin: 0, color: '#0f172a' }}>Identidade Visual (Opcional)</h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ fontWeight: 500, color: '#475569' }}>Nome da Marca / Estúdio</span>
                <input 
                    value={brandName} 
                    onChange={e => setBrandName(e.target.value)} 
                    placeholder="Ex: JS Personal Trainer" 
                    style={{ padding: 12, borderRadius: 8, border: '1px solid #cbd5e1' }}
                />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ fontWeight: 500, color: '#475569' }}>URL do Logo</span>
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
                        {uploadingLogo ? '⏳ ...' : '📁 Upload'}
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

          <button 
            type="submit" 
            disabled={loading}
            style={{ 
                background: '#0f172a', color: '#fff', padding: 14, borderRadius: 8, border: 'none', 
                cursor: 'pointer', fontWeight: 600, fontSize: '1rem', marginTop: 10,
                opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? 'Criando Personal...' : 'Cadastrar Personal'}
          </button>
        </form>
      </div>
    </div>
  )
}
