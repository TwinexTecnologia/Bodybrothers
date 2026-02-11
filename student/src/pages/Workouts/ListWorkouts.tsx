import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/useAuth'
import { Dumbbell, ChevronRight, PlayCircle, Clock, X, StopCircle, CheckCircle, Calendar, MessageSquare, History, TrendingUp, ChevronLeft, Play, ArrowRight, Flame, BarChart2 } from 'lucide-react'
import { startSession, finishSession, getWeeklyFrequency, getWeeklyActivity } from '../../store/history'
import { ErrorBoundary } from '../../components/ErrorBoundary'

// Atualizado para suportar múltiplos sets
type ExerciseSet = {
    type: 'warmup' | 'feeder' | 'working' | 'custom'
    customLabel?: string
    series: string
    reps: string
    load: string
    rest: string
}

type Exercise = {
  name: string
  group: string
  
  // Nova estrutura de sets
  sets?: ExerciseSet[] // Se existir, usa isso. Se não, usa fallback.

  // Mantidos para compatibilidade com dados antigos
  series: string
  reps: string
  load: string
  rest: string
  warmupSeries?: string
  warmupReps?: string
  warmupLoad?: string
  warmupRest?: string
  feederSeries?: string
  feederReps?: string
  feederLoad?: string
  feederRest?: string

  notes?: string
  videoUrl?: string
}

type Workout = {
  id: string
  personal_id?: string
  title: string
  data: {
    goal?: string
    notes?: string
    validUntil?: string
    exercises: Exercise[]
  }
  updated_at: string
}

type SessionState = {
    active: boolean
    sessionId?: string
    workout?: Workout
    startTime?: Date
    elapsedSeconds: number
}

const DAYS_MAP: Record<string, string> = {
    'seg': 'Segunda-feira',
    'ter': 'Terça-feira',
    'qua': 'Quarta-feira',
    'qui': 'Quinta-feira',
    'sex': 'Sexta-feira',
    'sab': 'Sábado',
    'dom': 'Domingo'
}

const DAYS_ORDER = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom']

export default function ListWorkoutsWrapper() {
    return (
        <ErrorBoundary>
            <ListWorkouts />
        </ErrorBoundary>
    )
}

