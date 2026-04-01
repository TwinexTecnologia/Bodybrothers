import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

type TrainingNotificationInput = {
  workoutTitle: string;
  elapsedSeconds: number;
};

export async function ensureTrainingNotificationPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("active-training", {
      name: "Treino em andamento",
      importance: Notifications.AndroidImportance.LOW,
      vibrationPattern: [],
      sound: null,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

export async function showTrainingNotification({
  workoutTitle,
  elapsedSeconds,
}: TrainingNotificationInput): Promise<string | undefined> {
  if (Platform.OS === "web") return undefined;
  const granted = await ensureTrainingNotificationPermission();
  if (!granted) return undefined;

  const min = Math.floor(elapsedSeconds / 60);
  const sec = elapsedSeconds % 60;
  const time = `${min.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: "Treino em andamento",
      body: `${workoutTitle} • Tempo: ${time}`,
      sound: false,
      ...(Platform.OS === "android" ? { channelId: "active-training" } : {}),
      data: { kind: "active_training" },
    },
    trigger: null,
  });

  return id;
}

export async function dismissTrainingNotification(notificationId?: string) {
  if (!notificationId) return;
  if (Platform.OS === "web") return;
  try {
    await Notifications.dismissNotificationAsync(notificationId);
  } catch {}
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch {}
}
