import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import {
  ACTION_CANCEL,
  ACTION_FINISH,
  ACTION_PAUSE,
  ACTION_RESUME,
  CHANNEL_ACTIVE,
  CHANNEL_FINISHED,
  CHANNEL_PAUSED,
  NOTIFICATION_COLOR_ACTIVE,
  NOTIFICATION_COLOR_FINISHED,
  NOTIFICATION_COLOR_PAUSED,
  ONGOING_TRAINING_NOTIFICATION_ID,
  SOUND_ACTIVE,
  SOUND_PAUSED,
  TRAINING_CATEGORY_ACTIVE,
  TRAINING_CATEGORY_PAUSED,
} from "./trainingNotificationConstants";
import { formatElapsedTime } from "./trainingSessionTypes";

export type TrainingNotificationState = "active" | "paused";

export type TrainingNotificationInput = {
  workoutTitle: string;
  elapsedSeconds: number;
  exerciseName?: string;
  exerciseTypeLabel?: string;
  state: TrainingNotificationState;
  sessionId: string;
};

let setupPromise: Promise<void> | null = null;

export function ensureTrainingNotificationSetup(): Promise<void> {
  if (Platform.OS === "web") return Promise.resolve();
  if (!setupPromise) {
    setupPromise = (async () => {
      await ensureAndroidChannels();
      await ensureNotificationCategories();
    })();
  }
  return setupPromise;
}

async function ensureAndroidChannels() {
  if (Platform.OS !== "android") return;

  await Notifications.setNotificationChannelAsync(CHANNEL_ACTIVE, {
    name: "Treino ativo",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 120, 250],
    sound: SOUND_ACTIVE,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    enableLights: true,
    enableVibrate: true,
  });

  await Notifications.setNotificationChannelAsync(CHANNEL_PAUSED, {
    name: "Treino pausado",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 120],
    sound: SOUND_PAUSED,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    enableLights: true,
    enableVibrate: true,
  });

  await Notifications.setNotificationChannelAsync(CHANNEL_FINISHED, {
    name: "Treino finalizado",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 200],
    sound: "default",
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    enableVibrate: true,
  });
}

async function ensureNotificationCategories() {
  await Notifications.setNotificationCategoryAsync(TRAINING_CATEGORY_ACTIVE, [
    {
      identifier: ACTION_FINISH,
      buttonTitle: "Finalizar",
      options: { opensAppToForeground: true },
    },
    {
      identifier: ACTION_PAUSE,
      buttonTitle: "Pausar",
      options: { opensAppToForeground: true },
    },
    {
      identifier: ACTION_CANCEL,
      buttonTitle: "Cancelar treino",
      options: { isDestructive: true, opensAppToForeground: true },
    },
  ]);

  await Notifications.setNotificationCategoryAsync(TRAINING_CATEGORY_PAUSED, [
    {
      identifier: ACTION_RESUME,
      buttonTitle: "Retomar",
      options: { opensAppToForeground: true },
    },
    {
      identifier: ACTION_FINISH,
      buttonTitle: "Finalizar",
      options: { opensAppToForeground: true },
    },
    {
      identifier: ACTION_CANCEL,
      buttonTitle: "Cancelar treino",
      options: { isDestructive: true, opensAppToForeground: true },
    },
  ]);
}

export async function ensureTrainingNotificationPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  await ensureTrainingNotificationSetup();
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

function buildVisualProgressLine(elapsedSeconds: number): string {
  const cycle = 60;
  const seg = elapsedSeconds % cycle;
  const filled = Math.min(12, Math.round((seg / cycle) * 12));
  return "█".repeat(filled) + "░".repeat(12 - filled);
}

function buildNotificationBody(input: TrainingNotificationInput): {
  title: string;
  subtitle?: string;
  body: string;
} {
  const time = formatElapsedTime(input.elapsedSeconds);
  const exName = input.exerciseName?.trim() || "Exercício";
  const exType = input.exerciseTypeLabel?.trim() || "";
  const line = buildVisualProgressLine(input.elapsedSeconds);
  const stateLine =
    input.state === "paused"
      ? "Estado: PAUSADO"
      : "Estado: Em execução";

  const body = [
    `${stateLine}`,
    `Treino: ${input.workoutTitle}`,
    `Exercício: ${exName}${exType ? ` • ${exType}` : ""}`,
    `Tempo: ${time}`,
    line,
  ].join("\n");

  const title =
    input.state === "paused" ? "Treino pausado" : "Treino em andamento";

  const subtitle = `${exName}${exType ? ` · ${exType}` : ""}`;

  return { title, subtitle, body };
}

