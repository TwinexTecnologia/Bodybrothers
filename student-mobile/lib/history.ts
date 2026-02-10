import { supabase } from './supabase';

export type WorkoutSession = {
  id: string;
  studentId: string;
  workoutId?: string;
  workoutTitle: string;
  startedAt: string;
  finishedAt?: string;
  durationSeconds?: number;
  notes?: string;
};

export async function startSession(workoutId: string, workoutTitle: string, studentId: string) {
  const { data, error } = await supabase
    .from('workout_history')
    .insert({
      student_id: studentId,
      workout_id: workoutId,
      workout_title: workoutTitle,
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return mapFromDb(data);
}

export async function finishSession(id: string, durationSeconds: number, notes?: string) {
  const { data, error } = await supabase
    .from('workout_history')
    .update({
      finished_at: new Date().toISOString(),
      duration_seconds: durationSeconds,
      notes: notes,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  // Notificação para o Personal (Sem await para não travar a UI)
  supabase
    .from('profiles')
    .select('personal_id, full_name')
    .eq('id', data.student_id)
    .single()
    .then(({ data: profile }) => {
        if (profile?.personal_id) {
            supabase.from('notifications').insert({
                user_id: profile.personal_id,
                title: 'Treino Concluído',
                message: `${profile.full_name || 'Aluno'} finalizou "${data.workout_title}"`,
                type: 'feedback',
                link: `/students/details/${data.student_id}`,
            }).then(() => console.log('Notificação enviada'))
              .catch(err => console.warn('Erro notificação:', err));
        }
    })
    .catch(err => console.warn('Erro profile notificação:', err));

  return mapFromDb(data);
}

export async function getWeeklyFrequency(studentId: string): Promise<number> {
  const today = new Date();
  const firstDay = new Date(today.setDate(today.getDate() - today.getDay())).toISOString();

  const { count, error } = await supabase
    .from('workout_history')
    .select('*', { count: 'exact', head: true })
    .eq('student_id', studentId)
    .gte('started_at', firstDay)
    .not('finished_at', 'is', null);

  if (error) return 0;
  return count || 0;
}

export async function getWeeklyActivity(studentId: string): Promise<number[]> {
  const today = new Date();
  const firstDay = new Date(today);
  firstDay.setDate(today.getDate() - today.getDay());
  firstDay.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from('workout_history')
    .select('started_at')
    .eq('student_id', studentId)
    .gte('started_at', firstDay.toISOString())
    .not('finished_at', 'is', null);

  if (error || !data) return [];

  const activeDays = data
    .map((row) => {
      if (!row.started_at) return -1;
      return new Date(row.started_at).getDay();
    })
    .filter((d) => d >= 0);

  return [...new Set(activeDays)];
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
    notes: d.notes,
  };
}
