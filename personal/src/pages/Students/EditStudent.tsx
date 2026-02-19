import { useEffect, useState, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Camera } from 'lucide-react'
import { listStudentsByPersonal, updateStudent, getStudent, type StudentRecord } from '../../store/students'
import { listActiveDiets, type DietRecord, listStudentDiets, duplicateDiet, updateDiet, deleteDietIfPersonalized } from '../../store/diets'
import { listActiveWorkouts, duplicateWorkout, updateWorkout, setWorkoutStatus, type WorkoutRecord } from '../../store/workouts'
import { listLibraryModels, listStudentModels, duplicateModel, updateModel, deleteModel, type AnamnesisModel } from '../../store/anamnesis'
import { listPlans, type PlanRecord } from '../../store/plans'
import { listAllStudentPayments } from '../../store/financial'
import { isStudentOverdue } from '../../lib/finance_utils'
import Modal from '../../components/Modal'
import { supabase } from '../../lib/supabase'
import { generateDietPdf } from '../../lib/pdf'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export default function EditStudent() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const urlId = params.get('id')
  
  const [students, setStudents] = useState<StudentRecord[]>([])
  const [selectedId, setSelectedId] = useState(urlId || '')
  
  // Form States
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [whatsapp, setWhatsapp] = useState('') // Adicionado estado para WhatsApp
  const [tempPassword, setTempPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [cep, setCep] = useState('')
  const [street, setStreet] = useState('')
  const [neighborhood, setNeighborhood] = useState('')
  const [city, setCity] = useState('')
  const [stateUf, setStateUf] = useState('')
  const [number, setNumber] = useState('')
  const [complement, setComplement] = useState('')
  
  const [plans, setPlans] = useState<PlanRecord[]>([])
  const [planId, setPlanId] = useState('')
  const [planStartDate, setPlanStartDate] = useState('')
  const [dueDay, setDueDay] = useState('')
  
  // Protocolos
  const [allWorkouts, setAllWorkouts] = useState<WorkoutRecord[]>([])
  const [diets, setDiets] = useState<DietRecord[]>([]) // Dietas da biblioteca
  const [studentDiets, setStudentDiets] = useState<DietRecord[]>([]) // Dietas personalizadas
  const [selectedDietIds, setSelectedDietIds] = useState<string[]>([])
  const [workoutSchedule, setWorkoutSchedule] = useState<Record<string, string[]>>({})
  
  // Anamneses
  const [libraryAnamnesis, setLibraryAnamnesis] = useState<AnamnesisModel[]>([])
  const [studentAnamnesis, setStudentAnamnesis] = useState<AnamnesisModel[]>([])
  const [answeredAnamnesis, setAnsweredAnamnesis] = useState<any[]>([])
  const [selectedAnamnesisId, setSelectedAnamnesisId] = useState('')
  const [validityDays, setValidityDays] = useState('90')
  
  // Controle de Treinos e Dietas
  const [libraryWorkoutId, setLibraryWorkoutId] = useState('')
  const [libraryDietId, setLibraryDietId] = useState('')
  
  // Estado para Modal de Confirmação de Vínculo Inteligente
  const [smartLinkState, setSmartLinkState] = useState<{
      type: 'workout' | 'diet' | 'anamnesis';
      itemId: string;
      itemName: string;
      days?: number; // apenas para anamnese
  } | null>(null)

  // Estado para Confirmação Genérica (Exclusão/Arquivamento)
  const [confirmModal, setConfirmModal] = useState<{
      isOpen: boolean;
      title: string;
      message: string;
      onConfirm: () => void;
      type?: 'danger' | 'default';
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {}, type: 'default' })

  // Branding para PDF
  const [brandLogoUrl, setBrandLogoUrl] = useState('')

  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(true)
  const [checkingFinancial, setCheckingFinancial] = useState(false)
  const [blockModalOpen, setBlockModalOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('') // Estado para busca

  // Filtros
  const studentWorkouts = allWorkouts.filter(w => w.studentId === selectedId && w.status === 'ativo')
  const libraryWorkouts = allWorkouts.filter(w => !w.studentId && w.status === 'ativo')

  // Filtra alunos pelo termo de busca
  const filteredStudents = useMemo(() => {
      if (!students || !Array.isArray(students)) return []
      const term = (searchTerm || '').toLowerCase()
      return students.filter(s => {
          if (!s) return false
          const name = (s.name || '').toLowerCase()
          return name.includes(term)
      })
  }, [students, searchTerm])

  // Mapa de nomes de alunos para lookup rápido
  const studentMap = useMemo(() => {
      const map: Record<string, string> = {}
      if (students && Array.isArray(students)) {
          students.forEach(s => {
              if (s && s.id) map[s.id] = s.name || ''
          })
      }
      return map
  }, [students])

  // Opções para dropdowns (Blindado contra erros)
  const workoutOptions = useMemo(() => {
      const activeOptions = (allWorkouts || [])
        .filter(w => w && w.studentId !== selectedId)
        .map(w => {
            const ownerName = w.studentId ? studentMap[w.studentId] : null
            const label = ownerName ? `${w.name} (👤 ${ownerName})` : `📚 ${w.name}`
            return { id: w.id, label }
        })

      return activeOptions.sort((a, b) => a.label.localeCompare(b.label))
  }, [allWorkouts, selectedId, studentMap])

  const dietOptions = useMemo(() => {
      const activeOptions = (diets || [])
        .filter(d => d && d.studentId !== selectedId)
        .map(d => {
            const ownerName = d.studentId ? studentMap[d.studentId] : null
            const label = ownerName ? `${d.name} (👤 ${ownerName})` : `📚 ${d.name}`
            return { id: d.id, label }
        })

      return activeOptions.sort((a, b) => a.label.localeCompare(b.label))
  }, [diets, selectedId, studentMap])
  
  const anamnesisOptions = useMemo(() => {
      return (libraryAnamnesis || [])
          .map(a => ({ id: a.id, label: `📚 ${a.name}` }))
          .sort((a, b) => a.label.localeCompare(b.label))
  }, [libraryAnamnesis])

  useEffect(() => {
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
            // Carrega Logo
            const { data: config } = await supabase.from('personal_config').select('logo_url').eq('personal_id', user.id).single()
            if (config?.logo_url) setBrandLogoUrl(config.logo_url)

            // 1. Carrega Alunos PRIMEIRO
            const studentList = await listStudentsByPersonal(user.id)
            setStudents(studentList)
            
            if (!selectedId && studentList.length > 0) {
                setSelectedId(studentList[0].id)
            }
            
            setLoading(false)

            // 2. Carrega o resto em segundo plano
            Promise.all([
                listPlans(user.id),
                listActiveWorkouts(user.id),
                listActiveDiets(user.id),
                listLibraryModels(user.id)
            ]).then(([planList, workoutList, dietList, anamnesisList]) => {
                setPlans(planList)
                setAllWorkouts(workoutList)
                setDiets(dietList)
                setLibraryAnamnesis(anamnesisList)
            }).catch(err => console.error('Erro no carregamento secundário:', err))
        } else {
            setLoading(false)
        }
      } catch (error) {
        console.error('Erro ao carregar dados:', error)
        setMsg('Erro ao carregar dados.')
        setLoading(false)
      }
    }
    load()
  }, [])
  
  // Recarrega recursos do aluno selecionado
  useEffect(() => {
      if (!selectedId) return
      
      async function loadStudentResources() {
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            const sAnamnesis = await listStudentModels(user.id, selectedId)
            setStudentAnamnesis(sAnamnesis)
            
            // Carrega respondidas
            const { data: answered } = await supabase
                .from('protocols')
                .select('id, title, created_at')
                .eq('student_id', selectedId)
                .eq('type', 'anamnesis')
                .order('created_at', { ascending: false })
            setAnsweredAnamnesis(answered || [])
            
            const sDiets = await listStudentDiets(user.id, selectedId)
            setStudentDiets(sDiets)
          }
      }
      loadStudentResources()
  }, [selectedId])

  // Recarrega treinos
  const reloadWorkouts = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
          const list = await listActiveWorkouts(user.id)
          setAllWorkouts(list)
      }
  }

  // Recarrega anamneses
  const reloadAnamnesis = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user && selectedId) {
          const list = await listStudentModels(user.id, selectedId)
          setStudentAnamnesis(list)
          
          // Carrega respondidas
          const { data } = await supabase
            .from('protocols')
            .select('id, title, created_at')
            .eq('student_id', selectedId)
            .eq('type', 'anamnesis')
            .order('created_at', { ascending: false })
          setAnsweredAnamnesis(data || [])
      }
  }

  // Recarrega dietas do aluno
  const reloadStudentDiets = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user && selectedId) {
          const list = await listStudentDiets(user.id, selectedId)
          setStudentDiets(list)
      }
  }

  // Carregar detalhes do aluno selecionado para o Form
  useEffect(() => {
    if (!selectedId) return
    
    async function fetchDetails() {
        const s = await getStudent(selectedId)
        if (s) {
            setName(s.name)
            setEmail(s.email)
            setWhatsapp(s.whatsapp || '') // Carrega whatsapp do campo raiz
            setTempPassword(s.tempPassword || '')
            setCep(s.address?.cep || '')
            setStreet(s.address?.street || '')
            setNeighborhood(s.address?.neighborhood || '')
            setCity(s.address?.city || '')
            setStateUf(s.address?.state || '')
            setNumber(s.address?.number || '')
            setComplement(s.address?.complement || '')
            setPlanId(s.planId || '')
            setPlanStartDate(s.planStartDate || '')
            setDueDay(s.dueDay ? String(s.dueDay) : '')
            setSelectedDietIds(s.dietIds || [])
            setWorkoutSchedule(s.workoutSchedule || {})
        }
    }
    fetchDetails()
  }, [selectedId])
  
  // --- HANDLERS ---

  const handlePlanChange = async (newPlanId: string) => {
      // Se estiver limpando o plano, permite
      if (!newPlanId) {
          setPlanId('')
          return
      }
      
      const currentStudent = students.find(s => s.id === selectedId)
      
      // Se não tem plano anterior ou é o mesmo, permite
      if (!currentStudent?.planId || newPlanId === currentStudent.planId) {
          setPlanId(newPlanId)
          if (newPlanId && !planStartDate) setPlanStartDate(new Date().toISOString().split('T')[0])
          return
      }

      setCheckingFinancial(true)
      try {
          // Busca detalhes do plano ATUAL
          const currentPlan = plans.find(p => p.id === currentStudent.planId)
          
          if (currentPlan) {
              // Busca pagamentos
              const payments = await listAllStudentPayments(selectedId)
              
              // Verifica inadimplência
              const isOverdue = isStudentOverdue(currentStudent, currentPlan, payments)
              
              if (isOverdue) {
                  setBlockModalOpen(true)
                  setCheckingFinancial(false)
                  return // Bloqueia mudança
              }
          }
      } catch (error) {
          console.error('Erro ao verificar financeiro:', error)
      }
      setCheckingFinancial(false)

      // Se passou, atualiza
      setPlanId(newPlanId)
      if (newPlanId && !planStartDate) setPlanStartDate(new Date().toISOString().split('T')[0])
  }

  const handleAddDiet = async () => {
      if (!libraryDietId) return
      setLoading(true)

      // Verifica se é um item da biblioteca que PARECE ser do aluno
      const diet = diets.find(d => d.id === libraryDietId)
      const currentStudent = students.find(s => s.id === selectedId)
      
      let shouldMove = false
      if (diet && !diet.studentId && currentStudent) {
          const firstName = currentStudent.name.split(' ')[0]
          if (diet.name.toLowerCase().includes(firstName.toLowerCase())) {
              shouldMove = true
          }
      }

      if (shouldMove) {
          setSmartLinkState({
              type: 'diet',
              itemId: libraryDietId,
              itemName: diet.name
          })
          setLoading(false)
          return
      } else {
          await duplicateDiet(libraryDietId, selectedId)
      }

      await reloadStudentDiets()
      
      // Reload library diets
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
          const list = await listActiveDiets(user.id)
          setDiets(list)
      }
      
      setLibraryDietId('')
      setLoading(false)
  }

  const handleRemoveStudentDiet = async (did: string) => {
      setConfirmModal({
          isOpen: true,
          title: 'Arquivar Dieta',
          message: 'Tem certeza que deseja remover esta dieta do aluno? Ela será arquivada e poderá ser recuperada depois.',
          type: 'danger',
          onConfirm: async () => {
              setLoading(true)
              await updateDiet(did, { status: 'inativa' })
              await reloadStudentDiets()
              setLoading(false)
              setConfirmModal(prev => ({ ...prev, isOpen: false }))
          }
      })
  }

  const handleExportDietPdf = async (d: DietRecord) => {
      await generateDietPdf(d, brandLogoUrl)
  }

  const onCepBlur = async () => {
    const onlyDigits = cep.replace(/\D/g, '')
    if (onlyDigits.length !== 8) return
    try {
      const res = await fetch(`https://viacep.com.br/ws/${onlyDigits}/json/`)
      const data = await res.json()
      if (!data.erro) {
        setStreet(data.logradouro || '')
        setNeighborhood(data.bairro || '')
        setCity(data.localidade || '')
        setStateUf(data.uf || '')
      }
    } catch { void 0 }
  }

  const genPass = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let s = ''
    for (let i = 0; i < 10; i++) s += chars[Math.floor(Math.random() * chars.length)]
    setTempPassword(s)
    setMsg('Senha provisória gerada')
  }
  
  const handleSmartLinkAction = async (action: 'link' | 'copy') => {
      if (!smartLinkState) return
      setLoading(true)

      const { type, itemId, days } = smartLinkState

      if (action === 'link') {
          if (type === 'workout') {
              await updateWorkout(itemId, { studentId: selectedId })
              await reloadWorkouts()
          } else if (type === 'diet') {
              await updateDiet(itemId, { studentId: selectedId })
              await reloadStudentDiets()
          } else if (type === 'anamnesis') {
              await updateModel(itemId, { studentId: selectedId })
              await reloadAnamnesis()
              await reloadLibraryAnamnesis()
          }
      } else {
          // COPY
          if (type === 'workout') {
              await duplicateWorkout(itemId, selectedId)
              await reloadWorkouts()
          } else if (type === 'diet') {
              await duplicateDiet(itemId, selectedId)
              await reloadStudentDiets()
          } else if (type === 'anamnesis') {
              await duplicateModel(itemId, selectedId, days || 90)
              await reloadAnamnesis()
              await reloadLibraryAnamnesis()
          }
      }

      setSmartLinkState(null)
      // Recarrega bibliotecas
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
          if (type === 'workout') setAllWorkouts(await listActiveWorkouts(user.id))
          if (type === 'diet') setDiets(await listActiveDiets(user.id))
      }
      setLoading(false)
  }

  const handleAddWorkout = async () => {
      if (!libraryWorkoutId) return
      setLoading(true)
      
      // Verifica se é um item da biblioteca que PARECE ser do aluno (ex: "Treino - Alex")
      const workout = allWorkouts.find(w => w.id === libraryWorkoutId)
      const currentStudent = students.find(s => s.id === selectedId)
      
      let shouldMove = false
      if (workout && !workout.studentId && currentStudent) {
          const firstName = currentStudent.name.split(' ')[0]
          // Heurística: Se o nome contém o nome do aluno, assume que é dele e move (vínculo)
          if (workout.name.toLowerCase().includes(firstName.toLowerCase())) {
              shouldMove = true
          }
      }

      if (shouldMove && workout) {
          setSmartLinkState({
              type: 'workout',
              itemId: libraryWorkoutId,
              itemName: workout.name
          })
          setLoading(false)
          return
      }

      await duplicateWorkout(libraryWorkoutId, selectedId)
      await reloadWorkouts()
      setLibraryWorkoutId('')
      setLoading(false)
  }

  const handleRemoveStudentWorkout = async (wid: string) => {
      setConfirmModal({
          isOpen: true,
          title: 'Desvincular Treino',
          message: 'Tem certeza que deseja remover este treino do aluno? Ele voltará para a biblioteca geral (desvinculado) mas permanecerá arquivado.',
          type: 'danger',
          onConfirm: async () => {
              setLoading(true)
              // Atualiza studentId para null (volta pra biblioteca) E status para 'inativo' (arquivado)
              await updateWorkout(wid, { studentId: null, status: 'inativo' })
              await reloadWorkouts()
              setLoading(false)
              setConfirmModal(prev => ({ ...prev, isOpen: false }))
          }
      })
  }

  const toggleDay = (wid: string, day: string) => {
      setWorkoutSchedule(prev => {
          const days = prev[wid] || []
          const newDays = days.includes(day) 
              ? days.filter(d => d !== day)
              : [...days, day]
          return { ...prev, [wid]: newDays }
      })
  }

  // Função auxiliar para recarregar biblioteca de anamneses
  const reloadLibraryList = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
          const list = await listLibraryModels(user.id)
          setLibraryAnamnesis(list)
      }
  }

  const handleAddAnamnesis = async () => {
      if (!selectedAnamnesisId) return
      setLoading(true)
      
      const days = parseInt(validityDays) || 90
      
      try {
        // Sempre duplica (cria instância para o aluno) pois anamnese é individual
        // Se o usuário achar que está duplicando visualmente, pode ser porque a lista não atualizou
        await duplicateModel(selectedAnamnesisId, selectedId, days)

        await reloadAnamnesis()
        await reloadLibraryList()
        setSelectedAnamnesisId('')
      } catch (error) {
        console.error('Erro:', error)
        alert('Erro ao adicionar. Tente novamente.')
      } finally {
        setLoading(false)
      }
  }

  const handleRemoveAnamnesis = async (aid: string) => {
      if (!confirm('Tem certeza que deseja remover esta anamnese do aluno?')) return
      
      setLoading(true)
      try {
        // Se foi duplicada, o correto seria deletar (deleteModel) e não apenas desvincular (updateModel)
        // Pois se desvincular, ela volta pra biblioteca como uma "cópia perdida"
        // Vou assumir que devemos DELETAR a instância do aluno para limpar o banco
        await deleteModel(aid) 
        
        await reloadAnamnesis()
        await reloadLibraryList() 
      } catch (error) {
        console.error('Erro:', error)
        alert('Erro ao remover.')
      } finally {
        setLoading(false)
      }
  }

  const handleExportWorkoutsPDF = () => {
      if (studentWorkouts.length === 0) {
          alert('O aluno não possui treinos ativos.')
          return
      }

      const doc = new jsPDF()
      const studentName = name || 'Aluno'
      
      // Header
      doc.setFontSize(18)
      doc.setTextColor(15, 23, 42) // Slate 900
      doc.text(`Ficha de Treino - ${studentName}`, 14, 20)
      
      doc.setFontSize(10)
      doc.setTextColor(100, 116, 139) // Slate 500
      doc.text(`Gerado em ${new Date().toLocaleDateString()}`, 14, 26)

      let yPos = 35

      studentWorkouts.forEach((workout, index) => {
          // Título do Treino
          doc.setFontSize(14)
          doc.setTextColor(15, 23, 42)
          doc.text(workout.name, 14, yPos)
          yPos += 8

          // Observações do Treino
          if (workout.notes) {
              doc.setFontSize(10)
              doc.setTextColor(100, 116, 139)
              const splitNotes = doc.splitTextToSize(`Obs: ${workout.notes}`, 180)
              doc.text(splitNotes, 14, yPos)
              yPos += (splitNotes.length * 5) + 4
          }

          // Tabela de Exercícios
          const tableBody = (workout.exercises || []).map((ex: any) => {
              // Formata Séries/Reps
              let setsText = ''
              if (ex.sets && ex.sets.length > 0) {
                   const mainSet = ex.sets.find((s: any) => s.type === 'working') || ex.sets[0]
                   setsText = `${mainSet.series} x ${mainSet.reps}`
                   // Se tiver variação, indica
                   const hasVariation = ex.sets.some((s: any) => s.series !== mainSet.series || s.reps !== mainSet.reps)
                   if (hasVariation) setsText += '*'
              } else {
                   setsText = `${ex.series || '-'} x ${ex.reps || '-'}`
              }

              // Formata Carga
              let loadText = ex.load || ''
              if (ex.sets && ex.sets.length > 0) {
                  loadText = ex.sets[0].load || ''
              }

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
              styles: { fontSize: 9, cellPadding: 3 },
              columnStyles: {
                  0: { cellWidth: 60 }, // Exercício
                  4: { cellWidth: 50 }  // Obs
              },
              margin: { top: 20 },
              didDrawPage: (data) => {
                  // Se quebrou página, atualiza yPos
                  yPos = data.cursor?.y || 20
              }
          })

          yPos = (doc as any).lastAutoTable.finalY + 15
          
          // Se não for o último e tiver pouco espaço, nova página
          if (index < studentWorkouts.length - 1 && yPos > 250) {
              doc.addPage()
              yPos = 20
          }
      })

      doc.save(`Treinos_${studentName.replace(/\s+/g, '_')}.pdf`)
  }

  const save = async () => {
    if (!selectedId) return
    const { data: { user } } = await supabase.auth.getUser()
    
    const currentStudent = students.find(s => s.id === selectedId)
    const oldData = currentStudent ? {
        name: currentStudent.name,
        email: currentStudent.email,
        planId: currentStudent.planId,
        dietIds: currentStudent.dietIds || [],
        address: currentStudent.address
    } : {}

    const newData = {
        name: name.trim(),
        email: email,
        whatsapp: whatsapp,
        planId: planId || undefined,
        planStartDate: planStartDate || undefined,
        dueDay: dueDay ? parseInt(dueDay) : undefined,
        dietIds: selectedDietIds,
        address: { cep, street, neighborhood, city, state: stateUf, number, complement }
    }

    const changes: any = {}
    if (newData.name !== oldData.name) changes.name = { old: oldData.name, new: newData.name }
    
    // Converte para campos reais e JSON
    await updateStudent(selectedId, {
      name: newData.name,
      email: newData.email,
      whatsapp: newData.whatsapp,
      address: newData.address,
      planId: newData.planId, // Isso vai atualizar o JSON data->planId
      planStartDate: newData.planStartDate,
      dueDay: newData.dueDay,
      dietIds: newData.dietIds,
      workoutSchedule,
      tempPassword
    })

    // Atualiza também as colunas reais na tabela profiles para garantir compatibilidade
    const { error: profileError } = await supabase.from('profiles').update({
        plan_id: newData.planId,
        due_day: newData.dueDay
    }).eq('id', selectedId)

    if (profileError) console.error('Erro ao atualizar colunas reais:', profileError)

    if (user && Object.keys(changes).length > 0) {
        await supabase.from('audit_logs').insert({
            user_id: user.id,
            target_id: selectedId,
            target_table: 'profiles',
            action: 'UPDATE',
            details: {
                changed_at: new Date().toISOString(),
                changes: changes 
            }
        })
    }

    setMsg('Aluno atualizado com sucesso!')
    setStudents(prev => prev.map(s => s.id === selectedId ? { ...s, name, email } : s))
  }

  if (loading) return <div>Carregando...</div>

  // --- STYLES ---
  const cardStyle = {
      background: '#fff',
      borderRadius: '12px',
      padding: '24px',
      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)'
      // marginBottom removido, controlado pelo gap da coluna
  }
  const sectionTitleStyle = {
      fontSize: '1.1rem',
      fontWeight: 700,
      color: '#1e293b',
      marginBottom: '16px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
  }
  const gridContainerStyle = {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', // Reduzi para 320px para quebrar linha mais cedo em telas médias
      gap: '40px', // Aumentei o espaço entre colunas
      alignItems: 'start',
      width: '100%'
  }

  const columnStyle = {
      display: 'flex', 
      flexDirection: 'column' as const, 
      gap: '24px', // Garante espaçamento entre cards verticais
      minWidth: 0 // Previne overflow em grids
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: 100 }}>
      {/* Header Fixo / Topo */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.8rem', color: '#0f172a' }}>Gerenciar Aluno</h1>
            <p style={{ margin: '4px 0 0 0', color: '#64748b' }}>Edite dados, treinos e dietas do aluno selecionado</p>
          </div>
          <div style={{ width: 300, display: 'flex', flexDirection: 'column', gap: 6 }}>
             <input 
                className="input" 
                placeholder="🔍 Buscar aluno por nome..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{ fontSize: '0.9em', padding: '8px', borderRadius: 6 }}
             />
             <select 
                className="select" 
                value={selectedId} 
                onChange={(e) => setSelectedId(e.target.value)}
                style={{ fontSize: '1em', padding: '10px', boxShadow: '0 2px 4px -1px rgba(0,0,0,0.05)' }}
             >
                <option value="">Selecione na lista...</option>
                {filteredStudents.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
             </select>
          </div>
      </div>

      {selectedId && (
        <div style={gridContainerStyle}>
            
            {/* COLUNA ESQUERDA: CADASTRO */}
            <div style={columnStyle}>
                
                {/* DADOS PESSOAIS */}
                <div style={cardStyle}>
                    <div style={sectionTitleStyle}>👤 Dados Pessoais</div>
                    <div className="form-grid">
                        <label className="label">
                            Nome
                            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
                        </label>
                        <label className="label">
                            Email
                            <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
                        </label>
                        <label className="label">
                            WhatsApp
                            <input className="input" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="(00) 00000-0000" />
                        </label>
                    </div>
                </div>

                {/* ENDEREÇO */}
                <div style={cardStyle}>
                    <div style={sectionTitleStyle}>📍 Endereço</div>
                    <div className="form-grid-3">
                        <label className="label">CEP <input className="input" style={{ width: '100%' }} value={cep} onChange={(e) => setCep(e.target.value)} onBlur={onCepBlur} /></label>
                        <label className="label" style={{ gridColumn: 'span 2' }}>Rua <input className="input" style={{ width: '100%' }} value={street} onChange={(e) => setStreet(e.target.value)} /></label>
                        <label className="label">Bairro <input className="input" style={{ width: '100%' }} value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} /></label>
                        <label className="label">Cidade <input className="input" style={{ width: '100%' }} value={city} onChange={(e) => setCity(e.target.value)} /></label>
                        <label className="label">Estado <input className="input" style={{ width: '100%' }} value={stateUf} onChange={(e) => setStateUf(e.target.value)} /></label>
                        <label className="label">Número <input className="input" style={{ width: '100%' }} value={number} onChange={(e) => setNumber(e.target.value)} /></label>
                        <label className="label">Compl. <input className="input" style={{ width: '100%' }} value={complement} onChange={(e) => setComplement(e.target.value)} /></label>
                    </div>
                </div>

                {/* FINANCEIRO */}
                <div style={cardStyle}>
                    <div style={sectionTitleStyle}>💰 Plano & Financeiro</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <label className="label">
                            Plano
                            <select 
                                className="select" 
                                style={{ width: '100%' }}
                                value={planId} 
                                disabled={checkingFinancial}
                                onChange={(e) => handlePlanChange(e.target.value)}
                            >
                                <option value="">Selecione...</option>
                                {plans.map(p => {
                                    const freqMap: any = { weekly: 'Semanal', monthly: 'Mensal', bimonthly: 'Bimestral', quarterly: 'Trimestral', semiannual: 'Semestral', annual: 'Anual' }
                                    const freq = freqMap[p.frequency || 'monthly'] || 'Mensal'
                                    return <option key={p.id} value={p.id}>{p.name} • R$ {p.price.toFixed(2)} ({freq})</option>
                                })}
                            </select>
                        </label>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                            <label className="label">
                                Início do Plano
                                <input 
                                    type="date" 
                                    className="input" 
                                    style={{ width: '100%' }}
                                    value={planStartDate} 
                                    onChange={(e) => setPlanStartDate(e.target.value)} 
                                />
                            </label>
                            <label className="label">
                                Dia Vencimento
                                <select 
                                    className="select" 
                                    style={{ width: '100%' }}
                                    value={dueDay} 
                                    onChange={(e) => setDueDay(e.target.value)}
                                >
                                    <option value="">Padrão</option>
                                    {[...Array(31)].map((_, i) => <option key={i+1} value={i+1}>{i+1}</option>)}
                                </select>
                            </label>
                        </div>
                    </div>
                </div>

                {/* ACESSO */}
                <div style={cardStyle}>
                    <div style={sectionTitleStyle}>🔑 Acesso</div>
                    <label className="label">
                        Senha provisória
                        <div style={{ display: 'flex', gap: 8 }}>
                            <input className="input" type={showPass ? 'text' : 'password'} value={tempPassword} onChange={(e) => setTempPassword(e.target.value)} placeholder="Opcional" />
                            <button type="button" className="btn" onClick={() => setShowPass(s => !s)}>{showPass ? '👁️' : '👁️'}</button>
                            <button type="button" className="btn" onClick={genPass}>Gerar</button>
                        </div>
                    </label>
                </div>
            </div>

            {/* COLUNA DIREITA: PROTOCOLOS */}
            <div style={columnStyle}>
                
                {/* TREINOS */}
                <div style={cardStyle}>
                    <div style={{ ...sectionTitleStyle, justifyContent: 'space-between' }}>
                        <span>💪 Treinos</span>
                        <button className="btn" onClick={handleExportWorkoutsPDF} title="Baixar todos os treinos em PDF" style={{ padding: '6px 12px', background: '#e0f2fe', color: '#0369a1', border: 'none', fontSize: '0.85em', display: 'flex', alignItems: 'center', gap: 6 }}>
                            📄 PDF
                        </button>
                    </div>
                    
                    <div style={{ background: '#f1f5f9', padding: 12, borderRadius: 8, marginBottom: 16, display: 'flex', gap: 8 }}>
                        <select className="select" style={{ fontSize: '0.9em' }} value={libraryWorkoutId} onChange={e => setLibraryWorkoutId(e.target.value)}>
                            <option value="">Adicionar modelo ou copiar de aluno...</option>
                            {workoutOptions.map(o => (
                                <option key={o.id} value={o.id}>{o.label}</option>
                            ))}
                        </select>
                        <button className="btn" onClick={handleAddWorkout} disabled={!libraryWorkoutId} style={{ background: '#0f172a', whiteSpace: 'nowrap' }}>+ Add</button>
                    </div>

                    {studentWorkouts.length === 0 ? (
                        <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', border: '2px dashed #e2e8f0', borderRadius: 8 }}>
                            Sem treinos ativos.
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gap: 12 }}>
                            {studentWorkouts.map(w => (
                                <div key={w.id} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                        <div style={{ fontWeight: 600, fontSize: '1.05em' }}>{w.name}</div>
                                        <div style={{ display: 'flex', gap: 6 }}>
                                            <button className="btn" style={{ padding: '4px 8px', fontSize: '0.8em' }} onClick={() => navigate(`/protocols/workouts/edit/${w.id}`)}>✎ Editar</button>
                                            <button className="btn" style={{ padding: '4px 8px', fontSize: '0.8em', background: '#fee2e2', color: '#dc2626' }} onClick={() => handleRemoveStudentWorkout(w.id)}>✕</button>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                        {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom'].map(day => {
                                            const isSelected = (workoutSchedule[w.id] || []).includes(day)
                                            return (
                                                <button 
                                                    key={day} 
                                                    onClick={() => toggleDay(w.id, day)}
                                                    style={{
                                                        padding: '2px 8px', fontSize: '0.75em', borderRadius: 12,
                                                        border: isSelected ? 'none' : '1px solid #e2e8f0',
                                                        background: isSelected ? '#3b82f6' : '#fff',
                                                        color: isSelected ? '#fff' : '#64748b',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    {day.substring(0, 3)}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* DIETAS */}
                <div style={cardStyle}>
                    <div style={{ ...sectionTitleStyle, justifyContent: 'space-between' }}>
                        <span>🥗 Dietas</span>
                    </div>

                    <div style={{ background: '#f1f5f9', padding: 12, borderRadius: 8, marginBottom: 16, display: 'flex', gap: 8 }}>
                        <select className="select" style={{ fontSize: '0.9em' }} value={libraryDietId} onChange={e => setLibraryDietId(e.target.value)}>
                            <option value="">Adicionar modelo ou copiar de aluno...</option>
                            {dietOptions.map(o => (
                                <option key={o.id} value={o.id}>{o.label}</option>
                            ))}
                        </select>
                        <button className="btn" onClick={handleAddDiet} disabled={!libraryDietId} style={{ background: '#0f172a', whiteSpace: 'nowrap' }}>+ Add</button>
                    </div>

                    {studentDiets.length === 0 ? (
                        <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', border: '2px dashed #e2e8f0', borderRadius: 8 }}>
                            Sem dietas ativas.
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gap: 12 }}>
                            {(studentDiets || []).map(d => (
                                <div key={d.id} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <div style={{ fontWeight: 600 }}>{d.name}</div>
                                        <div style={{ fontSize: '0.85em', color: '#64748b' }}>{d.goal || '—'}</div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        <button className="btn" style={{ padding: '4px 8px', fontSize: '0.8em', background: '#0f172a' }} onClick={() => handleExportDietPdf(d)}>PDF</button>
                                        <button className="btn" style={{ padding: '4px 8px', fontSize: '0.8em' }} onClick={() => navigate(`/protocols/diet-create?id=${d.id}&studentId=${selectedId}`)}>✎</button>
                                        <button className="btn" style={{ padding: '4px 8px', fontSize: '0.8em', background: '#fee2e2', color: '#dc2626' }} onClick={() => handleRemoveStudentDiet(d.id)}>✕</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* ANAMNESES */}
                <div style={cardStyle}>
                    <div style={{ ...sectionTitleStyle, justifyContent: 'space-between' }}>
                        <span>📋 Anamneses</span>
                        <button 
                            className="btn" 
                            onClick={() => navigate(`/students/evolution/${selectedId}`)}
                            title="Comparar fotos enviadas nas anamneses"
                            style={{ fontSize: '0.85rem', padding: '6px 12px', background: '#e0f2fe', color: '#0369a1', border: 'none', display: 'flex', gap: 6, alignItems: 'center' }}
                        >
                            <Camera size={16} /> Evolução Fotográfica
                        </button>
                    </div>
                    
                    <h4 style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: 8, marginTop: 0 }}>Modelos Ativos</h4>

                    <div style={{ background: '#f1f5f9', padding: 12, borderRadius: 8, marginBottom: 16, display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                        <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <span style={{ fontSize: '0.85em', fontWeight: 600, color: '#475569' }}>Modelo de Anamnese</span>
                            <select className="select" style={{ fontSize: '0.9em', width: '100%' }} value={selectedAnamnesisId} onChange={e => setSelectedAnamnesisId(e.target.value)}>
                                <option value="">Selecione...</option>
                                {libraryAnamnesis.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                            </select>
                        </label>
                        <label style={{ width: 100, display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <span style={{ fontSize: '0.85em', fontWeight: 600, color: '#475569' }}>Validade (dias)</span>
                            <input className="input" type="number" style={{ width: '100%', padding: '8px' }} value={validityDays} onChange={e => setValidityDays(e.target.value)} placeholder="90" />
                        </label>
                        <button className="btn" onClick={handleAddAnamnesis} disabled={!selectedAnamnesisId} style={{ background: '#0f172a', whiteSpace: 'nowrap', height: 38 }}>+ Add</button>
                    </div>

                    {studentAnamnesis.length === 0 ? (
                        <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', border: '2px dashed #e2e8f0', borderRadius: 8 }}>
                            Sem anamneses.
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gap: 12 }}>
                            {studentAnamnesis.map(a => {
                                const validDate = a.validUntil ? new Date(a.validUntil) : null
                                const isExpired = validDate && validDate < new Date()
                                return (
                                <div key={a.id} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <div style={{ fontWeight: 600 }}>{a.name}</div>
                                        <div style={{ fontSize: '0.8em', color: isExpired ? '#ef4444' : '#64748b' }}>
                                            {isExpired ? 'VENCIDA' : (validDate ? `Até ${validDate.toLocaleDateString()}` : 'Sem validade')}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        <button className="btn" style={{ padding: '4px 8px', fontSize: '0.8em' }} onClick={() => navigate(`/protocols/anamnesis/model/${a.id}`)}>✎</button>
                                        <button className="btn" style={{ padding: '4px 8px', fontSize: '0.8em', background: '#fee2e2', color: '#dc2626' }} onClick={() => handleRemoveAnamnesis(a.id)}>✕</button>
                                    </div>
                                </div>
                            )})}
                        </div>
                    )}

                    {answeredAnamnesis.length > 0 && (
                        <>
                            <div style={{ borderTop: '1px solid #e2e8f0', margin: '24px 0 16px 0' }}></div>
                            <h4 style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: 12 }}>Histórico de Respostas</h4>
                            <div style={{ display: 'grid', gap: 12 }}>
                                {answeredAnamnesis.map(a => (
                                    <div key={a.id} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
                                        <div>
                                            <div style={{ fontWeight: 600, color: '#334155' }}>{a.title}</div>
                                            <div style={{ fontSize: '0.8em', color: '#64748b' }}>
                                                Respondida em {new Date(a.created_at).toLocaleDateString()} às {new Date(a.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                            </div>
                                        </div>
                                        <button 
                                            className="btn" 
                                            style={{ padding: '6px 12px', fontSize: '0.85em', background: '#fff', border: '1px solid #cbd5e1', color: '#334155', display: 'flex', alignItems: 'center', gap: 6 }} 
                                            onClick={() => navigate(`/protocols/anamnesis/view/${a.id}`)}
                                        >
                                            👁️ Ver Respostas
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>

            </div>
        </div>
      )}

      {/* FOOTER FIXO */}
      {selectedId && (
        <div style={{ 
            position: 'fixed', bottom: 0, left: 0, right: 0, 
            background: '#fff', padding: '16px', borderTop: '1px solid #e2e8f0', 
            boxShadow: '0 -4px 6px -1px rgba(0,0,0,0.1)', 
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            zIndex: 100
        }}>
            <div style={{ color: '#059669', fontWeight: 600 }}>{msg}</div>
            <button className="btn" onClick={save} style={{ padding: '12px 32px', fontSize: '1.1em', background: 'var(--personal-primary)' }}>
                Salvar Alterações
            </button>
        </div>
      )}

      {/* Modal de Bloqueio Financeiro */}
      <Modal
        isOpen={blockModalOpen}
        onClose={() => setBlockModalOpen(false)}
        title="Alteração Bloqueada"
        type="danger"
        footer={
            <button className="btn" style={{ background: '#0f172a', color: '#fff' }} onClick={() => setBlockModalOpen(false)}>
                Entendido
            </button>
        }
      >
        <div style={{ textAlign: 'center', padding: 10 }}>
            <div style={{ fontSize: '3rem', marginBottom: 16 }}>🚫</div>
            <h3 style={{ color: '#1e293b', marginBottom: 8 }}>Pendências Financeiras</h3>
            <p style={{ color: '#64748b', fontSize: '1.05em' }}>
                O aluno possui mensalidades em atraso no plano atual.
            </p>
            <p style={{ color: '#64748b', fontSize: '0.95em' }}>
                Não é possível alterar o plano até que as pendências sejam regularizadas.
                Por favor, registre o pagamento no menu <strong>Financeiro</strong> antes de prosseguir.
            </p>
        </div>
      </Modal>

      {/* Modal Smart Link */}
      <Modal
        isOpen={!!smartLinkState}
        onClose={() => setSmartLinkState(null)}
        title="Vincular ou Copiar?"
        footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                <button className="btn" style={{ background: '#e2e8f0', color: '#1e293b' }} onClick={() => setSmartLinkState(null)}>Cancelar</button>
                <button className="btn" style={{ background: '#fff', color: '#0f172a', border: '1px solid #cbd5e1' }} onClick={() => handleSmartLinkAction('copy')}>Criar Cópia</button>
                <button className="btn" style={{ background: '#0f172a', color: '#fff' }} onClick={() => handleSmartLinkAction('link')}>Vincular (Mover)</button>
            </div>
        }
      >
        <div style={{ textAlign: 'center', padding: 10 }}>
            <div style={{ fontSize: '3rem', marginBottom: 16 }}>🔄</div>
            <h3 style={{ color: '#1e293b', marginBottom: 12 }}>Item encontrado na Biblioteca</h3>
            <p style={{ color: '#64748b', fontSize: '1.05em', marginBottom: 20 }}>
                O item <strong>"{smartLinkState?.itemName}"</strong> parece já pertencer ao aluno.
            </p>
            <div style={{ textAlign: 'left', background: '#f8fafc', padding: 16, borderRadius: 8, fontSize: '0.95em', color: '#475569' }}>
                <p style={{ margin: '0 0 10px 0' }}><strong>O que você deseja fazer?</strong></p>
                <ul style={{ paddingLeft: 20, margin: 0 }}>
                    <li style={{ marginBottom: 8 }}>
                        <strong>Vincular (Mover):</strong> Retira da biblioteca e atribui ao aluno.
                    </li>
                    <li>
                        <strong>Criar Cópia:</strong> Mantém o original na biblioteca e cria um novo para o aluno.
                    </li>
                </ul>
            </div>
        </div>
      </Modal>

      {/* Modal Genérico de Confirmação */}
      <Modal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        title={confirmModal.title}
        type={confirmModal.type}
        footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                <button className="btn" style={{ background: '#e2e8f0', color: '#1e293b' }} onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}>Cancelar</button>
                <button 
                    className="btn" 
                    style={{ background: confirmModal.type === 'danger' ? '#dc2626' : '#0f172a', color: '#fff' }} 
                    onClick={confirmModal.onConfirm}
                >
                    Confirmar
                </button>
            </div>
        }
      >
        <div style={{ padding: 10 }}>
            <p style={{ color: '#64748b', fontSize: '1.05em' }}>
                {confirmModal.message}
            </p>
        </div>
      </Modal>
    </div>
  )
}
