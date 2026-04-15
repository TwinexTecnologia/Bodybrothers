import { finishSession } from "./history";
import {
  dismissTrainingNotification,
  showTrainingInactiveAutoClosedNotification,
} from "./trainingNotifications";
import { saveActiveSession } from "./trainingSessionStorage";
import {
  computeElapsedSeconds,
  type ActiveTrainingSession,
} from "./trainingSessionTypes";

export type PersistFinishActiveSessionOptions = {
  showInactiveAutoClosedNotification?: boolean;
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
  await saveActiveSession(null);
  await dismissTrainingNotification(session.notificationId);
  if (options.showInactiveAutoClosedNotification) {
    await showTrainingInactiveAutoClosedNotification(session.workoutTitle);
  }
}
