export type StartWorkoutBlockReason = "already_trained_today" | "active_session";

export function getStartWorkoutBlockReason(params: {
  activeDays: number[];
  todayIndex: number;
  hasActiveSession: boolean;
}): StartWorkoutBlockReason | null {
  if (params.activeDays.includes(params.todayIndex)) return "already_trained_today";
  if (params.hasActiveSession) return "active_session";
  return null;
}

