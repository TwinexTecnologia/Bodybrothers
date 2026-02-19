import { useEffect, useState } from 'react'
import { useAuth } from '../../auth/useAuth'
import { supabase } from '../../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { Dumbbell, Utensils, AlertCircle, CheckCircle, Clock, X, DollarSign, FileText } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export default function Overview() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    workouts: 0,
    diets: 0,
    anamnesisPending: false,
    anamnesisName: '',
    financialPending: null as any,
    name: ''
  })
  
  // Bloqueio de inativos
  const [isBlocked, setIsBlocked] = useState(false)
  
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
      if (stats.anamnesisPending || stats.financialPending) {
          setShowModal(true)
      }
  }, [stats])

  useEffect(() => {
    if (user) loadStats()
  }, [user])

  async function loadStats() {
    try {
        // 1. Perfil (Nome) e Dados JSON
        const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, data')
            .eq('id', user?.id)
            .single()
        
        const status = profile?.data?.status || 'ativo'
        if (status !== 'ativo' && status !== 'active') {
            setIsBlocked(true)
        }

        // 2. Contagem REAL de Treinos e Dietas (Sincronizado com a listagem)
        const workoutIds = profile?.data?.workoutIds || []
        const dietIds = profile?.data?.dietIds || []

        // Contar Treinos
        let workoutQuery = supabase
            .from('protocols')
            .select('id', { count: 'exact', head: true }) // head: true retorna só a contagem
            .eq('type', 'workout')
            .eq('status', 'active')

        if (workoutIds.length > 0) {
            workoutQuery = workoutQuery.or(`student_id.eq.${user?.id},id.in.(${workoutIds.join(',')})`)
        } else {
            workoutQuery = workoutQuery.eq('student_id', user?.id)
        }
        
        const { count: workoutCount } = await workoutQuery

        // Contar Dietas
        let dietQuery = supabase
            .from('protocols')
            .select('id', { count: 'exact', head: true })
            .eq('type', 'diet')
            .eq('status', 'active')

        if (dietIds.length > 0) {
            dietQuery = dietQuery.or(`student_id.eq.${user?.id},id.in.(${dietIds.join(',')})`)
        } else {
            dietQuery = dietQuery.eq('student_id', user?.id)
        }

        const { count: dietCount } = await dietQuery

        // Verifica anamnese
        const { data: modelsData } = await supabase
            .from('protocols')
            .select('*')
            .eq('type', 'anamnesis_model')
            .eq('student_id', user?.id)

        let pendingAnamnesisName = ''
        
        // Verifica se tem algum modelo vencido ou nunca respondido
        if (modelsData && modelsData.length > 0) {
            // Busca respostas do aluno
            const { data: responses } = await supabase
                .from('protocols')
                .select('data, created_at, renew_in_days')
                .eq('type', 'anamnesis')
                .eq('student_id', user.id)
                .order('created_at', { ascending: false })

            for (const m of modelsData) {
                // Verifica respostas primeiro
                const modelResponses = responses?.filter(r => r.data?.modelId === m.id)
                const lastResponse = modelResponses?.[0]
                
                let isPending = false

                if (lastResponse) {
                    // Se respondeu, verifica recorrência
                    if (lastResponse.renew_in_days) {
                        const created = new Date(lastResponse.created_at)
                        const nextDue = new Date(created.getTime() + (lastResponse.renew_in_days * 24 * 60 * 60 * 1000))
                        // Se venceu o próximo ciclo
                        if (nextDue.getTime() < new Date().getTime()) {
                            isPending = true
                        }
                    }
                } else {
                    // Se nunca respondeu, verifica data do modelo
                    if (m.ends_at) {
                        const end = new Date(m.ends_at).getTime()
                        const now = new Date().getTime()
                        if (now > end) {
                            isPending = true
                        }
                    }
                }

                if (isPending) {
                    pendingAnamnesisName = m.title
                    break 
                }
            }
        }

        // Verifica Financeiro (Pendências)
        const { data: pendences } = await supabase
            .from('financial_charges')
            .select('*')
            .eq('student_id', user?.id)
            .eq('status', 'pending')
            .lt('due_date', new Date().toISOString())
            .order('due_date', { ascending: true })
            .limit(1)
        
        const pendingFinancial = pendences?.[0] || null

        setStats({
            name: profile?.full_name || user?.email?.split('@')[0] || 'Aluno',
            workouts: workoutCount || 0,
            diets: dietCount || 0,
            anamnesisPending: !!pendingAnamnesisName,
            anamnesisName: pendingAnamnesisName,
            financialPending: pendingFinancial
        })
    } catch (error) {
        console.error('Erro ao carregar stats', error)
    } finally {
        setLoading(false)
    }
  }

  const Card = ({ title, value, icon: Icon, color, onClick, subtitle }: any) => (
    <div 
        onClick={onClick}
        style={{ 
            background: '#fff', padding: 24, borderRadius: 16, 
            border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
            cursor: onClick ? 'pointer' : 'default',
            transition: 'transform 0.2s',
            display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
        }}
        onMouseEnter={e => onClick && (e.currentTarget.style.transform = 'translateY(-4px)')}
        onMouseLeave={e => onClick && (e.currentTarget.style.transform = 'translateY(0)')}
    >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div style={{ background: `${color}20`, padding: 12, borderRadius: 12, color: color }}>
                <Icon size={24} />
            </div>
            {value > 0 && <span style={{ background: '#f1f5f9', padding: '4px 12px', borderRadius: 20, fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Ativos</span>}
        </div>
        <div>
            <h3 style={{ margin: 0, fontSize: '1rem', color: '#64748b', fontWeight: 500 }}>{title}</h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '1.8rem', fontWeight: 700, color: '#0f172a' }}>
                {value}
            </p>
            {subtitle && <p style={{ margin: '8px 0 0 0', fontSize: '0.85rem', color: color }}>{subtitle}</p>}
        </div>
    </div>
  )

  const handleNavigate = (path: string) => {
      if (isBlocked) {
          alert('Acesso restrito. Sua conta está inativa. Contate seu personal.')
          return
      }
      navigate(path)
  }

  const handleExportPDF = async () => {
      try {
          // Busca perfil para workoutIds
          const { data: profile } = await supabase.from('profiles').select('data').eq('id', user?.id).single()
          const workoutIds = profile?.data?.workoutIds || []

          // Busca Treinos Completos
          let query = supabase.from('protocols').select('*').eq('type', 'workout').eq('status', 'active')
          
          if (workoutIds.length > 0) {
              query = query.or(`student_id.eq.${user?.id},id.in.(${workoutIds.join(',')})`)
          } else {
              query = query.eq('student_id', user?.id)
          }

          const { data: workouts, error } = await query

          if (error || !workouts || workouts.length === 0) {
              alert('Nenhum treino encontrado para exportar.')
              return
          }

          const doc = new jsPDF()
          
          // Header
          doc.setFontSize(18)
          doc.setTextColor(15, 23, 42)
          doc.text(`Ficha de Treino - ${stats.name.toUpperCase()}`, 14, 20)
          
          doc.setFontSize(10)
          doc.setTextColor(100, 116, 139)
          doc.text(`Gerado via FitBody Pro em ${new Date().toLocaleDateString()}`, 14, 26)

          let yPos = 35

          workouts.forEach((workout, index) => {
              // Título
              doc.setFontSize(14)
              doc.setTextColor(15, 23, 42)
              doc.text(workout.title, 14, yPos)
              yPos += 8

              // Obs
              if (workout.data?.notes) {
                  doc.setFontSize(10)
                  doc.setTextColor(100, 116, 139)
                  const splitNotes = doc.splitTextToSize(`Obs: ${workout.data.notes}`, 180)
                  doc.text(splitNotes, 14, yPos)
                  yPos += (splitNotes.length * 5) + 4
              }

              // Tabela
              const tableBody = (workout.data?.exercises || []).map((ex: any) => {
                  let setsText = ''
                  if (ex.sets && ex.sets.length > 0) {
                       const mainSet = ex.sets.find((s: any) => s.type === 'working') || ex.sets[0]
                       setsText = `${mainSet.series} x ${mainSet.reps}`
                       if (ex.sets.length > 1) setsText += '*'
                  } else {
                       setsText = `${ex.series || '-'} x ${ex.reps || '-'}`
                  }

                  let loadText = ex.load || ''
                  if (ex.sets && ex.sets.length > 0) loadText = ex.sets[0].load || ''

                  return [
                      ex.name,
                      setsText,
                      loadText,
                      ex.rest || '',
                      ex.notes || ''
                  ]
              })

              autoTable(doc, {
                  startY: yPos,
                  head: [['Exercício', 'Séries/Reps', 'Carga', 'Descanso', 'Obs']],
                  body: tableBody,
                  theme: 'grid',
                  headStyles: { fillColor: [15, 23, 42], textColor: 255 },
                  styles: { fontSize: 9, cellPadding: 3, valign: 'middle' },
                  columnStyles: {
                      0: { cellWidth: 50 },
                      1: { cellWidth: 25 },
                      2: { cellWidth: 35 },
                      3: { cellWidth: 25 },
                      4: { cellWidth: 'auto' }
                  },
                  margin: { top: 20 },
                  didDrawPage: (data) => { yPos = data.cursor?.y || 20 }
              })

              yPos = (doc as any).lastAutoTable.finalY + 15
              
              if (index < workouts.length - 1 && yPos > 250) {
                  doc.addPage()
                  yPos = 20
              }
          })

          doc.save(`Treinos_${stats.name}.pdf`)

      } catch (error) {
          console.error(error)
          alert('Erro ao gerar PDF')
      }
  }

  return (
    <>
      <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
        <header style={{ marginBottom: 32 }}>
            <h1 style={{ margin: 0, fontSize: '1.8rem', color: '#0f172a' }}>Olá, {stats.name} 👋</h1>
            <p style={{ color: '#64748b', marginTop: 8, fontSize: '1.1rem' }}>Aqui está o resumo do seu progresso hoje.</p>
        </header>

        {/* Modal de Alerta */}
        {showModal && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, backdropFilter: 'blur(4px)' }}>
                <div style={{ background: '#fff', width: '90%', maxWidth: 450, borderRadius: 24, padding: 32, boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', position: 'relative' }}>
                    <button 
                        onClick={() => setShowModal(false)}
                        style={{ position: 'absolute', top: 16, right: 16, background: '#f1f5f9', border: 'none', width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}
                    >
                        <X size={18} />
                    </button>

                    <div style={{ textAlign: 'center', marginBottom: 24 }}>
                        <div style={{ background: '#fee2e2', width: 64, height: 64, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto', color: '#ef4444' }}>
                            <AlertCircle size={32} />
                        </div>
                        <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#0f172a' }}>Atenção Necessária</h2>
                        <p style={{ color: '#64748b', marginTop: 8 }}>Existem pendências importantes na sua conta.</p>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {stats.anamnesisPending && (
                            <div style={{ background: '#fff7ed', padding: 16, borderRadius: 12, border: '1px solid #fed7aa' }}>
                                <div style={{ fontWeight: 600, color: '#9a3412', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Clock size={18} /> Anamnese Vencida
                                </div>
                                <div style={{ fontSize: '0.9rem', color: '#c2410c', marginBottom: 12 }}>
                                    O formulário <strong>"{stats.anamnesisName}"</strong> precisa ser atualizado.
                                </div>
                                <button 
                                    onClick={() => handleNavigate('/anamnesis')}
                                    style={{ width: '100%', padding: '10px', background: '#ea580c', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}
                                >
                                    Atualizar Agora
                                </button>
                            </div>
                        )}

                        {stats.financialPending && (
                            <div style={{ background: '#f0fdf4', padding: 16, borderRadius: 12, border: '1px solid #bbf7d0' }}>
                                <div style={{ fontWeight: 600, color: '#166534', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <DollarSign size={18} /> Pagamento Pendente
                                </div>
                                <div style={{ fontSize: '0.9rem', color: '#15803d', marginBottom: 12 }}>
                                    Plano <strong>{stats.financialPending.title}</strong> - R$ {stats.financialPending.amount.toFixed(2)}
                                </div>
                                <button 
                                    onClick={() => handleNavigate('/financial')}
                                    style={{ width: '100%', padding: '10px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}
                                >
                                    Regularizar
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}

        {/* Alertas (na tela, caso feche o modal) */}
        {stats.anamnesisPending && (
            <div style={{ 
                marginBottom: 32, padding: 16, borderRadius: 12, 
                background: '#fff7ed', border: '1px solid #fed7aa', color: '#c2410c',
                display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer'
            }} onClick={() => handleNavigate('/anamnesis')}>
                <AlertCircle size={24} />
                <div style={{ flex: 1 }}>
                    <strong>Atenção:</strong> Sua anamnese pode estar desatualizada. Clique aqui para responder uma nova.
                </div>
                <Clock size={20} />
            </div>
        )}

        {/* Grid de Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24, marginBottom: 40 }}>
            <Card 
                title="Meus Treinos" 
                value={stats.workouts} 
                icon={Dumbbell} 
                color="#3b82f6" 
                onClick={() => handleNavigate('/workouts')}
                subtitle={stats.workouts > 0 ? 'Clique para ver seus treinos' : 'Nenhum treino ativo'}
            />
            
            <Card 
                title="Minha Dieta" 
                value={stats.diets} 
                icon={Utensils} 
                color="#10b981" 
                onClick={() => handleNavigate('/diets')}
                subtitle={stats.diets > 0 ? 'Clique para ver seu plano alimentar' : 'Nenhuma dieta ativa'}
            />

            {/* Card PDF */}
            <div 
                onClick={handleExportPDF}
                style={{ 
                    background: '#fff', padding: 24, borderRadius: 16, 
                    border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                    cursor: 'pointer',
                    transition: 'transform 0.2s',
                    display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
                }}
                onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-4px)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                    <div style={{ background: '#f3e8ff', padding: 12, borderRadius: 12, color: '#9333ea' }}>
                        <FileText size={24} />
                    </div>
                </div>
                <div>
                    <h3 style={{ margin: 0, fontSize: '1rem', color: '#64748b', fontWeight: 500 }}>Ficha de Treino</h3>
                    <p style={{ margin: '4px 0 0 0', fontSize: '1.4rem', fontWeight: 700, color: '#0f172a' }}>
                        Exportar PDF
                    </p>
                    <p style={{ margin: '8px 0 0 0', fontSize: '0.85rem', color: '#9333ea' }}>Baixar ficha completa</p>
                </div>
            </div>

            <div style={{  
                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', 
                padding: 24, borderRadius: 16, color: '#fff',
                display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
                textAlign: 'center', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
            }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600 }}>Pronto para treinar?</h3>
                <p style={{ margin: '8px 0 24px 0', color: '#94a3b8' }}>Acesse seu treino de hoje e registre seu progresso.</p>
                <button 
                    onClick={() => handleNavigate('/workouts')}
                    style={{ 
                        background: '#3b82f6', color: '#fff', border: 'none', padding: '12px 24px', 
                        borderRadius: 8, fontWeight: 600, cursor: 'pointer', width: '100%',
                        transition: 'background 0.2s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#2563eb'}
                    onMouseLeave={e => e.currentTarget.style.background = '#3b82f6'}
                >
                    Ir para Treinos
                </button>
            </div>
        </div>

        {/* Seção Informativa (Placeholder para futuro gráfico) */}
        <div style={{ background: '#fff', padding: 32, borderRadius: 24, border: '1px solid #e2e8f0', textAlign: 'center' }}>
            <div style={{ maxWidth: 400, margin: '0 auto' }}>
                <div style={{ background: '#f1f5f9', width: 64, height: 64, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto' }}>
                    <CheckCircle size={32} color="#64748b" />
                </div>
                <h3 style={{ margin: '0 0 8px 0', color: '#0f172a' }}>Mantenha o Foco!</h3>
                <p style={{ color: '#64748b', lineHeight: 1.6 }}>
                    "O sucesso é a soma de pequenos esforços repetidos dia após dia." <br/>
                    Continue seguindo seu plano e os resultados virão.
                </p>
            </div>
        </div>

      </div>
    </>
  )
}
