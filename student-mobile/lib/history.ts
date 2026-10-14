import { supabase } from "./supabase";

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

export type WorkoutSetLog = {
  workoutHistoryId: string;
  studentId: string;
  workoutId?: string;
  exerciseIndex: number;
  exerciseName: string;
  exerciseGroup?: string;
  setIndex: number;
  setType: string;
  setLabel: string;
  targetReps?: string;
  prescribedLoad?: string;
  performedReps?: number | null;
  load?: number | null;
  completed: boolean;
  performedAt?: string;
};

export type LatestExerciseSetLog = {
  load?: number | null;
  performedReps?: number | null;
  performedAt?: string;
};

export type LatestExerciseLogMap = Record<
  string,
  Record<number, LatestExerciseSetLog>
>;

export async function startSession(
  workoutId: string,
  workoutTitle: string,
  studentId: string,
) {
  const { data, error } = await supabase
    .from("workout_history")
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

export async function finishSession(
  id: string,
  durationSeconds: number,
  notes?: string,
) {
  const { data, error } = await supabase
    .from("workout_history")
    .update({
      finished_at: new Date().toISOString(),
      duration_seconds: durationSeconds,
      notes: notes,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;

  (async () => {
    try {
      if (!notes || notes.trim().length === 0) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("personal_id, full_name")
        .eq("id", data.student_id)
        .single();

      if (!profile?.personal_id) return;

      await supabase.from("notifications").insert({
        user_id: profile.personal_id,
        title: "Treino Concluído",
        message: `${profile.full_name || "Aluno"} finalizou "${data.workout_title}". Feedback: "${notes}"`,
        type: "feedback",
        link: `/students/details/${data.student_id}`,
      });
    } catch (err) {
      console.warn("Erro notificação:", err);
    }
  })();

  return mapFromDb(data);
}

export async function cancelSession(id: string) {
  const { data, error } = await supabase
    .from("workout_history")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) throw error;
  if (!data?.length) {
    throw new Error("Não foi possível cancelar esse treino.");
  }
}

export async function getSessionById(id: string): Promise<WorkoutSession> {
  const { data, error } = await supabase
    .from("workout_history")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) throw error || new Error("Sessão não encontrada");
  return mapFromDb(data);
}

export async function getWeeklyFrequency(studentId: string): Promise<number> {
  const today = new Date();
  const firstDay = new Date(
    today.setDate(today.getDate() - today.getDay()),
  ).toISOString();

  const { count, error } = await supabase
    .from("workout_history")
    .select("*", { count: "exact", head: true })
    .eq("student_id", studentId)
    .gte("started_at", firstDay)
    .not("finished_at", "is", null);

  if (error) return 0;
  return count || 0;
}

export async function getWeeklyActivity(studentId: string): Promise<number[]> {
  const today = new Date();
  const firstDay = new Date(today);
  firstDay.setDate(today.getDate() - today.getDay());
  firstDay.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("workout_history")
    .select("started_at")
    .eq("student_id", studentId)
    .gte("started_at", firstDay.toISOString())
    .not("finished_at", "is", null);

  if (error || !data) return [];

  const activeDays = data
    .map((row) => {
      if (!row.started_at) return -1;
      return new Date(row.started_at).getDay();
    })
    .filter((d) => d >= 0);

  return [...new Set(activeDays)];
}

export async function getTrainingIsFinished(
  studentId: string,
  workoutId: string,
): Promise<boolean> {
  const today = new Date();
  const firstDay = new Date(today);
  firstDay.setDate(today.getDate() - today.getDay());
  firstDay.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("workout_history")
    .select("*")
    .eq("student_id", studentId)
    .eq("workout_id", workoutId)
    .gte("started_at", firstDay.toISOString())
    .not("finished_at", "is", null)
    .limit(1);

  if (error || !data) return false;

  return data.length > 0;
}

export async function getActiveSession(
  studentId: string,
): Promise<WorkoutSession | null> {
  const { data, error } = await supabase
    .from("workout_history")
    .select("*")
    .eq("student_id", studentId)
    .is("finished_at", null)
    .order("started_at", { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) return null;
  return mapFromDb(data[0]);
}

export async function saveSessionExerciseLogs(logs: WorkoutSetLog[]) {
  if (!logs.length) return;

  const payload = logs.map((log) => ({
    workout_history_id: log.workoutHistoryId,
    student_id: log.studentId,
    workout_id: log.workoutId || null,
    exercise_index: log.exerciseIndex,
    exercise_name: log.exerciseName,
    exercise_group: log.exerciseGroup || null,
    set_index: log.setIndex,
    set_type: log.setType,
    set_label: log.setLabel,
    target_reps: log.targetReps || null,
    prescribed_load: log.prescribedLoad || null,
    performed_reps: log.performedReps ?? null,
    load: log.load ?? null,
    completed: log.completed,
    performed_at: log.performedAt || new Date().toISOString(),
  }));

  const { error } = await supabase.from("workout_history_exercise_logs").upsert(
    payload,
    {
      onConflict: "workout_history_id,exercise_index,set_index",
    },
  );

  if (error) throw error;
}

export async function getSessionExerciseLogs(
  sessionId: string,
): Promise<WorkoutSetLog[]> {
  const { data, error } = await supabase
    .from("workout_history_exercise_logs")
    .select("*")
    .eq("workout_history_id", sessionId)
    .order("exercise_index", { ascending: true })
    .order("set_index", { ascending: true });

  if (error) {
    console.warn("Erro ao carregar logs da sessão atual:", error);
    return [];
  }

  return (data || []).map((row: any) => ({
    workoutHistoryId: row.workout_history_id,
    studentId: row.student_id,
    workoutId: row.workout_id,
    exerciseIndex: row.exercise_index,
    exerciseName: row.exercise_name,
    exerciseGroup: row.exercise_group,
    setIndex: row.set_index,
    setType: row.set_type,
    setLabel: row.set_label,
    targetReps: row.target_reps,
    prescribedLoad: row.prescribed_load,
    performedReps: row.performed_reps,
    load: row.load,
    completed: row.completed,
    performedAt: row.performed_at,
  }));
}

export async function getLatestExerciseLogs(
  studentId: string,
  exerciseNames: string[],
): Promise<LatestExerciseLogMap> {
  const names = [...new Set(exerciseNames.map((name) => name.trim()).filter(Boolean))];
  if (!names.length) return {};

  const { data, error } = await supabase
    .from("workout_history_exercise_logs")
    .select("exercise_name, set_index, load, performed_reps, performed_at")
    .eq("student_id", studentId)
    .in("exercise_name", names)
    .eq("completed", true)
    .order("performed_at", { ascending: false });

  if (error) {
    console.warn("Erro ao buscar último histórico por exercício:", error);
    return {};
  }

  const latestMap: LatestExerciseLogMap = {};

  for (const row of data || []) {
    const exerciseName = String(row.exercise_name || "").trim();
    if (!exerciseName) continue;

    if (!latestMap[exerciseName]) {
      latestMap[exerciseName] = {};
    }

    if (latestMap[exerciseName][row.set_index] !== undefined) continue;

    latestMap[exerciseName][row.set_index] = {
      load: row.load,
      performedReps: row.performed_reps,
      performedAt: row.performed_at,
    };
  }

  return latestMap;
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
