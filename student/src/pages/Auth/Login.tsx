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
        height: '100vh', 
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', // Fundo azul marinho degradê
        fontFamily: 'Inter, sans-serif',
        paddingBottom: '25vh' // Sobe MUITO o centro visual da tela
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
        {/* Logo Centralizada */}
        <div style={{ textAlign: 'center', marginBottom: 0, zIndex: 1 }}> {/* zIndex menor */}
            <img 
               src="https://cdtouwfxwuhnlzqhcagy.supabase.co/storage/v1/object/public/system-assets/logo%20twinex.png" 
               alt="BodyBrothers" 
               style={{ 
                   maxWidth: 400, // Logo Gigante
                   height: 'auto', 
                   filter: 'drop-shadow(0 0 25px rgba(56, 189, 248, 0.5))', // Glow mais forte
               }} 
               onError={(e) => {
                   e.currentTarget.style.display = 'none'
                   e.currentTarget.nextElementSibling?.removeAttribute('hidden')
               }} 
            />
            <h1 hidden style={{ color: '#fff', margin: 0, fontSize: '2.5rem', fontWeight: 800, letterSpacing: '-1px' }}>
                <span style={{ color: '#38bdf8' }}>Body</span>Brothers
            </h1>
        </div>

        <div className="login-card" style={{ 
            width: 380, 
            padding: 32, 
            borderRadius: 16, 
            background: '#fff', 
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', 
            marginTop: -110, // Puxa ainda mais para cima
            zIndex: 10, // Garante que fique sobre a logo se encostar
            position: 'relative'
        }}>
            <h2 style={{ marginTop: 0, marginBottom: 8, fontSize: '1.5rem', color: '#0f172a', textAlign: 'center' }}>
                {isRecovering ? 'Recuperar Senha' : 'Portal do Aluno'}
            </h2>
            {!isRecovering && (
                <p style={{ textAlign: 'center', color: '#64748b', margin: '0 0 24px 0', fontSize: '0.9rem' }}>
                    Faça login para acessar seus treinos
                </p>
            )}
            
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
        <div style={{ color: '#64748b', fontSize: '0.875rem', marginTop: 30 }}>
            &copy; {new Date().getFullYear()} Twinex Tecnologia. Todos os direitos reservados.
        </div>
      </div>
    </div>
  )
}
