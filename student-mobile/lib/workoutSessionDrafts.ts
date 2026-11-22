import AsyncStorage from "@react-native-async-storage/async-storage";

export type SessionSetDraft = {
  load: string;
  performedReps: string;
  completed: boolean;
  lastLoad?: string;
};

const WORKOUT_SESSION_DRAFT_PREFIX = "@fitbody:workout_session_drafts:";

function getDraftStorageKey(sessionId: string) {
  return `${WORKOUT_SESSION_DRAFT_PREFIX}${sessionId}`;
}

export async function loadWorkoutSessionDrafts(
  sessionId: string,
): Promise<Record<string, SessionSetDraft>> {
  try {
    const raw = await AsyncStorage.getItem(getDraftStorageKey(sessionId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export async function saveWorkoutSessionDrafts(
  sessionId: string,
  drafts: Record<string, SessionSetDraft>,
): Promise<void> {
  try {
    await AsyncStorage.setItem(getDraftStorageKey(sessionId), JSON.stringify(drafts));
  } catch {}
}

export async function clearWorkoutSessionDrafts(sessionId?: string): Promise<void> {
  if (!sessionId) return;
  try {
    await AsyncStorage.removeItem(getDraftStorageKey(sessionId));
  } catch {}
}
