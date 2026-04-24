import { finishSession } from "./history";
import {
  dismissTrainingNotification,
  showTrainingInactiveAutoClosedNotification,
  showTrainingMaxActiveTimeAutoClosedNotification,
} from "./trainingNotifications";
import { clearActiveSessionInactivity } from "./trainingSessionInactivity";
import { saveActiveSession } from "./trainingSessionStorage";
import {
  computeElapsedSeconds,
  type AutoCloseReason,
  type ActiveTrainingSession,
} from "./trainingSessionTypes";

export type PersistFinishActiveSessionOptions = {
  showInactiveAutoClosedNotification?: boolean;
  autoClose?: AutoCloseReason;
};

/**
 * Persiste finalização no servidor, limpa sessão local e notificação contínua.
 * Igual ao fluxo de "Finalizar" / ação da notificação; opcionalmente avisa inatividade.
 */
export async function persistFinishActiveSession(
  session: ActiveTrainingSession,
  options: PersistFinishActiveSessionOptions = {},
): Promise<void> {
  const elapsed = computeElapsedSeconds(session, Date.now());
  try {
    await finishSession(session.id, elapsed, "");
  } catch {
    /* sessão já finalizada ou rede — ainda limpamos local para não travar o app */
  }
  await clearActiveSessionInactivity(session);
  await saveActiveSession(null);
  await dismissTrainingNotification(session.notificationId);
  if (options.autoClose === "max_active_time") {
    await showTrainingMaxActiveTimeAutoClosedNotification(session.workoutTitle);
  } else if (options.autoClose === "inactivity" || options.showInactiveAutoClosedNotification) {
    await showTrainingInactiveAutoClosedNotification(session.workoutTitle);
  }
}
