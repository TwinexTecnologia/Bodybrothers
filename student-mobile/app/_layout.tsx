import 'react-native-url-polyfill/auto';
import { Stack } from 'expo-router';
import { AuthProvider } from '../lib/auth';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TrainingSessionProvider } from '../lib/trainingSession';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <TrainingSessionProvider>
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
