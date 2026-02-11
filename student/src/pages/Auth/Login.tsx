import type { FormEvent } from 'react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { supabase } from '../../lib/supabase'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  
  // States
  const [isRecovering, setIsRecovering] = useState(false)
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccessMsg('')
    setLoading(true)

    try {
        if (isRecovering) {
            // Lógica de Recuperação de Senha
            const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
                redirectTo: window.location.origin + '/reset-password'
            })
            
            if (error) {
                setError('Erro ao enviar email: ' + error.message)
            } else {
                setSuccessMsg('Email de recuperação enviado! Verifique sua caixa de entrada.')
            }
        } else {
            // Lógica de Login
                const ok = await login(email.trim(), pass)
                if (ok) navigate('/dashboard/overview', { replace: true })
                else setError('Credenciais inválidas')
            }
    } catch (err: any) {
        setError(err.message || 'Erro inesperado')
    } finally {
        setLoading(false)
    }
  }

  return (
    <div className="login-container" style={{ 
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        fontFamily: 'Inter, sans-serif',
        padding: '40px 20px',
        boxSizing: 'border-box'
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, width: '100%' }}>
        {/* Logo Centralizada */}
        <div style={{ textAlign: 'center', marginBottom: 0, zIndex: 1 }}>
            <img 
               src="https://cdtouwfxwuhnlzqhcagy.supabase.co/storage/v1/object/public/Imagens/ChatGPT%20Image%209%20de%20fev.%20de%202026%2C%2022_23_47.png" 
               alt="Logo" 
               style={{ 
                   maxWidth: 480, // Aumentado para ficar maior
                   width: '90%', 
                   height: 'auto', 
                   filter: 'drop-shadow(0 0 25px rgba(56, 189, 248, 0.5))',
               }} 
               onError={(e) => {
                   e.currentTarget.style.display = 'none'
                   e.currentTarget.nextElementSibling?.removeAttribute('hidden')
               }} 
            />
        </div>

        <div className="login-card" style={{ 
            width: '100%',
            maxWidth: 380, 
            padding: 32, 
            borderRadius: 16, 
            background: '#fff', 
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', 
            marginTop: -130, // Mais grudado no queixo do gorila
            zIndex: 10, 
            position: 'relative',
            boxSizing: 'border-box'
        }}>
            <h2 style={{ marginTop: 0, marginBottom: 24, fontSize: '1.5rem', color: '#0f172a', textAlign: 'center' }}>
                {isRecovering ? 'Recuperar Senha' : 'Portal do Aluno'}
            </h2>
            
            {successMsg ? (
                <div style={{ textAlign: 'center' }}>
                    <div style={{ color: '#16a34a', background: '#dcfce7', padding: 12, borderRadius: 8, marginBottom: 16 }}>
                        {successMsg}
                    </div>
                    <button 
                        type="button"
                        className="btn"
                        onClick={() => { setIsRecovering(false); setSuccessMsg('') }}
                        style={{ background: 'transparent', color: '#0ea5e9', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                    >
                        Voltar para Login
                    </button>
                </div>
            ) : (
                <form onSubmit={onSubmit} className="login-form" style={{ display: 'grid', gap: 16 }}>
                <label style={{ display: 'grid', gap: 8 }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#475569' }}>Email</span>
                    <input 
                        value={email} 
                        onChange={(e) => setEmail(e.target.value)} 
                        placeholder="seuemail@exemplo.com" 
                        style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '1rem', width: '100%', boxSizing: 'border-box' }}
                    />
                </label>

                {!isRecovering && (
                    <label style={{ display: 'grid', gap: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#475569' }}>Senha</span>
                            <button 
                                type="button"
                                onClick={() => { setIsRecovering(true); setError('') }}
                                style={{ background: 'none', border: 'none', color: '#0ea5e9', fontSize: '0.875rem', cursor: 'pointer', fontWeight: 500 }}
                            >
                                Esqueci minha senha
                            </button>
                        </div>
                        <input 
                            type="password" 
                            value={pass} 
                            onChange={(e) => setPass(e.target.value)} 
                            placeholder="Sua senha" 
                            style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '1rem', width: '100%', boxSizing: 'border-box' }}
                        />
                    </label>
                )}

                {error && <div className="login-error" style={{ color: '#ef4444', fontSize: '0.875rem', background: '#fef2f2', padding: 8, borderRadius: 6, textAlign: 'center' }}>{error}</div>}
                
                <button 
                    type="submit" 
                    className="btn" 
                    disabled={loading}
                    style={{ 
                        marginTop: 8, 
                        background: '#0ea5e9', // Azul mais vivo para o botão
                        color: '#fff',
                        padding: '12px',
                        borderRadius: 8,
                        fontWeight: 600,
                        cursor: 'pointer',
                        border: 'none',
                        fontSize: '1rem',
                        transition: 'background 0.2s',
                        opacity: loading ? 0.7 : 1
                    }}
                    onMouseOver={(e) => !loading && (e.currentTarget.style.background = '#0284c7')}
                    onMouseOut={(e) => !loading && (e.currentTarget.style.background = '#0ea5e9')}
                >
                    {loading ? 'Processando...' : (isRecovering ? 'Enviar Link de Recuperação' : 'Acessar Treinos')}
                </button>

                {isRecovering && (
                    <button 
                        type="button"
                        onClick={() => { setIsRecovering(false); setError('') }}
                        style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '0.875rem' }}
                    >
                        Cancelar e voltar
                    </button>
                )}
                </form>
            )}
        </div>
        <div style={{ color: '#64748b', fontSize: '0.875rem', marginTop: 10 }}>
            &copy; {new Date().getFullYear()} Twinex Tecnologia. Todos os direitos reservados.
        </div>
      </div>
    </div>
  )
}
