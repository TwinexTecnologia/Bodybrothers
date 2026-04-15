import * as Notifications from "expo-notifications";
import { persistFinishActiveSession } from "./activeSessionFinish";
import { cancelSession } from "./history";
import {
  ACTION_CANCEL,
  ACTION_FINISH,
  ACTION_PAUSE,
  ACTION_RESUME,
} from "./trainingNotificationConstants";
import { dismissTrainingNotification } from "./trainingNotifications";
import { loadActiveSession, saveActiveSession } from "./trainingSessionStorage";
import { type ActiveTrainingSession } from "./trainingSessionTypes";

export async function handleTrainingNotificationResponse(
  response: Notifications.NotificationResponse,
): Promise<void> {
  const action = response.actionIdentifier;
  if (action === Notifications.DEFAULT_ACTION_IDENTIFIER) return;

  const session = await loadActiveSession();
  if (!session) return;

  const data = response.notification.request.content
    .data as Record<string, unknown> | undefined;
  const sid = data?.sessionId;
  if (typeof sid === "string" && sid !== session.id) return;

  if (action === ACTION_PAUSE) {
    await applyPause(session);
    return;
  }
  if (action === ACTION_RESUME) {
    await applyResume(session);
    return;
  }
  if (action === ACTION_CANCEL) {
    await applyCancel(session);
    return;
  }
  if (action === ACTION_FINISH) {
    await applyFinish(session);
  }
}

async function applyPause(session: ActiveTrainingSession) {
  if (session.pauseStartedAt) return;
  const now = new Date().toISOString();
  await saveActiveSession({
    ...session,
    pauseStartedAt: now,
    lastInteractionAt: now,
  });
}

async function applyResume(session: ActiveTrainingSession) {
  if (!session.pauseStartedAt) return;
  const p = new Date(session.pauseStartedAt).getTime();
  const add = Math.max(0, Math.floor((Date.now() - p) / 1000));
  const now = new Date().toISOString();
  await saveActiveSession({
    ...session,
    pauseStartedAt: null,
    totalPausedSeconds: (session.totalPausedSeconds ?? 0) + add,
    lastInteractionAt: now,
  });
}

async function applyCancel(session: ActiveTrainingSession) {
  try {
    await cancelSession(session.id);
  } catch {
    return;
  }
  await saveActiveSession(null);
  await dismissTrainingNotification(session.notificationId);
}

async function applyFinish(session: ActiveTrainingSession) {
  await persistFinishActiveSession(session);
}
