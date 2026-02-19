import { supabase } from '../lib/supabase'

export type WorkoutSession = {
  id: string
  studentId: string
  workoutId?: string
  workoutTitle: string
  startedAt: string
  finishedAt?: string
  durationSeconds?: number
  notes?: string
}

export async function startSession(workoutId: string, workoutTitle: string, studentId: string) {
    const { data, error } = await supabase
        .from('workout_history')
        .insert({
            student_id: studentId,
            workout_id: workoutId,
            workout_title: workoutTitle,
            started_at: new Date().toISOString()
        })
        .select()
        .single()
    
    if (error) throw error
    return mapFromDb(data)
}

export async function finishSession(id: string, durationSeconds: number, notes?: string) {
    const { data, error } = await supabase
        .from('workout_history')
        .update({
            finished_at: new Date().toISOString(),
            duration_seconds: durationSeconds,
            notes: notes
        })
        .eq('id', id)
        .select()
        .single()

    if (error) throw error

    // Notificar Personal APENAS SE TIVER FEEDBACK
    try {
        if (!notes || notes.trim().length === 0) {
            return mapFromDb(data)
        }

        console.log('Iniciando processo de notificação...')
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('personal_id, full_name')
            .eq('id', data.student_id)
            .single()

        if (profileError) {
            console.error('Erro ao buscar perfil do aluno para notificar:', profileError)
        }

        if (profile?.personal_id) {
            console.log('Enviando notificação para Personal ID:', profile.personal_id)
            const { error: notifError } = await supabase.from('notifications').insert({
                user_id: profile.personal_id,
                title: 'Novo Feedback de Treino',
                message: `${profile.full_name || 'Aluno'} finalizou "${data.workout_title}" com observações.`,
                type: 'feedback',
                // Link para o painel do personal (assumindo rota /students/history)
                // Ajuste a rota conforme seu frontend do personal
                link: `/students/details/${data.student_id}` 
            })

            if (notifError) {
                console.error('ERRO AO INSERIR NOTIFICAÇÃO:', notifError)
                // Possível erro: Tabela não existe ou RLS bloqueando
            } else {
                console.log('Notificação enviada com sucesso!')
            }
        } else {
            console.warn('Aluno não tem personal_id vinculado. Nenhuma notificação enviada.')
        }
    } catch (err) {
        console.error('Exceção ao notificar personal:', err)
        // Não trava o fluxo se falhar a notificação
    }

    return mapFromDb(data)
}

export async function getWeeklyFrequency(studentId: string): Promise<number> {
    const today = new Date()
    const firstDay = new Date(today.setDate(today.getDate() - today.getDay())).toISOString()

    // Conta treinos que foram INICIADOS nesta semana e já estão finalizados
    const { count, error } = await supabase
        .from('workout_history')
        .select('*', { count: 'exact', head: true })
        .eq('student_id', studentId)
        .gte('started_at', firstDay) // Mudança aqui: finished_at -> started_at
        .not('finished_at', 'is', null) // Garante que foi finalizado
    
    if (error) return 0
    return count || 0
}

export async function getWeeklyActivity(studentId: string): Promise<number[]> {
    // Retorna índices dos dias da semana (0=Dom, 1=Seg, etc.) que tiveram treino
    const today = new Date()
    // Começo da semana (Domingo)
    const firstDay = new Date(today)
    firstDay.setDate(today.getDate() - today.getDay())
    firstDay.setHours(0, 0, 0, 0)

    const { data, error } = await supabase
        .from('workout_history')
        .select('started_at, finished_at') // Busca started_at também
        .eq('student_id', studentId)
        .gte('started_at', firstDay.toISOString()) // Mudança aqui: finished_at -> started_at
        .not('finished_at', 'is', null) // Garante que foi finalizado
    
    if (error || !data) return []

    // Mapeia para dias da semana (0-6) usando a DATA DE INÍCIO
    const activeDays = data.map(row => {
        if (!row.started_at) return -1
        return new Date(row.started_at).getDay() // Mudança aqui: finished_at -> started_at
    }).filter(d => d >= 0)

    // Remove duplicatas
    return [...new Set(activeDays)]
}

function mapFromDb(d: any): WorkoutSession {
    return {
        id: d.id,
        studentId: d.student_id,
        workoutId: d.workout_id,
        workoutTitle: d.workout_title,
        startedAt: d.started_at,
        finishedAt: d.finished_at,
        durationSeconds: d.duration_seconds,
        notes: d.notes
    }
}
