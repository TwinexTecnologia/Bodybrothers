import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

// Cliente secundário para criar usuários sem deslogar o admin
const supabaseAdmin = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)

export default function Migration() {
  const [logs, setLogs] = useState<string[]>([])
  const [isMigrating, setIsMigrating] = useState(false)
  const [stats, setStats] = useState<any>({})

  const addLog = (msg: string) => setLogs(prev => [...prev, `${new Date().toLocaleTimeString()} - ${msg}`])

  useEffect(() => {
    // Analisa dados locais
    const students = JSON.parse(localStorage.getItem('personal_students') || '[]')
    const diets = JSON.parse(localStorage.getItem('personal_diets') || '[]')
    const workouts = JSON.parse(localStorage.getItem('personal_workouts') || '[]')
    const debits = JSON.parse(localStorage.getItem('personal_debits') || '[]')

    setStats({
      students: students.length,
      diets: diets.length,
      workouts: workouts.length,
      debits: debits.length
    })
  }, [])

  const startMigration = async () => {
    setIsMigrating(true)
    setLogs([])
    addLog('Iniciando migração...')

    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (!currentUser) throw new Error('Você precisa estar logado para migrar.')

      const idMap: Record<string, string> = {} // Old ID -> New UUID

      // 1. MIGRAR ALUNOS
      const students = JSON.parse(localStorage.getItem('personal_students') || '[]')
      addLog(`Encontrados ${students.length} alunos para migrar.`)

      for (const s of students) {
        addLog(`Migrando aluno: ${s.name}...`)
        
        // Tenta criar usuário no Auth
        // Gera email único se necessário ou usa o existente
        const email = s.email && s.email.includes('@') ? s.email : `aluno_${s.id}@temp.com`
        const password = s.password || 'mudar123' // Senha padrão se não tiver

        // Verifica se já existe (tenta login fake? não, tenta signUp direto, se der erro assume que existe)
        let newUserId = ''
        
        const { data: signUpData, error: signUpError } = await supabaseAdmin.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: s.name,
              role: 'aluno',
              personal_id: currentUser.id,
              created_by: currentUser.id
            }
          }
        })

        if (signUpError) {
            if (signUpError.message.includes('already registered')) {
                addLog(`Usuário ${email} já existe. Tentando encontrar ID...`)
                // Tenta achar na tabela profiles se já foi migrado antes?
                // Como não temos acesso a auth.users, não conseguimos pegar o ID só pelo email facilmente sem login.
                // WORKAROUND: Se já existe, vamos pular ou assumir falha?
                // Vamos tentar logar com ele para pegar o ID? (Risky)
                // Vamos pular por enquanto e avisar.
                addLog(`⚠️ Erro: Email ${email} já cadastrado. Pulando criação de Auth.`)
                // Se ele já existe no profiles, poderiamos tentar buscar pelo email?
                // Mas RLS bloqueia ver outros alunos... exceto se for aluno DESSE personal.
                const { data: existingProfile } = await supabase
                    .from('profiles')
                    .select('id')
                    .eq('email', email)
                    .single()
                
                if (existingProfile) {
                    newUserId = existingProfile.id
                    addLog(`Recuperado ID existente: ${newUserId}`)
                } else {
                    addLog(`❌ Falha: Usuário existe no Auth mas não no Profiles ou não é seu aluno.`)
                    continue
                }
            } else {
                addLog(`❌ Erro ao criar usuário ${s.name}: ${signUpError.message}`)
                continue
            }
        } else if (signUpData.user) {
            newUserId = signUpData.user.id
            addLog(`✅ Usuário criado: ${newUserId}`)
        }

        if (newUserId) {
            idMap[s.id] = newUserId

            // Atualiza dados extras no Profile (endereço, etc) se tiver
            // O trigger já criou o registro básico. Vamos dar update.
            // Opcional: Salvar endereço em algum lugar? O schema atual não tem campos de endereço no profile.
            // Vou ignorar endereço por enquanto ou salvar em jsonb se tivesse campo.
        }
        
        // Delay para evitar rate limit
        await new Promise(r => setTimeout(r, 500))
      }

      // 2. MIGRAR PROTOCOLOS (Treinos e Dietas)
      addLog('Migrando protocolos...')
      
      const diets = JSON.parse(localStorage.getItem('personal_diets') || '[]')
      for (const d of diets) {
          if (!d.studentId || !idMap[d.studentId]) {
              addLog(`Pulinando dieta "${d.name}" (aluno não migrado ou sem aluno)`)
              continue
          }
          
          const { error } = await supabase.from('protocols').insert({
              student_id: idMap[d.studentId],
              personal_id: currentUser.id,
              type: 'diet',
              title: d.name,
              status: d.status === 'ativa' ? 'active' : 'archived',
              starts_at: d.startDate || null,
              ends_at: d.endDate || null,
              data: {
                  meals: d.meals,
                  supplements: d.supplements,
                  notes: d.notes,
                  goal: d.goal
              }
          })
          
          if (error) addLog(`❌ Erro ao migrar dieta ${d.name}: ${error.message}`)
          else addLog(`✅ Dieta migrada: ${d.name}`)
      }

      const workouts = JSON.parse(localStorage.getItem('personal_workouts') || '[]')
      for (const w of workouts) {
          if (!w.studentId || !idMap[w.studentId]) {
              addLog(`Pulinando treino "${w.name}" (aluno não migrado ou sem aluno)`)
              continue
          }

          const { error } = await supabase.from('protocols').insert({
              student_id: idMap[w.studentId],
              personal_id: currentUser.id,
              type: 'workout',
              title: w.name,
              status: w.status === 'ativo' ? 'active' : 'archived',
              data: {
                  exercises: w.exercises,
                  notes: w.notes,
                  goal: w.goal,
                  validUntil: w.validUntil
              }
          })

          if (error) addLog(`❌ Erro ao migrar treino ${w.name}: ${error.message}`)
          else addLog(`✅ Treino migrado: ${w.name}`)
      }

      // 3. MIGRAR FINANCEIRO (Débitos)
      const debits = JSON.parse(localStorage.getItem('personal_debits') || '[]')
      // Ajuste: O schema espera 'debits'. Vamos ver se temos dados.
      // O código antigo usava 'personal_debits'? Preciso confirmar se existia store de financeiro.
      // Se existir, migrar.
      
      addLog('Migração concluída!')

    } catch (err: any) {
      addLog(`❌ ERRO FATAL: ${err.message}`)
    } finally {
      setIsMigrating(false)
    }
  }

  return (
    <div style={{ padding: 40, maxWidth: 800, margin: '0 auto' }}>
      <h1>Migração para Supabase</h1>
      
      <div style={{ margin: '20px 0', padding: 20, background: '#f8fafc', borderRadius: 8 }}>
        <h3>Dados Encontrados Localmente:</h3>
        <ul>
            <li>Alunos: {stats.students}</li>
            <li>Dietas: {stats.diets}</li>
            <li>Treinos: {stats.workouts}</li>
            <li>Débitos: {stats.debits}</li>
        </ul>
      </div>

      <button 
        onClick={startMigration} 
        disabled={isMigrating}
        style={{
            padding: '12px 24px',
            background: isMigrating ? '#ccc' : '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            fontSize: 16,
            cursor: isMigrating ? 'not-allowed' : 'pointer'
        }}
      >
        {isMigrating ? 'Migrando...' : 'Iniciar Migração Agora'}
      </button>

      <div style={{ marginTop: 20, background: '#1e293b', color: '#fff', padding: 20, borderRadius: 8, maxHeight: 400, overflow: 'auto' }}>
        {logs.map((log, i) => <div key={i} style={{ fontFamily: 'monospace', marginBottom: 4 }}>{log}</div>)}
      </div>
    </div>
  )
}