export async function showTrainingNotification(
  input: TrainingNotificationInput,
): Promise<string | undefined> {
  if (Platform.OS === "web") return undefined;
  const granted = await ensureTrainingNotificationPermission();
  if (!granted) return undefined;

  await ensureTrainingNotificationSetup();

  const { title, subtitle, body } = buildNotificationBody(input);
  const paused = input.state === "paused";
  const categoryId = paused
    ? TRAINING_CATEGORY_PAUSED
    : TRAINING_CATEGORY_ACTIVE;
  const channelId = paused ? CHANNEL_PAUSED : CHANNEL_ACTIVE;
  const color = paused ? NOTIFICATION_COLOR_PAUSED : NOTIFICATION_COLOR_ACTIVE;

  try {
    await Notifications.cancelScheduledNotificationAsync(
      ONGOING_TRAINING_NOTIFICATION_ID,
    );
  } catch {}

  const id = await Notifications.scheduleNotificationAsync({
    identifier: ONGOING_TRAINING_NOTIFICATION_ID,
    content: {
      title,
      subtitle,
      body,
      sound: true,
      ...(Platform.OS === "android"
        ? { priority: Notifications.AndroidNotificationPriority.MAX }
        : {}),
      color,
      sticky: true,
      autoDismiss: false,
      categoryIdentifier: categoryId,
      data: {
        kind: "active_training",
        sessionId: input.sessionId,
        state: input.state,
        workoutTitle: input.workoutTitle,
      },
      ...(Platform.OS === "android"
        ? {
            channelId,
            vibrate: [0, 250, 120, 250],
          }
        : {
            interruptionLevel: "timeSensitive" as const,
          }),
    },
    trigger: null,
  });

  return id;
}

export async function showTrainingInactiveAutoClosedNotification(
  workoutTitle: string,
): Promise<void> {
  if (Platform.OS === "web") return;
  const granted = await ensureTrainingNotificationPermission();
  if (!granted) return;
  await ensureTrainingNotificationSetup();

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Treino encerrado",
      body: `O treino "${workoutTitle}" foi encerrado por inatividade.`,
      sound: true,
      color: NOTIFICATION_COLOR_FINISHED,
      ...(Platform.OS === "android"
        ? { priority: Notifications.AndroidNotificationPriority.HIGH }
        : {}),
      data: { kind: "training_inactive_auto_closed" },
      ...(Platform.OS === "android"
        ? { channelId: CHANNEL_FINISHED }
        : { interruptionLevel: "active" as const }),
    },
    trigger: null,
  });
}

export async function showTrainingFinishedNotification(
  workoutTitle: string,
): Promise<void> {
  if (Platform.OS === "web") return;
  const granted = await ensureTrainingNotificationPermission();
  if (!granted) return;
  await ensureTrainingNotificationSetup();

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Treino finalizado",
      body: `${workoutTitle} — bom trabalho!`,
      sound: true,
      color: NOTIFICATION_COLOR_FINISHED,
      ...(Platform.OS === "android"
        ? { priority: Notifications.AndroidNotificationPriority.HIGH }
        : {}),
      data: { kind: "training_finished" },
      ...(Platform.OS === "android"
        ? { channelId: CHANNEL_FINISHED }
        : { interruptionLevel: "active" as const }),
    },
    trigger: null,
  });
}

export async function dismissTrainingNotification(notificationId?: string) {
  if (Platform.OS === "web") return;
  try {
    await Notifications.cancelScheduledNotificationAsync(
      ONGOING_TRAINING_NOTIFICATION_ID,
    );
  } catch {}
  if (notificationId) {
    try {
      await Notifications.dismissNotificationAsync(notificationId);
    } catch {}
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
    } catch {}
  }
}
