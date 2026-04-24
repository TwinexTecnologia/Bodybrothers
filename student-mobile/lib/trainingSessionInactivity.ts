import {
  cancelTrainingInactiveAutoCloseNotification,
  scheduleTrainingInactiveAutoCloseNotification,
} from "./trainingNotifications";
import {
  getNextAutoCloseDeadlineIso,
  getNextAutoCloseDeadlineMs,
  type ActiveTrainingSession,
} from "./trainingSessionTypes";

export async function syncActiveSessionInactivity(
  session: ActiveTrainingSession,
): Promise<ActiveTrainingSession> {
  const now = Date.now();
  const inactiveAutoCloseAt = getNextAutoCloseDeadlineIso(session, now);
  const deadlineMs = getNextAutoCloseDeadlineMs(session, now);

  if (!inactiveAutoCloseAt || deadlineMs == null) {
    await cancelTrainingInactiveAutoCloseNotification(
      session.inactiveAutoCloseNotificationId,
      session.id,
    );
    return {
      ...session,
      inactiveAutoCloseAt: undefined,
      inactiveAutoCloseNotificationId: undefined,
    };
  }

  if (deadlineMs <= Date.now()) {
    await cancelTrainingInactiveAutoCloseNotification(
      session.inactiveAutoCloseNotificationId,
      session.id,
    );
    return {
      ...session,
      inactiveAutoCloseAt,
      inactiveAutoCloseNotificationId: undefined,
    };
  }

  const inactiveAutoCloseNotificationId =
    await scheduleTrainingInactiveAutoCloseNotification({
      workoutTitle: session.workoutTitle,
      triggerAt: new Date(deadlineMs),
      sessionId: session.id,
    });

  return {
    ...session,
    inactiveAutoCloseAt,
    inactiveAutoCloseNotificationId,
  };
}

export async function clearActiveSessionInactivity(
  session?: Pick<
    ActiveTrainingSession,
    "id" | "inactiveAutoCloseNotificationId"
  > | null,
): Promise<void> {
  if (!session) return;
  await cancelTrainingInactiveAutoCloseNotification(
    session.inactiveAutoCloseNotificationId,
    session.id,
  );
}
