import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function Overview() {
  const [metrics, setMetrics] = useState({
    personals: 0,
    students: 0,
    activeStudents: 0,
    workouts: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadMetrics() {
      try {
        // 1. Contar Personais
        const { count: personalsCount, error: errPersonals } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('role', 'personal')

        // 2. Contar Alunos (Total)
        const { count: studentsCount, error: errStudents } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('role', 'aluno')

        // 3. Contar Alunos Ativos
        const { count: activeCount, error: errActive } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('role', 'aluno')
            .contains('data', { status: 'ativo' })

        // 4. Contar Treinos (Opcional, mas legal)
        const { count: workoutsCount, error: errWorkouts } = await supabase
            .from('workouts')
            .select('*', { count: 'exact', head: true })

        if (errPersonals) console.error('Erro personals:', errPersonals)
        if (errStudents) console.error('Erro students:', errStudents)

        setMetrics({
            personals: personalsCount || 0,
            students: studentsCount || 0,
            activeStudents: activeCount || 0,
            workouts: workoutsCount || 0
        })
      } catch (error) {
        console.error('Erro ao carregar métricas:', error)
      } finally {
        setLoading(false)
      }
    }

    loadMetrics()
  }, [])

  const cards = [
    { 
        label: 'Personais Cadastrados', 
        value: metrics.personals, 
        icon: '👨‍🏫', 
        color: '#3b82f6',
        desc: 'Profissionais ativos na plataforma'
    },
    { 
        label: 'Total de Alunos', 
        value: metrics.students, 
        icon: '👥', 
        color: '#10b981',
        desc: 'Alunos registrados por todos os personais'
    },
    { 
        label: 'Alunos Ativos', 
        value: metrics.activeStudents, 
        icon: '💪', 
        color: '#f59e0b',
        desc: 'Alunos treinando atualmente'
    },
    { 
        label: 'Média Alunos/Personal', 
        value: metrics.personals ? (metrics.students / metrics.personals).toFixed(1) : '0', 
        icon: '📊', 
        color: '#8b5cf6',
        desc: 'Média de alunos por profissional'
    }
  ]

  if (loading) return <div style={{ padding: 40 }}>Carregando métricas...</div>

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <h1 style={{ fontSize: '1.8rem', color: '#0f172a', marginBottom: 8 }}>Visão Geral do Sistema</h1>
        <p style={{ color: '#64748b', marginBottom: 32 }}>Acompanhe os principais indicadores da plataforma BodyBrothers.</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24 }}>
            {cards.map((card, idx) => (
                <div key={idx} style={{ 
                    background: '#fff', 
                    padding: 24, 
                    borderRadius: 16, 
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                    border: '1px solid #f1f5f9',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ 
                            background: `${card.color}20`, 
                            color: card.color, 
                            width: 48, height: 48, 
                            borderRadius: 12, 
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '1.5rem'
                        }}>
                            {card.icon}
                        </div>
                        {idx === 2 && (
                            <span style={{ 
                                background: '#dcfce7', color: '#166534', 
                                fontSize: '0.75rem', fontWeight: 600, 
                                padding: '4px 8px', borderRadius: 20 
                            }}>
                                +{(metrics.activeStudents / (metrics.students || 1) * 100).toFixed(0)}% do total
                            </span>
                        )}
                    </div>
                    
                    <div>
                        <div style={{ fontSize: '2.5rem', fontWeight: 700, color: '#0f172a', lineHeight: 1 }}>
                            {card.value}
                        </div>
                        <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#475569', marginTop: 4 }}>
                            {card.label}
                        </div>
                        <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: 4 }}>
                            {card.desc}
                        </div>
                    </div>
                </div>
            ))}
        </div>

        {/* Seção Extra: Acesso Rápido */}
        <div style={{ marginTop: 40 }}>
            <h2 style={{ fontSize: '1.25rem', color: '#0f172a', marginBottom: 16 }}>Ações Rápidas</h2>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <a href="/personals/create" style={{ 
                    background: '#fff', border: '1px solid #e2e8f0', padding: '16px 24px', 
                    borderRadius: 12, textDecoration: 'none', color: '#0f172a', fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s'
                }}>
                    ➕ Cadastrar Novo Personal
                </a>
                <a href="/personals/list" style={{ 
                    background: '#fff', border: '1px solid #e2e8f0', padding: '16px 24px', 
                    borderRadius: 12, textDecoration: 'none', color: '#0f172a', fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s'
                }}>
                    📋 Listar Todos os Personais
                </a>
                <a href="/personals/permissions" style={{ 
                    background: '#fff', border: '1px solid #e2e8f0', padding: '16px 24px', 
                    borderRadius: 12, textDecoration: 'none', color: '#0f172a', fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s'
                }}>
                    🔒 Gerenciar Permissões
                </a>
            </div>
        </div>
    </div>
  )
}