function ListWorkouts() {
  const { user } = useAuth()
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [schedule, setSchedule] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(true)
  const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null)
  
  // Frequência
  const [weeklyFreq, setWeeklyFreq] = useState(0)
  const [activeDays, setActiveDays] = useState<number[]>([])
  
  // Status de bloqueio
  const [isBlocked, setIsBlocked] = useState(false)

  // Sessão
  const [session, setSession] = useState<SessionState>({ active: false, elapsedSeconds: 0 })
  const [showFinishModal, setShowFinishModal] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [showSummaryModal, setShowSummaryModal] = useState(false)
  const [sessionNotes, setSessionNotes] = useState('')
  // const [videoModalUrl, setVideoModalUrl] = useState<string | null>(null) // REMOVIDO: Não usa mais modal
  const [playingVideoIndex, setPlayingVideoIndex] = useState<number | null>(null) // NOVO: Controla qual vídeo está tocando inline
  const [isFinishing, setIsFinishing] = useState(false)
  const timerRef = useRef<any>(null)

  useEffect(() => {
    if (user) {
        // Limpa sessões antigas E TENTA RETOMAR SESSÃO ATIVA antes de carregar dados
        autoCloseStaleSessions().then(() => {
            resumeActiveSession().then(() => {
                loadData()
                loadFrequency()
            })
        })
    }
    return () => clearInterval(timerRef.current)
  }, [user])

  // Função para retomar sessão ativa (< 4h)
  async function resumeActiveSession() {
      if (!user) return

      try {
        // Busca sessão ativa mais recente
        const { data: activeSession, error } = await supabase
            .from('workout_history')
            .select('id, workout_id, started_at')
            .eq('student_id', user.id)
            .is('finished_at', null)
            .order('started_at', { ascending: false })
            .limit(1)
            .single()

        if (error || !activeSession) return

        const start = new Date(activeSession.started_at)
        const now = new Date()
        const diffMs = now.getTime() - start.getTime()
        const fourHoursMs = 4 * 60 * 60 * 1000 // 4 horas

        if (diffMs < fourHoursMs) {
            console.log('Retomando sessão...', activeSession.id)
            
            // Busca os dados do treino
            const { data: workoutData, error: workoutError } = await supabase
                .from('protocols')
                .select('*')
                .eq('id', activeSession.workout_id)
                .single()
            
            if (workoutError || !workoutData) {
                // Sessão existe mas treino foi apagado ou erro ao buscar. Finaliza sessão para destravar.
                console.warn('Sessão ativa encontrada mas treino não existe. Finalizando sessão órfã...', activeSession.id)
                await supabase.from('workout_history').update({ 
                    finished_at: new Date().toISOString(), 
                    notes: 'Sessão encerrada automaticamente (treino não encontrado)' 
                }).eq('id', activeSession.id)
                return
            }

            setSession({
                active: true,
                sessionId: activeSession.id,
                workout: workoutData,
                startTime: start,
                elapsedSeconds: Math.floor(diffMs / 1000)
            })
        }
      } catch (err) {
          console.error('Erro ao retomar sessão:', err)
      }
  }

  useEffect(() => {
    if (session.active) {
        timerRef.current = setInterval(() => {
            setSession(prev => ({ ...prev, elapsedSeconds: prev.elapsedSeconds + 1 }))
        }, 1000)
    } else {
        clearInterval(timerRef.current)
    }
    return () => clearInterval(timerRef.current)
  }, [session.active])

  // Função para fechar sessões esquecidas (mais de 4h)
  async function autoCloseStaleSessions() {
      if (!user) return
      
      try {
          // Busca sessões abertas (finished_at is null) deste aluno
          const { data: staleSessions, error } = await supabase
              .from('workout_history')
              .select('id, started_at')
              .eq('student_id', user.id)
              .is('finished_at', null)
          
          if (error || !staleSessions) return

          const now = new Date()
          const fourHoursMs = 4 * 60 * 60 * 1000

          const sessionsToClose = staleSessions.filter(s => {
              const start = new Date(s.started_at)
              const diff = now.getTime() - start.getTime()
              return diff > fourHoursMs
          })

          if (sessionsToClose.length > 0) {
              console.log(`Fechando ${sessionsToClose.length} sessões antigas...`)
              
              for (const s of sessionsToClose) {
                  // Define data de fim como data de início + 4h (ou fim do dia)
                  // Mas para simplificar e garantir validade, vamos usar started_at + 1h (tempo médio)
                  // Ou usar a hora atual se fizer sentido. O pedido foi: "se nao finalizar finaliza com o dia o treino"
                  
                  const start = new Date(s.started_at)
                  // Define fim como 1h depois do início para não ficar zerado, ou 4h (limite)
                  const autoFinishTime = new Date(start.getTime() + 60 * 60 * 1000).toISOString() 
                  
                  await supabase
                      .from('workout_history')
                      .update({
                          finished_at: autoFinishTime,
                          notes: 'Encerrado por não finalizar',
                          duration_seconds: 14400 // 4 horas
                      })
                      .eq('id', s.id)
              }
          }
      } catch (err) {
          console.error('Erro ao limpar sessões antigas:', err)
      }
  }

  async function loadFrequency() {
      if (!user) return
      const count = await getWeeklyFrequency(user.id)
      const days = await getWeeklyActivity(user.id)
      setWeeklyFreq(count)
      setActiveDays(days)
  }

  async function loadData() {
    try {
        setLoading(true)
        const { data: profile } = await supabase.from('profiles').select('data').eq('id', user?.id).single()
        
        const status = profile?.data?.status || 'ativo'
        if (status !== 'ativo' && status !== 'active') {
            setIsBlocked(true)
            setLoading(false)
            return
        }

        const linkedIds = profile?.data?.workoutIds || []
        const sched = profile?.data?.workoutSchedule || {}
        setSchedule(sched)

        let query = supabase.from('protocols').select('*').eq('type', 'workout').eq('status', 'active')
        
        if (linkedIds.length > 0) {
            query = query.or(`student_id.eq.${user?.id},id.in.(${linkedIds.join(',')})`)
        } else {
            query = query.eq('student_id', user?.id)
        }

        const { data, error } = await query
        if (error) throw error
        setWorkouts(data || [])
    } catch (error) {
        console.error('Erro ao carregar treinos:', error)
    } finally {
        setLoading(false)
    }
  }

  const handleStartSession = async (w: Workout) => {
      if (!user) return
      
      const todayIndex = new Date().getDay()
      
      // Bloqueia se já tiver treino registrado hoje
      if (activeDays.includes(todayIndex)) {
          alert('Você já registrou um treino hoje! Descanse para amanhã. 💪')
          return
      }

      try {
          const s = await startSession(w.id, w.title, user.id)
          setSession({
              active: true,
              sessionId: s.id,
              workout: w,
              startTime: new Date(),
              elapsedSeconds: 0
          })
          setSelectedWorkout(null)
          window.scrollTo(0,0)
      } catch (err) {
          alert('Erro ao iniciar treino.')
      }
  }

  const handleConfirmFinish = async () => {
      if (!session.sessionId) return
      
      setIsFinishing(true)
      try {
          await finishSession(session.sessionId, session.elapsedSeconds, sessionNotes)
          
          // Ordem importante: fecha modal, reseta notas, mostra sucesso, encerra sessão
          setShowFinishModal(false)
          setSessionNotes('')
          setShowSuccessModal(true)
          setSession({ active: false, elapsedSeconds: 0 })
          
          // Recarrega dados
          loadFrequency()
          loadData()
      } catch (err) {
          console.error(err)
          alert('Erro ao salvar treino.')
      } finally {
          setIsFinishing(false)
      }
  }

  // DEBUG: Função para resetar o treino de hoje (Para Testes)
  const handleDebugReset = async () => {
      if (!user) return
      if (!confirm('Isso vai apagar o ÚLTIMO treino registrado para você testar novamente. Confirmar?')) return
      
      const { data: lastWorkout, error: fetchError } = await supabase
          .from('workout_history')
          .select('id')
          .eq('student_id', user.id)
          .order('started_at', { ascending: false })
          .limit(1)
          .single()

      if (fetchError || !lastWorkout) {
          alert('Nenhum treino encontrado para apagar.')
          return
      }

      const { error } = await supabase
          .from('workout_history')
          .delete()
          .eq('id', lastWorkout.id)
      
      if (!error) {
          alert('Último treino apagado com sucesso! Atualizando...')
          window.location.reload()
      } else {
          console.error('Erro ao resetar:', error)
          alert('Erro ao resetar. Verifique o console.')
      }
  }

  const formatTime = (seconds: number) => {
      const h = Math.floor(seconds / 3600)
      const m = Math.floor((seconds % 3600) / 60)
      const s = seconds % 60
      return h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}` : `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  // Agrupamento
  const workoutsByDay = DAYS_ORDER.map(dayKey => {
      const workoutIdsForDay: string[] = []
      if (schedule && typeof schedule === 'object') {
        Object.entries(schedule).forEach(([wId, days]) => {
            if (Array.isArray(days)) {
                const normalizedDays = days.map(d => String(d).toLowerCase()) // Garante string
                if (normalizedDays.includes(dayKey)) workoutIdsForDay.push(wId)
            }
        })
      }
      const dayWorkouts = workouts.filter(w => workoutIdsForDay.includes(w.id))
      return { dayKey, label: DAYS_MAP[dayKey], workouts: dayWorkouts }
  }).filter(group => group.workouts.length > 0)

  const unscheduledWorkouts = workouts.filter(w => {
      const days = (schedule && typeof schedule === 'object') ? schedule[w.id] : undefined
      return !days || !Array.isArray(days) || days.length === 0
  })

  // --- Renderização ---

  // Detecta mobile para ajustar layout
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
      const checkMobile = () => setIsMobile(window.innerWidth < 640)
      checkMobile()
      window.addEventListener('resize', checkMobile)
      return () => window.removeEventListener('resize', checkMobile)
  }, [])

  if (session.active && session.workout && session.workout.data) {
      // Modo Sessão (Mantido com melhorias sutis)
      return (
          <div style={{ padding: 24, minHeight: '80vh', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, system-ui, sans-serif' }}>
              <header style={{ textAlign: 'center', marginBottom: 24 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                      <div style={{ display: 'inline-block', background: '#dcfce7', color: '#166534', padding: '6px 16px', borderRadius: 30, fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>
                          Treino em Andamento
                      </div>
                      <button 
                          onClick={() => setShowFinishModal(true)}
                          style={{ 
                              padding: '10px 20px', borderRadius: 20, border: 'none', 
                              background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', color: '#fff', 
                              fontSize: '0.9rem', fontWeight: 700, letterSpacing: '0.5px',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer',
                              boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)', transition: 'transform 0.2s'
                          }}
                          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.02)'}
                          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                      >
                          <StopCircle size={18} /> FINALIZAR
                      </button>
                  </div>
                  <h1 style={{ fontSize: '2rem', color: '#0f172a', margin: '0 0 8px 0', letterSpacing: '-0.5px' }}>{session.workout.title}</h1>
                  <div className="timer-display" style={{ fontSize: '3.5rem', fontWeight: 800, color: '#3b82f6', fontFamily: 'monospace', letterSpacing: '-2px', lineHeight: 1 }}>
                      {formatTime(session.elapsedSeconds)}
                  </div>
              </header>

              <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 24 }}>
                  {/* Observações Gerais */}
                  {session.workout.data.notes && (
                      <div style={{ 
                          marginBottom: 24, padding: 20, borderRadius: 16, 
                          background: '#fff7ed', border: '1px solid #ffedd5',
                          display: 'flex', flexDirection: 'column', gap: 8 
                      }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <MessageSquare size={18} color="#f97316" />
                              <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#ea580c', letterSpacing: '0.5px' }}>OBSERVAÇÕES GERAIS</span>
                          </div>
                          <p style={{ margin: 0, fontSize: '0.95rem', color: '#c2410c', lineHeight: 1.5 }}>
                              {session.workout.data.notes}
                          </p>
                      </div>
                  )}
                  
                  {session.workout.data.exercises && Array.isArray(session.workout.data.exercises) && session.workout.data.exercises.map((ex, i) => (
                      <div key={i} style={{ marginBottom: 16, borderRadius: 20, padding: 20, background: '#fff', border: '1px solid #f1f5f9', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, alignItems: 'flex-start' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                  <span style={{ fontSize: '1rem', fontWeight: 800, color: '#94a3b8', background: '#f8fafc', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', flexShrink: 0 }}>{i + 1}</span>
                                  <strong style={{ color: '#0f172a', fontSize: '1.2rem', lineHeight: 1.2 }}>{ex.name}</strong>
                              </div>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingLeft: 0 }}>
                              
                              {(() => {
                                  // Normaliza sets: usa o do banco se existir e for array, ou constrói a partir dos campos antigos
                                  let setsToRender: ExerciseSet[] = Array.isArray(ex.sets) ? ex.sets : []
                                  
                                  if (setsToRender.length === 0) {
                                      if (ex.warmupSeries || ex.warmupReps) {
                                          setsToRender.push({ type: 'warmup', series: ex.warmupSeries || '', reps: ex.warmupReps || '', load: ex.warmupLoad || '', rest: ex.warmupRest || '' })
                                      }
                                      if (ex.feederSeries || ex.feederReps) {
                                          setsToRender.push({ type: 'feeder', series: ex.feederSeries || '', reps: ex.feederReps || '', load: ex.feederLoad || '', rest: ex.feederRest || '' })
                                      }
                                      // Sempre tem trabalho (exceto se for vazio mesmo)
                                      if (ex.series || ex.reps) {
                                          setsToRender.push({ type: 'working', series: ex.series || '', reps: ex.reps || '', load: ex.load || '', rest: ex.rest || '' })
                                      }
                                  }

                                  if (setsToRender.length > 0) {
                                      return (
                                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                              {setsToRender.map((set, setIdx) => {
                                                  let color = '#334155'
                                                  let bg = 'transparent'
                                                  let label = ''

                                                  if (set.type === 'warmup') {
                                                      color = '#ea580c'
                                                      bg = '#fff7ed'
                                                      label = 'Aquecimento'
                                                  } else if (set.type === 'feeder') {
                                                      color = '#0284c7'
                                                      bg = '#f0f9ff'
                                                      label = 'Preparação'
                                                  } else if (set.type === 'working') {
                                                      color = '#16a34a'
                                                      bg = '#f0fdf4'
                                                      label = 'Trabalho'
                                                  } else if (set.type === 'custom') {
                                                      color = '#7c3aed'
                                                      bg = '#f5f3ff'
                                                      label = set.customLabel || 'Específico'
                                                  }

                                                  return (
                                                      <div key={setIdx} style={{ display: 'flex', flexDirection: 'column', gap: 4, background: bg, padding: '8px 12px', borderRadius: 8, border: `1px solid ${color}20` }}>
                                                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem' }}>
                                                              <span style={{ fontWeight: 700, color: color, textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.5px' }}>{label}</span>
                                                              <span style={{ fontWeight: 600, color: '#334155' }}>{set.series} x {set.reps}</span>
                                                              {set.load && <span style={{ color: '#64748b' }}>({set.load})</span>}
                                                          </div>
                                                          {set.rest && (
                                                               <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: '#64748b' }}>
                                                                   <Clock size={12} />
                                                                   <span>Descanso: {set.rest}</span>
                                                               </div>
                                                          )}
                                                      </div>
                                                  )
                                              })}
                                          </div>
                                      )
                                  } else {
                                      // Fallback final se realmente não tiver nada
                                      return <div style={{ color: '#94a3b8', fontStyle: 'italic' }}>Sem séries definidas.</div>
                                  }
                              })()}
                              
                              {/* Notas (Comuns a ambos) */}
                              {ex.notes && (
                                  <div style={{ fontSize: '0.85rem', color: '#64748b', background: '#fff7ed', padding: '8px 12px', borderRadius: 8, border: '1px solid #ffedd5', display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 4 }}>
                                      <MessageSquare size={16} style={{ marginTop: 2, flexShrink: 0, color: '#f97316' }} /> 
                                      <span style={{ color: '#c2410c' }}>{ex.notes}</span>
                                  </div>
                              )}

                              {/* Video Player OTIMIZADO - Thumbnail com Play Inline */}
                              {ex.videoUrl && (
                                  <div style={{ 
                                      width: '100%', 
                                      maxWidth: '600px', 
                                      aspectRatio: '16/9', // Fixo para evitar layout shift
                                      borderRadius: 12, 
                                      overflow: 'hidden', 
                                      background: '#000', 
                                      marginTop: 16, 
                                      position: 'relative', 
                                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)', 
                                      alignSelf: 'center',
                                      cursor: playingVideoIndex === i ? 'default' : 'pointer'
                                  }}>
                                      {playingVideoIndex === i ? (
                                          /* PLAYER INLINE */
                                          (() => {
                                              const isYoutube = ex.videoUrl && (typeof ex.videoUrl === 'string') && (ex.videoUrl.includes('youtube.com') || ex.videoUrl.includes('youtu.be'));
                                              if (isYoutube) {
                                                  const videoId = ex.videoUrl?.split('v=')[1]?.split('&')[0] || ex.videoUrl?.split('/').pop();
                                                  return (
                                                      <iframe 
                                                          src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&controls=1&playsinline=1`} 
                                                          title={ex.name}
                                                          style={{ width: '100%', height: '100%', border: 'none' }}
                                                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                                                          allowFullScreen
                                                      />
                                                  );
                                              } else {
                                                  return (
                                                      <video 
                                                          src={ex.videoUrl} 
                                                          controls 
                                                          autoPlay
                                                          playsInline
                                                          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                                      />
                                                  );
                                              }
                                          })()
                                      ) : (
                                          /* THUMBNAIL */
                                          <div onClick={() => setPlayingVideoIndex(i)} style={{ width: '100%', height: '100%', position: 'relative' }}>
                                              {(() => {
                                                  const isYoutube = ex.videoUrl && (typeof ex.videoUrl === 'string') && (ex.videoUrl.includes('youtube.com') || ex.videoUrl.includes('youtu.be'));
                                                  let thumbUrl = '';
                                                  if (isYoutube) {
                                                      const videoId = ex.videoUrl?.split('v=')[1]?.split('&')[0] || ex.videoUrl?.split('/').pop();
                                                      thumbUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
                                                  }
                                                  
                                                  return (
                                                      <>
                                                          {thumbUrl ? (
                                                              <img src={thumbUrl} alt={ex.name} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8 }} />
                                                          ) : (
                                                              <video src={ex.videoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8 }} />
                                                          )}
                                                          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'rgba(0,0,0,0.6)', borderRadius: '50%', padding: 16, backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                              <Play size={32} fill="#fff" color="#fff" style={{ marginLeft: 4 }} />
                                                          </div>
                                                      </>
                                                  );
                                              })()}
                                          </div>
                                      )}
                                  </div>
                              )}
                          </div>
                      </div>
                  ))}
              </div>

              <button 
                  onClick={() => setShowFinishModal(true)}
                  style={{ 
                      marginTop: 16, padding: 20, borderRadius: 20, border: 'none', 
                      background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', color: '#fff', 
                      fontSize: '1.1rem', fontWeight: 700, letterSpacing: '0.5px',
                      display: 'none', alignItems: 'center', justifyContent: 'center', gap: 12, cursor: 'pointer',
                      boxShadow: '0 10px 20px -5px rgba(239, 68, 68, 0.4)', transition: 'transform 0.2s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.02)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
              >
                  <StopCircle size={24} /> FINALIZAR TREINO
              </button>

              {showSummaryModal && (
                  <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 3000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 24, backdropFilter: 'blur(8px)' }} onClick={() => setShowSummaryModal(false)}>
                      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', width: '100%', maxWidth: 500, maxHeight: '80vh', borderRadius: 24, padding: 0, display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
                          <div style={{ padding: '24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#0f172a' }}>Resumo do Treino</h2>
                              <button onClick={() => setShowSummaryModal(false)} style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={20}/></button>
                          </div>
                          <div style={{ padding: 24, overflowY: 'auto' }}>
                              <div style={{ display: 'grid', gap: 16 }}>
                                  {session.workout.data.exercises.map((ex, i) => (
                                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f8fafc', paddingBottom: 12 }}>
                                          <div>
                                              <div style={{ fontWeight: 600, color: '#334155', marginBottom: 4 }}>{ex.name}</div>
                                              <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{ex.series} séries x {ex.reps} reps</div>
                                          </div>
                                          <div style={{ textAlign: 'right', fontSize: '0.85rem', color: '#64748b' }}>
                                              <div style={{ fontWeight: 600, color: '#3b82f6' }}>{ex.load}</div>
                                              <div>{ex.rest}</div>
                                          </div>
                                      </div>
                                  ))}
                              </div>
                          </div>
                          <div style={{ padding: 24, borderTop: '1px solid #f1f5f9', textAlign: 'center' }}>
                              <button onClick={() => setShowSummaryModal(false)} style={{ width: '100%', padding: 16, background: '#0f172a', color: '#fff', border: 'none', borderRadius: 16, fontWeight: 700, cursor: 'pointer' }}>Voltar ao Treino</button>
                          </div>
                      </div>
                  </div>
              )}

              {showFinishModal && (
                  <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 3000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 24, backdropFilter: 'blur(8px)' }}>
                      <div style={{ background: '#fff', width: '100%', maxWidth: 400, borderRadius: 24, padding: 32, boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
                          <h2 style={{ marginTop: 0, color: '#0f172a', fontSize: '1.5rem', letterSpacing: '-0.5px' }}>Treino Finalizado?</h2>
                          <p style={{ color: '#64748b', marginBottom: 24, lineHeight: 1.5 }}>Registre como você se sentiu para seu personal acompanhar sua evolução.</p>
                          
                          <textarea 
                              value={sessionNotes} 
                              onChange={e => setSessionNotes(e.target.value)} 
                              placeholder="Ex: Aumentei carga no supino, senti o ombro..." 
                              style={{ 
                                  width: '100%', minHeight: 120, padding: 16, borderRadius: 16, 
                                  border: '1px solid #e2e8f0', marginBottom: 24, fontFamily: 'inherit', 
                                  fontSize: '1rem', resize: 'vertical', boxSizing: 'border-box',
                                  background: '#f8fafc', color: '#334155'
                              }} 
                          />
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                              <button onClick={() => setShowFinishModal(false)} disabled={isFinishing} style={{ padding: '16px', borderRadius: 16, border: 'none', background: '#f1f5f9', fontWeight: 700, cursor: isFinishing ? 'not-allowed' : 'pointer', color: '#64748b', opacity: isFinishing ? 0.5 : 1 }}>Cancelar</button>
                              <button onClick={handleConfirmFinish} disabled={isFinishing} style={{ padding: '16px', borderRadius: 16, border: 'none', background: '#10b981', color: '#fff', fontWeight: 700, cursor: isFinishing ? 'not-allowed' : 'pointer', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)', opacity: isFinishing ? 0.7 : 1 }}>
                                  {isFinishing ? 'Salvando...' : 'Salvar e Finalizar'}
                              </button>
                          </div>
                      </div>
                  </div>
              )}
          </div>
      )
  }

  // --- Renderização da Lista (Design Moderno & Clean) ---
  
  if (isBlocked) {
      return (
          <div style={{ padding: 40, textAlign: 'center', marginTop: 60 }}>
              <div style={{ background: '#fef2f2', padding: 32, borderRadius: 24, border: '1px solid #fee2e2' }}>
                  <div style={{ background: '#fee2e2', width: 64, height: 64, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px auto' }}>
                      <X size={32} color="#dc2626" />
                  </div>
                  <h2 style={{ color: '#991b1b', marginBottom: 12 }}>Acesso Bloqueado</h2>
                  <p style={{ color: '#b91c1c', lineHeight: 1.6 }}>
                      Sua conta está inativa no momento.<br/>
                      Entre em contato com seu personal trainer para regularizar seu acesso aos treinos.
                  </p>
              </div>
          </div>
      )
  }

  return (
    <>
      <div style={{ padding: 16, maxWidth: 800, margin: '0 auto', fontFamily: 'Inter, system-ui, sans-serif' }}>
        
        {/* Frequência de Treinos */}
        <div style={{ background: '#fff', borderRadius: 24, padding: '20px 16px', boxShadow: '0 10px 30px -10px rgba(0,0,0,0.05)', marginBottom: 32, border: '1px solid rgba(0,0,0,0.02)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h2 style={{ fontSize: '1.1rem', color: '#0f172a', margin: 0, fontWeight: 800, letterSpacing: '-0.5px' }}>Frequência Semanal</h2>
                <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>{weeklyFreq} / {Object.keys(schedule).length || 5} treinos</span>
            </div>
            
            <div className="frequency-scroll">
                {/* Linha de conexão sutil */}
                <div style={{ position: 'absolute', top: 16, left: 16, right: 16, height: 2, background: '#f1f5f9', zIndex: 0, borderRadius: 2 }} />
                
                {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, i) => {
                    const isActive = Array.isArray(activeDays) && activeDays.includes(i)
                    const todayIndex = new Date().getDay()
                    const isToday = i === todayIndex
                    const isPast = i < todayIndex

                    let bg = '#fff'
                    let border = '2px solid #e2e8f0'
                    let color = '#94a3b8'
                    let content = null
                    let shadow = 'none'
                    let scale = 1

                    if (isActive) {
                        bg = '#10b981'
                        border = '2px solid #10b981'
                        color = '#fff'
                        content = <CheckCircle size={16} strokeWidth={3} />
                        shadow = '0 4px 12px rgba(16, 185, 129, 0.4)'
                        scale = 1.1
                    } else if (isPast) {
                        bg = '#fff'
                        border = '2px solid #fecaca'
                        color = '#ef4444'
                        content = <X size={16} strokeWidth={3} />
                    } else if (isToday) {
                        bg = '#fff'
                        border = '2px solid #3b82f6'
                        color = '#3b82f6'
                        content = <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6' }} />
                        shadow = '0 0 0 4px rgba(59, 130, 246, 0.15)'
                        scale = 1.1
                    }

                    return (
                        <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, zIndex: 1, position: 'relative', flex: 1 }}>
                            <div style={{ 
                                width: 34, height: 34, borderRadius: '50%', 
                                border: border, background: bg, 
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: color, boxShadow: shadow, 
                                transform: `scale(${scale})`,
                                transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
                            }}>
                                {content}
                            </div>
                            <span style={{ fontSize: '0.7rem', color: isToday ? '#3b82f6' : '#64748b', fontWeight: isToday ? 800 : 600 }}>{day}</span>
                        </div>
                    )
                })}
            </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <h1 style={{ fontSize: '1.5rem', color: '#0f172a', margin: 0, fontWeight: 800, letterSpacing: '-0.5px' }}>Seus Treinos</h1>
            <div style={{ fontSize: '0.9rem', color: '#64748b' }}>{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric' })}</div>
        </div>

        {workouts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8', background: '#f8fafc', borderRadius: 24, border: '2px dashed #e2e8f0' }}>
                <Dumbbell size={48} style={{ opacity: 0.2, marginBottom: 16 }} />
                <p>Nenhum treino encontrado para hoje.</p>
            </div>
        ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {Array.isArray(workoutsByDay) && workoutsByDay.map(group => (
                    <div key={group.dayKey} style={{ background: '#fff', borderRadius: 24, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.03)' }}>
                        <div style={{ padding: '24px', borderBottom: '1px solid #f8fafc' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '1.4rem', color: '#0f172a', fontWeight: 700, letterSpacing: '-0.5px' }}>{group.label}</h3>
                                    {group.workouts[0]?.data.goal && (
                                        <p style={{ margin: '6px 0 0 0', color: '#64748b', fontSize: '0.95rem' }}>
                                            Foco: <span style={{ color: '#3b82f6', fontWeight: 600 }}>{group.workouts[0].data.goal}</span>
                                        </p>
                                    )}
                                </div>
                                <div style={{ background: '#f1f5f9', padding: '8px 12px', borderRadius: 12, fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>
                                    {group.workouts.length} {group.workouts.length === 1 ? 'treino' : 'treinos'}
                                </div>
                            </div>
                        </div>

                        <div style={{ padding: 24 }}>
                            {group.workouts.map(w => (
                                <div key={w.id} style={{ marginBottom: 16 }}>
                                    <h4 style={{ margin: '0 0 12px 0', fontSize: '1rem', color: '#334155' }}>{w.title}</h4>
                                    <button 
                                        onClick={() => setSelectedWorkout(w)}
                                        style={{ 
                                            width: '100%', padding: '18px', borderRadius: 16, border: 'none', 
                                            background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)', color: '#fff', 
                                            fontSize: '1rem', fontWeight: 700, cursor: 'pointer', 
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                            boxShadow: '0 8px 16px -4px rgba(14, 165, 233, 0.3)',
                                            transition: 'transform 0.2s'
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                                        onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                                    >
                                        VER TREINO
                                        <div style={{ background: 'rgba(255,255,255,0.2)', padding: 6, borderRadius: 8, display: 'flex' }}>
                                            <ArrowRight size={18} />
                                        </div>
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
                
                {/* Outros Treinos */}
                {unscheduledWorkouts.length > 0 && (
                    <div style={{ marginTop: 24 }}>
                         <h3 style={{ fontSize: '1.1rem', color: '#64748b', margin: '0 0 20px 0', fontWeight: 600 }}>Outros Treinos Disponíveis</h3>
                         <div style={{ display: 'grid', gap: 16 }}>
                            {Array.isArray(unscheduledWorkouts) && unscheduledWorkouts.map(w => (
                                <div key={w.id} style={{ background: '#fff', padding: 20, borderRadius: 20, border: '1px solid #f1f5f9', boxShadow: '0 2px 8px rgba(0,0,0,0.02)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <h4 style={{ margin: 0, color: '#0f172a', fontSize: '1.1rem' }}>{w.title}</h4>
                                        <span style={{ fontSize: '0.85rem', color: '#64748b' }}>{w.data.exercises.length} exercícios</span>
                                    </div>
                                    <button 
                                        onClick={() => setSelectedWorkout(w)}
                                        style={{ padding: '12px 20px', background: '#f8fafc', color: '#0f172a', border: '1px solid #e2e8f0', borderRadius: 12, fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}
                                    >
                                        Ver
                                    </button>
                                </div>
                            ))}
                         </div>
                    </div>
                )}
            </div>
        )}

        {/* Modal de Detalhes Estilo MFIT (Clean & Modern) */}
        {selectedWorkout && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: '#f8fafc', zIndex: 2000, display: 'flex', flexDirection: 'column' }}>
                {/* Header Azul Moderno - Ponta a Ponta Compacto */}
                <div style={{ 
                    background: 'linear-gradient(135deg, #1e3a8a 0%, #172554 100%)', 
                    padding: '12px 20px 20px 20px', color: '#fff',
                    borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
                    boxShadow: '0 4px 12px -2px rgba(30, 58, 138, 0.3)',
                    flexShrink: 0
                }}>
                    <div>
                        <button onClick={() => setSelectedWorkout(null)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', cursor: 'pointer', marginBottom: 32, padding: '6px 12px', borderRadius: 20, width: 'fit-content' }}>
                            <ChevronLeft size={16} /> Voltar
                        </button>
                        
                        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.5px', lineHeight: 1.1 }}>{selectedWorkout.title}</h1>
                        <div style={{ display: 'flex', gap: 8, marginTop: 12, opacity: 0.9 }}>
                            {selectedWorkout.data.goal && <span style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(4px)', padding: '4px 12px', borderRadius: 8, fontSize: '0.75rem', fontWeight: 600, border: '1px solid rgba(255,255,255,0.1)' }}>{selectedWorkout.data.goal}</span>}
                            <span style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(4px)', padding: '4px 12px', borderRadius: 8, fontSize: '0.75rem', fontWeight: 600, border: '1px solid rgba(255,255,255,0.1)' }}>{selectedWorkout.data.exercises.length} exercícios</span>
                        </div>
                        
                        <div style={{ marginTop: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.05) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)', boxShadow: '0 8px 32px rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.2)', marginTop: 12, marginBottom: 12 }}>
                                <Dumbbell size={32} color="#fff" strokeWidth={1.5} />
                            </div>

                            {activeDays.includes(new Date().getDay()) ? (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    <div style={{ 
                                        background: '#fff', padding: '12px 28px', borderRadius: 30, 
                                        textAlign: 'center', fontWeight: 700, color: '#15803d', 
                                        boxShadow: '0 4px 20px rgba(0,0,0,0.08)', width: 'fit-content', margin: '0 auto',
                                        display: 'flex', alignItems: 'center', gap: 10, minWidth: 220, justifyContent: 'center', fontSize: '0.9rem',
                                        border: '1px solid #f0fdf4'
                                    }}>
                                        <CheckCircle size={18} color="#16a34a" strokeWidth={2.5} />
                                        TREINO REALIZADO
                                    </div>
                                </div>
                            ) : (
                                <div style={{ textAlign: 'center' }}>
                                    <button 
                                        onClick={() => handleStartSession(selectedWorkout)}
                                        style={{ 
                                            width: '100%', 
                                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', 
                                            color: '#fff', border: 'none', 
                                            padding: '16px 32px', borderRadius: 16, fontSize: '1rem', fontWeight: 800, 
                                            textTransform: 'uppercase', cursor: 'pointer', 
                                            boxShadow: '0 10px 25px -5px rgba(16, 185, 129, 0.4), 0 4px 10px -5px rgba(16, 185, 129, 0.2)',
                                            letterSpacing: '1px', transition: 'all 0.2s ease', maxWidth: 320,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12
                                        }}
                                        onMouseEnter={e => {
                                            e.currentTarget.style.transform = 'translateY(-2px)'
                                            e.currentTarget.style.boxShadow = '0 15px 30px -5px rgba(16, 185, 129, 0.5)'
                                        }}
                                        onMouseLeave={e => {
                                            e.currentTarget.style.transform = 'translateY(0)'
                                            e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(16, 185, 129, 0.4)'
                                        }}
                                    >
                                        <Play size={20} fill="currentColor" /> INICIAR TREINO
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Lista de Exercícios OTIMIZADA */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
                    <div style={{ maxWidth: 800, margin: '0 auto' }}>
                        
                        {/* Observações Gerais */}
                        {selectedWorkout.data.notes && (
                            <div style={{ marginBottom: 24 }}>
                                <div style={{ background: '#fff7ed', padding: '16px', borderRadius: 16, border: '1px solid #ffedd5', display: 'flex', alignItems: 'flex-start', gap: 12, boxShadow: '0 2px 6px rgba(249, 115, 22, 0.05)' }}>
                                    <div style={{ background: '#ffedd5', padding: 8, borderRadius: '50%', display: 'flex' }}>
                                        <MessageSquare size={20} style={{ color: '#ea580c' }} />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#ea580c', textTransform: 'uppercase', marginBottom: 4, letterSpacing: '0.5px' }}>Observações Gerais</div>
                                        <span style={{ color: '#9a3412', fontSize: '0.95rem', lineHeight: 1.6 }}>{selectedWorkout.data.notes}</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {selectedWorkout.data.exercises && Array.isArray(selectedWorkout.data.exercises) && selectedWorkout.data.exercises.map((ex, i) => (
                            <div key={i} style={{ 
                                background: '#fff', 
                                borderRadius: 16, 
                                padding: '12px', 
                                marginBottom: 12, 
                                display: 'flex', 
                                flexDirection: isMobile ? 'column' : 'row', // Responsivo
                                gap: 16, 
                                boxShadow: '0 2px 8px rgba(0,0,0,0.04)', 
                                border: '1px solid #f1f5f9', 
                                position: 'relative', 
                                overflow: 'hidden',
                                minHeight: 110
                            }}>
                                
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', zIndex: 10 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                                        <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#94a3b8', background: '#f8fafc', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', flexShrink: 0 }}>{i + 1}</span>
                                        <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a', fontWeight: 700, lineHeight: 1.2 }}>{ex.name}</h3>
                                    </div>
                                    
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 0 }}>
                                        {(() => {
                                            // Normaliza sets: usa o do banco se existir e for array, ou constrói a partir dos campos antigos
                                            let setsToRender: ExerciseSet[] = Array.isArray(ex.sets) ? ex.sets : []
                                            
                                            if (setsToRender.length === 0) {
                                                if (ex.warmupSeries || ex.warmupReps) {
                                                    setsToRender.push({ type: 'warmup', series: ex.warmupSeries || '', reps: ex.warmupReps || '', load: ex.warmupLoad || '', rest: ex.warmupRest || '' })
                                                }
                                                if (ex.feederSeries || ex.feederReps) {
                                                    setsToRender.push({ type: 'feeder', series: ex.feederSeries || '', reps: ex.feederReps || '', load: ex.feederLoad || '', rest: ex.feederRest || '' })
                                                }
                                                // Sempre tem trabalho (exceto se for vazio mesmo)
                                                if (ex.series || ex.reps) {
                                                    setsToRender.push({ type: 'working', series: ex.series || '', reps: ex.reps || '', load: ex.load || '', rest: ex.rest || '' })
                                                }
                                            }

                                            if (setsToRender.length > 0) {
                                                return (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                        {setsToRender.map((set, setIdx) => {
                                                            let color = '#334155'
                                                            let bg = 'transparent'
                                                            let label = ''

                                                            if (set.type === 'warmup') {
                                                                color = '#ea580c'
                                                                bg = '#fff7ed'
                                                                label = 'Aquecimento'
                                                            } else if (set.type === 'feeder') {
                                                                color = '#0284c7'
                                                                bg = '#f0f9ff'
                                                                label = 'Preparação'
                                                            } else if (set.type === 'working') {
                                                                color = '#16a34a'
                                                                bg = '#f0fdf4'
                                                                label = 'Trabalho'
                                                            } else if (set.type === 'topset') {
                                                                color = '#7c3aed'
                                                                bg = '#f5f3ff'
                                                                label = 'Top Set'
                                                            } else if (set.type === 'custom') {
                                                                color = '#475569'
                                                                bg = '#f1f5f9'
                                                                label = set.customLabel || 'Outro'
                                                            }

                                                            return (
                                                                <div key={setIdx} style={{ display: 'flex', flexDirection: 'column', gap: 4, background: bg, padding: '8px 12px', borderRadius: 8, border: `1px solid ${color}30` }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                                            <span style={{ fontWeight: 800, color: color, textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.5px', background: '#fff', padding: '2px 6px', borderRadius: 4, border: `1px solid ${color}20` }}>{label}</span>
                                                                            <span style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.9rem' }}>{set.series} x {set.reps}</span>
                                                                        </div>
                                                                        {set.load && <span style={{ fontWeight: 600, color: '#475569', fontSize: '0.8rem' }}>{set.load}</span>}
                                                                    </div>
                                                                    {set.rest && (
                                                                         <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: '#64748b', marginTop: 2 }}>
                                                                             <Clock size={12} />
                                                                             <span>{set.rest}</span>
                                                                         </div>
                                                                    )}
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                )
                                            } else {
                                                return <div style={{ color: '#94a3b8', fontStyle: 'italic', padding: 8, fontSize: '0.9rem' }}>Sem séries definidas.</div>
                                            }
                                        })()}
                                        
                                        {/* Obs */}
                                        {ex.notes && (
                                            <div style={{ fontSize: '0.8rem', color: '#64748b', background: '#fff7ed', padding: '8px 10px', borderRadius: 8, border: '1px solid #ffedd5', display: 'flex', alignItems: 'flex-start', gap: 6, marginTop: 4 }}>
                                                <MessageSquare size={14} style={{ marginTop: 2, flexShrink: 0, color: '#f97316' }} /> 
                                                <span style={{ color: '#c2410c', lineHeight: 1.4 }}>{ex.notes}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                
                                {/* Video Thumbnail (Vertical-ish) ou Player Inline */}
                                {ex.videoUrl ? (
                                    <div 
                                        style={{ 
                                            width: isMobile ? '100%' : 180,
                                            height: isMobile ? (playingVideoIndex === i ? 'auto' : 200) : 270,
                                            aspectRatio: isMobile && playingVideoIndex === i ? '16/9' : undefined,
                                            alignSelf: 'center',
                                            borderRadius: 12, 
                                            overflow: 'hidden', 
                                            background: '#000', 
                                            flexShrink: 0, 
                                            position: 'relative', 
                                            cursor: playingVideoIndex === i ? 'default' : 'pointer',
                                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                                        }}
                                    >
                                        {playingVideoIndex === i ? (
                                            /* PLAYER INLINE */
                                            (() => {
                                                const isYoutube = ex.videoUrl && (typeof ex.videoUrl === 'string') && (ex.videoUrl.includes('youtube.com') || ex.videoUrl.includes('youtu.be'));
                                                if (isYoutube) {
                                                    const videoId = ex.videoUrl?.split('v=')[1]?.split('&')[0] || ex.videoUrl?.split('/').pop();
                                                    return (
                                                        <iframe 
                                                            src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&controls=1&playsinline=1`} 
                                                            title={ex.name}
                                                            style={{ width: '100%', height: '100%', border: 'none' }}
                                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                                                            allowFullScreen
                                                        />
                                                    );
                                                } else {
                                                    return (
                                                        <video 
                                                            src={ex.videoUrl} 
                                                            controls 
                                                            autoPlay
                                                            playsInline
                                                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                                        />
                                                    );
                                                }
                                            })()
                                        ) : (
                                            /* THUMBNAIL (Clique para Tocar) */
                                            <div onClick={() => setPlayingVideoIndex(i)} style={{ width: '100%', height: '100%', position: 'relative' }}>
                                                {(() => {
                                                    const isYoutube = ex.videoUrl && (typeof ex.videoUrl === 'string') && (ex.videoUrl.includes('youtube.com') || ex.videoUrl.includes('youtu.be'));
                                                    let thumbUrl = '';
                                                    if (isYoutube) {
                                                        const videoId = ex.videoUrl?.split('v=')[1]?.split('&')[0] || ex.videoUrl?.split('/').pop();
                                                        thumbUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
                                                    }
                                                    
                                                    return (
                                                        <>
                                                            {thumbUrl ? (
                                                                <img src={thumbUrl} alt={ex.name} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8 }} />
                                                            ) : (
                                                                <video src={ex.videoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8 }} />
                                                            )}
                                                            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'rgba(0,0,0,0.6)', borderRadius: '50%', padding: 12, backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                <Play size={24} fill="#fff" color="#fff" style={{ marginLeft: 2 }} />
                                                            </div>
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div style={{ 
                                        width: isMobile ? '100%' : 180, 
                                        height: isMobile ? 100 : 270, 
                                        alignSelf: 'center', background: '#f8fafc', 
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        borderRadius: 12, border: '1px solid #e2e8f0', flexShrink: 0
                                    }}>
                                        <Dumbbell size={24} color="#cbd5e1" />
                                    </div>
                                )}
                            </div>
                        ))}
                        <div style={{ height: 40 }} /> {/* Espaço extra no final */}
                    </div>
                </div>
            </div>
        )}

        {showSuccessModal && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 3000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 24, backdropFilter: 'blur(4px)' }}>
                <div style={{ background: '#fff', width: '100%', maxWidth: 360, borderRadius: 24, padding: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)', animation: 'popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)' }}>
                    <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
                        <div style={{ fontSize: '2.5rem' }}>🎉</div>
                    </div>
                    <h2 style={{ margin: '0 0 8px 0', color: '#0f172a', fontSize: '1.5rem' }}>Treino Concluído!</h2>
                    <p style={{ margin: '0 0 24px 0', color: '#64748b', fontSize: '1rem', lineHeight: 1.5 }}>Parabéns! Mais um passo em direção ao seu objetivo. Continue assim! 💪</p>
                    <button onClick={() => setShowSuccessModal(false)} style={{ background: '#10b981', color: '#fff', border: 'none', padding: '14px 32px', borderRadius: 16, fontSize: '1rem', fontWeight: 700, cursor: 'pointer', width: '100%', boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.4)' }}>Fechar</button>
                </div>
                <style>{`@keyframes popIn { from { opacity: 0; transform: scale(0.8) translateY(20px); } to { opacity: 1; transform: scale(1) translateY(0); } }`}</style>
            </div>
        )}
      </div>
    </>
  )
}