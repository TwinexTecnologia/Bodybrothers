import { useEffect, useState } from 'react'
import { useAuth } from '../../auth/useAuth'
import { useNavigate } from 'react-router-dom'
import { LogOut, Dumbbell, Calendar, User, FileText } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export default function StudentHome() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [studentName, setStudentName] = useState('Aluno(a)')
  const [workouts, setWorkouts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const handleLogout = async () => {
    await signOut()
    navigate('/app/login')
  }

  useEffect(() => {
      if (!user) return

      async function loadData() {
          try {
              // Carrega Perfil
              const { data: profile } = await supabase.from('profiles').select('full_name, data').eq('id', user!.id).single()
              if (profile?.full_name) setStudentName(profile.full_name.split(' ')[0])
              
              const workoutIds = profile?.data?.workoutIds || []

              // Carrega Treinos
              let query = supabase.from('protocols').select('*').eq('type', 'workout').eq('status', 'active')
              
              if (workoutIds.length > 0) {
                  query = query.or(`student_id.eq.${user!.id},id.in.(${workoutIds.join(',')})`)
              } else {
                  query = query.eq('student_id', user!.id)
              }

              const { data: wData } = await query
              setWorkouts(wData || [])
          } catch (error) {
              console.error(error)
          } finally {
              setLoading(false)
          }
      }
      loadData()
  }, [user])

  const handleExportPDF = () => {
      if (workouts.length === 0) {
          alert('Você não possui treinos ativos para exportar.')
          return
      }

      const doc = new jsPDF()
      
      // Header
      doc.setFontSize(18)
      doc.setTextColor(15, 23, 42)
      doc.text(`Ficha de Treino - ${studentName.toUpperCase()}`, 14, 20)
      
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

      doc.save(`Treinos_${studentName}.pdf`)
  }

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh', paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ background: '#fff', padding: '20px 20px 10px 20px', borderBottom: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
                <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>Olá,</p>
                <h2 style={{ margin: 0, color: '#0f172a', fontSize: '1.4rem' }}>{studentName}</h2>
            </div>
            <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: '#ef4444' }}>
                <LogOut size={20} />
            </button>
        </div>
      </div>

      <div style={{ padding: 20 }}>
        
        {/* Banner de Treino do Dia (Mockado ou Real se implementarmos schedule) */}
        <div style={{ 
            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', 
            borderRadius: 16, 
            padding: 20, 
            color: '#fff',
            boxShadow: '0 10px 20px -5px rgba(37, 99, 235, 0.3)',
            marginBottom: 24
        }}>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '1.2rem' }}>Seus Treinos</h3>
            <p style={{ margin: 0, opacity: 0.9 }}>{workouts.length} fichas disponíveis</p>
            <button 
                onClick={() => {}} // Futuro: Ir para lista
                style={{ 
                marginTop: 16, 
                background: '#fff', 
                color: '#2563eb', 
                border: 'none', 
                padding: '8px 16px', 
                borderRadius: 20, 
                fontWeight: 600,
                fontSize: '0.9rem'
            }}>
                Ver Lista
            </button>
        </div>

        <h3 style={{ color: '#334155', marginBottom: 12 }}>Acesso Rápido</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div 
                onClick={handleExportPDF}
                style={{ background: '#fff', padding: 16, borderRadius: 12, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, cursor: 'pointer' }}
            >
                <div style={{ padding: 10, background: '#eff6ff', borderRadius: '50%', color: '#3b82f6' }}><FileText size={24} /></div>
                <span style={{ fontWeight: 500, color: '#475569', textAlign: 'center', fontSize: '0.9rem' }}>Exportar Treino</span>
            </div>
            
            <div style={{ background: '#fff', padding: 16, borderRadius: 12, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, opacity: 0.5 }}>
                <div style={{ padding: 10, background: '#f0fdf4', borderRadius: '50%', color: '#16a34a' }}><Calendar size={24} /></div>
                <span style={{ fontWeight: 500, color: '#475569' }}>Agenda</span>
            </div>
        </div>
      </div>

      {/* Bottom Nav */}
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
