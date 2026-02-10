import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { Dumbbell, Lock, Mail, ChevronRight, Loader2 } from 'lucide-react'

export default function StudentLogin() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) throw error

      if (data.user) {
        // Verifica se é aluno
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .single()

        if (profile?.role === 'personal') {
           // Se for personal tentando logar na área do aluno
           alert('Este login é exclusivo para alunos. Redirecionando para área do personal...')
           navigate('/dashboard/overview')
           return
        }

        navigate('/app/home')
      }
    } catch (err: any) {
      setError(err.message === 'Invalid login credentials' ? 'Email ou senha incorretos' : 'Erro ao entrar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      background: '#0f172a', // Fundo escuro moderno
      color: '#fff',
      padding: 20
    }}>
      <div style={{ marginBottom: 40, textAlign: 'center' }}>
        <div style={{ 
          width: 64, height: 64, 
          background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', 
          borderRadius: 16, 
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px auto',
          boxShadow: '0 10px 25px -5px rgba(59, 130, 246, 0.5)' 
        }}>
          <Dumbbell size={32} color="#fff" />
        </div>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 700, margin: 0 }}>Área do Aluno</h1>
        <p style={{ color: '#94a3b8', marginTop: 8 }}>Acesse seus treinos e evolução</p>
      </div>

      <form onSubmit={handleLogin} style={{ width: '100%', maxWidth: 320 }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ 
            display: 'flex', alignItems: 'center', 
            background: 'rgba(255,255,255,0.05)', 
            border: '1px solid rgba(255,255,255,0.1)', 
            borderRadius: 12,
            padding: '0 16px',
            transition: 'all 0.2s'
          }}>
            <Mail size={20} color="#64748b" />
            <input 
              type="email" 
              placeholder="Seu email" 
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={{ 
                width: '100%', padding: '16px', 
                background: 'transparent', border: 'none', 
                color: '#fff', outline: 'none', fontSize: '1rem' 
              }} 
            />
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <div style={{ 
            display: 'flex', alignItems: 'center', 
            background: 'rgba(255,255,255,0.05)', 
            border: '1px solid rgba(255,255,255,0.1)', 
            borderRadius: 12,
            padding: '0 16px'
          }}>
            <Lock size={20} color="#64748b" />
            <input 
              type="password" 
              placeholder="Sua senha" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={{ 
                width: '100%', padding: '16px', 
                background: 'transparent', border: 'none', 
                color: '#fff', outline: 'none', fontSize: '1rem' 
              }} 
            />
          </div>
        </div>

        {error && (
          <div style={{ 
            background: 'rgba(239, 68, 68, 0.1)', 
            color: '#ef4444', 
            padding: '12px', 
            borderRadius: 8, 
            marginBottom: 20, 
            fontSize: '0.9rem', 
            textAlign: 'center',
            border: '1px solid rgba(239, 68, 68, 0.2)'
          }}>
            {error}
          </div>
        )}

        <button 
          type="submit" 
          disabled={loading}
          style={{ 
            width: '100%', 
            padding: '16px', 
            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', 
            border: 'none', 
            borderRadius: 12, 
            color: '#fff', 
            fontSize: '1rem', 
            fontWeight: 600, 
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            opacity: loading ? 0.7 : 1,
            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)'
          }}
        >
          {loading ? <Loader2 className="animate-spin" /> : <>Entrar <ChevronRight size={20} /></>}
        </button>
      </form>
      
      <div style={{ marginTop: 40, fontSize: '0.85rem', color: '#475569' }}>
        FitBody Pro App v1.0
      </div>
    </div>
  )
}
