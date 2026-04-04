import "react-native-url-polyfill/auto";
import { useEffect } from "react";
import * as Notifications from "expo-notifications";
import { Stack } from "expo-router";
import { AuthProvider } from "../lib/auth";
import { handleTrainingNotificationResponse } from "../lib/trainingNotificationActions";
import { registerTrainingNotificationBackgroundTask } from "../lib/notificationTask";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { TrainingSessionProvider } from "../lib/trainingSession";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function NotificationResponseBridge() {
  useEffect(() => {
    let sub: { remove: () => void } | undefined;
    (async () => {
      try {
        await registerTrainingNotificationBackgroundTask();
      } catch {
        /* already registered or unavailable in Expo Go */
      }
      sub = Notifications.addNotificationResponseReceivedListener(
        (response) => {
          void handleTrainingNotificationResponse(response);
        },
      );
    })();
    return () => {
      sub?.remove();
    };
  }, []);

  return null;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <TrainingSessionProvider>
          <NotificationResponseBridge />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
          </Stack>
        </TrainingSessionProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
