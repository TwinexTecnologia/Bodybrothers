import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { supabase } from "./supabase";

const STUDENT_BELL_CHANNEL_ID = "student_bell";

let cachedSyncKey: string | null = null;
let currentExpoPushToken: string | null = null;

export async function syncRemotePushTokenForUser(
  userId: string,
): Promise<string | null> {
  try {
    await ensureAndroidPushChannel();

    const existingPermissions = await Notifications.getPermissionsAsync();
    let granted =
      existingPermissions.granted || existingPermissions.status === "granted";

    if (!granted) {
      const requestedPermissions =
        await Notifications.requestPermissionsAsync();
      granted =
        requestedPermissions.granted ||
        requestedPermissions.status === "granted";
    }

    if (!granted) {
      return null;
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    if (!projectId) {
      console.warn("Expo projectId ausente; push remoto não foi configurado.");
      return null;
    }

    const tokenResponse = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    const expoPushToken = tokenResponse.data;
    const syncKey = `${userId}:${expoPushToken}`;

    currentExpoPushToken = expoPushToken;
    if (cachedSyncKey === syncKey) {
      return expoPushToken;
    }

    const timestamp = new Date().toISOString();
    const { error } = await supabase.from("user_push_tokens").upsert(
      {
        user_id: userId,
        token: expoPushToken,
        platform: Platform.OS,
        app_source: "student_mobile",
        last_seen_at: timestamp,
        disabled_at: null,
      },
      { onConflict: "token" },
    );

    if (error) {
      throw error;
    }

    cachedSyncKey = syncKey;
    return expoPushToken;
  } catch (error) {
    console.error("Erro ao sincronizar push token remoto:", error);
    return null;
  }
}

export async function disableCurrentRemotePushToken(): Promise<void> {
  if (!currentExpoPushToken) return;

  try {
    const { error } = await supabase
      .from("user_push_tokens")
      .delete()
      .eq("token", currentExpoPushToken);

    if (error) {
      throw error;
    }
  } catch (error) {
    console.error("Erro ao desativar push token remoto:", error);
  } finally {
    resetPushRegistrationCache();
  }
}

export function resetPushRegistrationCache(): void {
  cachedSyncKey = null;
  currentExpoPushToken = null;
}

async function ensureAndroidPushChannel(): Promise<void> {
  if (Platform.OS !== "android") return;

  await Notifications.setNotificationChannelAsync(STUDENT_BELL_CHANNEL_ID, {
    name: "Notificações",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#3b82f6",
    sound: "default",
  });
}
