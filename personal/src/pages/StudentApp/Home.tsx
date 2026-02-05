import { useAuth } from '../../auth/useAuth'
import { useNavigate } from 'react-router-dom'
import { LogOut, Dumbbell, Calendar, User } from 'lucide-react'

export default function StudentHome() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await signOut()
    navigate('/app/login')
  }

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh', paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ background: '#fff', padding: '20px 20px 10px 20px', borderBottom: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
                <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>Olá,</p>
                <h2 style={{ margin: 0, color: '#0f172a', fontSize: '1.4rem' }}>Aluno(a)</h2>
            </div>
            <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: '#ef4444' }}>
                <LogOut size={20} />
            </button>
        </div>
      </div>

      <div style={{ padding: 20 }}>
        <div style={{ 
            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', 
            borderRadius: 16, 
            padding: 20, 
            color: '#fff',
            boxShadow: '0 10px 20px -5px rgba(37, 99, 235, 0.3)',
            marginBottom: 24
        }}>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '1.2rem' }}>Treino de Hoje</h3>
            <p style={{ margin: 0, opacity: 0.9 }}>Peito e Tríceps (A)</p>
            <button style={{ 
                marginTop: 16, 
                background: '#fff', 
                color: '#2563eb', 
                border: 'none', 
                padding: '8px 16px', 
                borderRadius: 20, 
                fontWeight: 600,
                fontSize: '0.9rem'
            }}>
                Começar Agora
            </button>
        </div>

        <h3 style={{ color: '#334155', marginBottom: 12 }}>Acesso Rápido</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ background: '#fff', padding: 16, borderRadius: 12, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <div style={{ padding: 10, background: '#eff6ff', borderRadius: '50%', color: '#3b82f6' }}><Dumbbell size={24} /></div>
                <span style={{ fontWeight: 500, color: '#475569' }}>Treinos</span>
            </div>
            <div style={{ background: '#fff', padding: 16, borderRadius: 12, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <div style={{ padding: 10, background: '#f0fdf4', borderRadius: '50%', color: '#16a34a' }}><Calendar size={24} /></div>
                <span style={{ fontWeight: 500, color: '#475569' }}>Agenda</span>
            </div>
        </div>
      </div>

      {/* Bottom Nav Placeholder */}
      <div style={{ 
        position: 'fixed', bottom: 0, left: 0, right: 0, 
        background: '#fff', borderTop: '1px solid #e2e8f0', 
        display: 'flex', justifyContent: 'space-around', padding: 12,
        zIndex: 100
      }}>
        <div style={{ color: '#3b82f6', display: 'flex', flexDirection: 'column', alignItems: 'center', fontSize: '0.75rem', gap: 4 }}>
            <Dumbbell size={24} />
            <b>Treino</b>
        </div>
        <div style={{ color: '#94a3b8', display: 'flex', flexDirection: 'column', alignItems: 'center', fontSize: '0.75rem', gap: 4 }}>
            <User size={24} />
            Perfil
        </div>
      </div>
    </div>
  )
}
