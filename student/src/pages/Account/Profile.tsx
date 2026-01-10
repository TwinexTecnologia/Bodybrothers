import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Camera, Save, Lock, User } from 'lucide-react'

export default function Profile() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  // Dados do Usuário
  const [userId, setUserId] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  // Senha
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

      setUserId(user.id)
      setEmail(user.email || '')

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profile) {
        setName(profile.full_name || '')
        setPhone(profile.data?.phone || '')
        setPhotoUrl(profile.data?.avatarUrl || '')
      }
    } catch (err: any) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    const file = e.target.files[0]
    
    if (file.size > 5 * 1024 * 1024) {
        setError('A imagem deve ter no máximo 5MB.')
        return
    }

    setUploadingPhoto(true)
    setError('')
    try {
        const fileExt = file.name.split('.').pop()
        const fileName = `avatars/${userId}-${Date.now()}.${fileExt}`

        const { error: uploadError } = await supabase.storage
            .from('logos') // Usando bucket 'logos' por enquanto, ideal seria 'avatars'
            .upload(fileName, file)

        if (uploadError) throw uploadError

        const { data } = supabase.storage.from('logos').getPublicUrl(fileName)
        setPhotoUrl(data.publicUrl)
        setMsg('Foto carregada! Clique em Salvar para confirmar.')
    } catch (err: any) {
        console.error(err)
        setError('Erro ao enviar foto: ' + err.message)
    } finally {
        setUploadingPhoto(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMsg('')
    setError('')

    try {
        // 1. Atualizar Profile
        const { data: currentProfile } = await supabase
            .from('profiles')
            .select('data')
            .eq('id', userId)
            .single()

        const newData = {
            ...(currentProfile?.data || {}),
            phone,
            avatarUrl: photoUrl
        }

        const { error: updateError } = await supabase
            .from('profiles')
            .update({
                full_name: name,
                data: newData
            })
            .eq('id', userId)

        if (updateError) throw updateError

        // 2. Atualizar Senha
        if (newPassword) {
            if (newPassword.length < 6) throw new Error('A senha deve ter no mínimo 6 caracteres')
            if (newPassword !== confirmPassword) throw new Error('As senhas não conferem')

            const { error: passError } = await supabase.auth.updateUser({ password: newPassword })
            if (passError) throw passError
            
            setNewPassword('')
            setConfirmPassword('')
        }

        setMsg('Perfil atualizado com sucesso!')
    } catch (err: any) {
        setError(err.message)
    } finally {
        setSaving(false)
    }
  }

  if (loading) return <div style={{ padding: 24 }}>Carregando...</div>

  return (
    <>
      <div style={{ padding: 24 }}>
        <h1 style={{ fontSize: '1.8rem', color: '#0f172a', marginBottom: 20 }}>Minha Conta</h1>

        <form onSubmit={handleSave} style={{ display: 'grid', gap: 24 }}>
            
            {/* Cartão de Perfil */}
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                <div style={{ padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, borderBottom: '1px solid #f1f5f9' }}>
                    <div style={{ position: 'relative', width: 100, height: 100 }}>
                        <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', background: '#f1f5f9', border: '4px solid #fff', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                            {photoUrl ? <img src={photoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem' }}>👤</div>}
                        </div>
                        <label style={{ 
                            position: 'absolute', bottom: 0, right: 0, 
                            background: '#0f172a', color: '#fff', 
                            width: 32, height: 32, borderRadius: '50%', 
                            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                        }}>
                            {uploadingPhoto ? '...' : <Camera size={16} />}
                            <input type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: 'none' }} disabled={uploadingPhoto} />
                        </label>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#0f172a' }}>{name || 'Aluno'}</h2>
                        <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '0.9rem' }}>{email}</p>
                    </div>
                </div>

                <div style={{ padding: 24, display: 'grid', gap: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#0f172a', fontWeight: 600, marginBottom: 8 }}>
                        <User size={20} /> Informações Básicas
                    </div>
                    <label style={{ display: 'grid', gap: 6 }}>
                        <span style={{ fontSize: '0.9rem', color: '#475569' }}>Nome Completo</span>
                        <input 
                            value={name} 
                            onChange={e => setName(e.target.value)} 
                            style={{ padding: 12, borderRadius: 8, border: '1px solid #cbd5e1' }}
                        />
                    </label>
                    <label style={{ display: 'grid', gap: 6 }}>
                        <span style={{ fontSize: '0.9rem', color: '#475569' }}>Telefone</span>
                        <input 
                            value={phone} 
                            onChange={e => setPhone(e.target.value)} 
                            placeholder="(00) 00000-0000"
                            style={{ padding: 12, borderRadius: 8, border: '1px solid #cbd5e1' }}
                        />
                    </label>
                </div>
            </div>

            {/* Cartão de Segurança */}
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#0f172a', fontWeight: 600, marginBottom: 16 }}>
                    <Lock size={20} /> Alterar Senha
                </div>
                <div style={{ display: 'grid', gap: 16 }}>
                    <label style={{ display: 'grid', gap: 6 }}>
                        <span style={{ fontSize: '0.9rem', color: '#475569' }}>Nova Senha</span>
                        <input 
                            type="password"
                            value={newPassword} 
                            onChange={e => setNewPassword(e.target.value)} 
                            placeholder="Deixe em branco para manter"
                            autoComplete="new-password"
                            style={{ padding: 12, borderRadius: 8, border: '1px solid #cbd5e1' }}
                        />
                    </label>
                    <label style={{ display: 'grid', gap: 6 }}>
                        <span style={{ fontSize: '0.9rem', color: '#475569' }}>Confirmar Senha</span>
                        <input 
                            type="password"
                            value={confirmPassword} 
                            onChange={e => setConfirmPassword(e.target.value)} 
                            placeholder="Repita a nova senha"
                            autoComplete="new-password"
                            style={{ padding: 12, borderRadius: 8, border: '1px solid #cbd5e1' }}
                        />
                    </label>
                </div>
            </div>

            {error && <div style={{ background: '#fef2f2', color: '#ef4444', padding: 16, borderRadius: 12, textAlign: 'center' }}>{error}</div>}
            {msg && <div style={{ background: '#dcfce7', color: '#166534', padding: 16, borderRadius: 12, textAlign: 'center' }}>{msg}</div>}

            <button 
                type="submit"
                disabled={saving}
                style={{ 
                    background: '#0f172a', color: '#fff', padding: 16, borderRadius: 12, border: 'none', 
                    fontSize: '1rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    opacity: saving ? 0.7 : 1
                }}
            >
                <Save size={20} />
                {saving ? 'Salvando...' : 'Salvar Alterações'}
            </button>

        </form>
      </div>
    </>
  )
}
