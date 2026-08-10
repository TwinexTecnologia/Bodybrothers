import "react-native-url-polyfill/auto";
import { useCallback, useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import { Stack, useRootNavigationState } from "expo-router";
import { AuthProvider, useAuth } from "../lib/auth";
import { registerTrainingNotificationBackgroundTask } from "../lib/notificationTask";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { TrainingSessionProvider } from "../lib/trainingSession";
import {
  getNotificationResponseKey,
  handleAppNotificationResponse,
} from "../lib/notificationRouting";
import { syncRemotePushTokenForUser } from "../lib/pushRegistration";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function NotificationResponseBridge() {
  const { user, loading } = useAuth();
  const navigationState = useRootNavigationState();
  const handledKeysRef = useRef<Set<string>>(new Set());

  const processResponse = useCallback(
    async (response: Notifications.NotificationResponse) => {
      const key = getNotificationResponseKey(response);
      if (handledKeysRef.current.has(key)) return;

      handledKeysRef.current.add(key);
      await handleAppNotificationResponse(response);
    },
    [],
  );

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
          void processResponse(response);
        },
      );
    })();
    return () => {
      sub?.remove();
    };
  }, [processResponse]);

  useEffect(() => {
    if (!user?.id) return;
    void syncRemotePushTokenForUser(user.id);
  }, [user?.id]);

  useEffect(() => {
    if (loading || !navigationState?.key) return;

    let active = true;
    (async () => {
      const response = await Notifications.getLastNotificationResponseAsync();
      if (!active || !response) return;
      await processResponse(response);
    })();

    return () => {
      active = false;
    };
  }, [loading, navigationState?.key, processResponse]);

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
            <Stack.Screen name="personal-access" />
          </Stack>
        </TrainingSessionProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
