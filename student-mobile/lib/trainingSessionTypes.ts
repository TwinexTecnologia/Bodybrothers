/** 4h — treino sem interação (pausar, retomar, trocar exercício) é encerrado automaticamente. */
export const TRAINING_INACTIVITY_THRESHOLD_MS = 4 * 60 * 60 * 1000;

/** 4h de tempo do cronómetro "em execução" (sem contar a pausa atual); encerra o treino automaticamente. */
export const TRAINING_MAX_ACTIVE_SESSION_SECONDS = 4 * 60 * 60;

export type ActiveTrainingSession = {
  id: string;
  studentId: string;
  workoutId: string;
  workoutTitle: string;
  startedAt: string;
  /** ISO — última ação explícita no treino; inatividade medida a partir daqui. */
  lastInteractionAt: string;
  /** ISO — deadline atual de autoencerramento por inatividade. */
  inactiveAutoCloseAt?: string;
  /** ID da notificação local agendada para o autoencerramento. */
  inactiveAutoCloseNotificationId?: string;
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

export function isInactiveBeyondThreshold(
  session: Pick<ActiveTrainingSession, "lastInteractionAt">,
  nowMs: number,
): boolean {
  const deadlineMs = getTrainingInactivityDeadlineMs(session);
  if (deadlineMs == null) return false;
  return nowMs >= deadlineMs;
}

export function getTrainingInactivityDeadlineMs(
  session: Pick<ActiveTrainingSession, "lastInteractionAt">,
): number | null {
  if (!session.lastInteractionAt) return null;
  const t = new Date(session.lastInteractionAt).getTime();
  if (!Number.isFinite(t)) return null;
  return t + TRAINING_INACTIVITY_THRESHOLD_MS;
}

export function getTrainingInactivityDeadlineIso(
  session: Pick<ActiveTrainingSession, "lastInteractionAt">,
): string | undefined {
  const deadlineMs = getTrainingInactivityDeadlineMs(session);
  if (deadlineMs == null) return undefined;
  return new Date(deadlineMs).toISOString();
}

export function isActiveSessionTimeLimitExceeded(
  session: ActiveTrainingSession,
  nowMs: number,
): boolean {
  if (session.pauseStartedAt) return false;
  return (
    computeElapsedSeconds(session, nowMs) >= TRAINING_MAX_ACTIVE_SESSION_SECONDS
  );
}

export type AutoCloseReason = "inactivity" | "max_active_time";

export function shouldAutoCloseTrainingSession(
  session: ActiveTrainingSession,
  nowMs: number,
): false | { reason: AutoCloseReason } {
  if (isInactiveBeyondThreshold(session, nowMs)) {
    return { reason: "inactivity" };
  }
  if (isActiveSessionTimeLimitExceeded(session, nowMs)) {
    return { reason: "max_active_time" };
  }
  return false;
}

/** Próximo instante (wall clock) em que um dos limites (inatividade ou 4h de execução) exige fechamento. */
export function getNextAutoCloseDeadlineMs(
  session: ActiveTrainingSession,
  nowMs: number,
): number | null {
  const dInact = getTrainingInactivityDeadlineMs(session);
  let dMax: number | null = null;
  if (!session.pauseStartedAt) {
    const elapsed = computeElapsedSeconds(session, nowMs);
    if (elapsed >= TRAINING_MAX_ACTIVE_SESSION_SECONDS) {
      dMax = nowMs;
    } else {
      dMax = nowMs + (TRAINING_MAX_ACTIVE_SESSION_SECONDS - elapsed) * 1000;
    }
  }
  const parts = [dInact, dMax].filter(
    (d): d is number => d != null && Number.isFinite(d),
  );
  if (parts.length === 0) return null;
  return Math.min(...parts);
}

export function getNextAutoCloseDeadlineIso(
  session: ActiveTrainingSession,
  nowMs: number,
): string | undefined {
  const d = getNextAutoCloseDeadlineMs(session, nowMs);
  if (d == null) return undefined;
  return new Date(d).toISOString();
}

export function formatElapsedTime(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0
    ? `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
    : `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}
