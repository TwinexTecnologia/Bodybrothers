export type ActiveTrainingSession = {
  id: string;
  studentId: string;
  workoutId: string;
  workoutTitle: string;
  startedAt: string;
  notificationId?: string;
  totalPausedSeconds: number;
  pauseStartedAt?: string | null;
  currentExerciseName?: string;
  currentExerciseTypeLabel?: string;
};

export function computeElapsedSeconds(
  session: Pick<
    ActiveTrainingSession,
    "startedAt" | "totalPausedSeconds" | "pauseStartedAt"
  >,
  nowMs: number,
): number {
  const startMs = new Date(session.startedAt).getTime();
  if (!Number.isFinite(startMs)) return 0;
  const totalPaused = session.totalPausedSeconds ?? 0;
  if (session.pauseStartedAt) {
    const p = new Date(session.pauseStartedAt).getTime();
    if (!Number.isFinite(p)) return 0;
    const raw = Math.floor((p - startMs) / 1000) - totalPaused;
    return raw > 0 ? raw : 0;
  }
  const raw = Math.floor((nowMs - startMs) / 1000) - totalPaused;
  return raw > 0 ? raw : 0;
}

export function formatElapsedTime(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0
    ? `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
    : `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}
