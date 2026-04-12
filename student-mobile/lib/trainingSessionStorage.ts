import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ActiveTrainingSession } from "./trainingSessionTypes";

export const ACTIVE_SESSION_STORAGE_KEY = "@fitbody:active_training_session_v2";
const LEGACY_STORAGE_KEY = "@fitbody:active_training_session_v1";

function safeParseV2(raw: string | null): ActiveTrainingSession | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (
      typeof parsed.id !== "string" ||
      typeof parsed.studentId !== "string" ||
      typeof parsed.workoutId !== "string" ||
      typeof parsed.workoutTitle !== "string" ||
      typeof parsed.startedAt !== "string"
    ) {
      return null;
    }
    return {
      ...parsed,
      totalPausedSeconds:
        typeof parsed.totalPausedSeconds === "number"
          ? parsed.totalPausedSeconds
          : 0,
      pauseStartedAt:
        parsed.pauseStartedAt === null ||
        parsed.pauseStartedAt === undefined
          ? null
          : typeof parsed.pauseStartedAt === "string"
            ? parsed.pauseStartedAt
            : null,
      currentExerciseName:
        typeof parsed.currentExerciseName === "string"
          ? parsed.currentExerciseName
          : undefined,
      currentExerciseTypeLabel:
        typeof parsed.currentExerciseTypeLabel === "string"
          ? parsed.currentExerciseTypeLabel
          : undefined,
      notificationId:
        typeof parsed.notificationId === "string"
          ? parsed.notificationId
          : undefined,
      lastInteractionAt:
        typeof parsed.lastInteractionAt === "string"
          ? parsed.lastInteractionAt
          : typeof parsed.startedAt === "string"
            ? parsed.startedAt
            : new Date().toISOString(),
    } as ActiveTrainingSession;
  } catch {
    return null;
  }
}

function safeParseLegacy(raw: string | null): ActiveTrainingSession | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (
      typeof parsed.id !== "string" ||
      typeof parsed.studentId !== "string" ||
      typeof parsed.workoutId !== "string" ||
      typeof parsed.workoutTitle !== "string" ||
      typeof parsed.startedAt !== "string"
    ) {
      return null;
    }
    return {
      ...parsed,
      totalPausedSeconds: 0,
      pauseStartedAt: null,
      lastInteractionAt: parsed.startedAt,
    } as ActiveTrainingSession;
  } catch {
    return null;
  }
}

export async function loadActiveSession(): Promise<ActiveTrainingSession | null> {
  const v2 = await AsyncStorage.getItem(ACTIVE_SESSION_STORAGE_KEY);
  const parsed = safeParseV2(v2);
  if (parsed) return parsed;

  const legacy = await AsyncStorage.getItem(LEGACY_STORAGE_KEY);
  const migrated = safeParseLegacy(legacy);
  if (migrated) {
    await AsyncStorage.setItem(
      ACTIVE_SESSION_STORAGE_KEY,
      JSON.stringify(migrated),
    );
    await AsyncStorage.removeItem(LEGACY_STORAGE_KEY);
    return migrated;
  }
  return null;
}

export async function saveActiveSession(
  session: ActiveTrainingSession | null,
): Promise<void> {
  if (!session) {
    await AsyncStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
    await AsyncStorage.removeItem(LEGACY_STORAGE_KEY);
    return;
  }
  await AsyncStorage.setItem(
    ACTIVE_SESSION_STORAGE_KEY,
    JSON.stringify(session),
  );
}
