import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export default function ResetPassword() {
    const navigate = useNavigate()
    const [pass, setPass] = useState('')
    const [loading, setLoading] = useState(false)
    const [msg, setMsg] = useState('')
    const [error, setError] = useState('')

    const handleReset = async (e: FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError('')
        setMsg('')

        if (pass.length < 6) {
            setError('A senha deve ter no mínimo 6 caracteres')
            setLoading(false)
            return
        }

        try {
            const { error } = await supabase.auth.updateUser({ password: pass })
            if (error) throw error
            
            setMsg('Senha atualizada com sucesso! Redirecionando...')
            setTimeout(() => navigate('/dashboard/overview'), 2000)
        } catch (err: any) {
            setError(err.message || 'Erro ao atualizar senha')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div style={{ 
            display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', 
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            fontFamily: 'Inter, sans-serif'
        }}>
            <div style={{ 
                background: '#fff', padding: 32, borderRadius: 16, width: 380, 
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' 
            }}>
                <h2 style={{ textAlign: 'center', color: '#0f172a', marginTop: 0 }}>Definir Nova Senha</h2>
                <p style={{ textAlign: 'center', color: '#64748b', fontSize: '0.9em' }}>Digite sua nova senha abaixo.</p>

                {msg && <div style={{ background: '#dcfce7', color: '#166534', padding: 12, borderRadius: 8, marginBottom: 16, textAlign: 'center' }}>{msg}</div>}
                {error && <div style={{ background: '#fef2f2', color: '#ef4444', padding: 12, borderRadius: 8, marginBottom: 16, textAlign: 'center' }}>{error}</div>}

                <form onSubmit={handleReset} style={{ display: 'grid', gap: 16 }}>
                    <input 
                        type="password" 
                        placeholder="Nova senha" 
                        value={pass}
                        onChange={e => setPass(e.target.value)}
                        style={{ padding: 12, borderRadius: 8, border: '1px solid #cbd5e1', width: '100%', boxSizing: 'border-box' }}
                    />
                    <button 
                        type="submit" 
                        disabled={loading}
                        style={{ 
                            background: '#0ea5e9', color: '#fff', padding: 12, borderRadius: 8, border: 'none', 
                            cursor: 'pointer', fontWeight: 600, fontSize: '1rem',
                            opacity: loading ? 0.7 : 1
                        }}
                    >
                        {loading ? 'Salvando...' : 'Atualizar Senha'}
                    </button>
                </form>
            </div>
        </div>
    )
}
