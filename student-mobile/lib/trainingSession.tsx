import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";
import { router } from "expo-router";
import { useAuth } from "./auth";
import { getActiveSession, WorkoutSession } from "./history";
import {
  dismissTrainingNotification,
  showTrainingNotification,
} from "./trainingNotifications";

export type ActiveTrainingSession = {
  id: string;
  studentId: string;
  workoutId: string;
  workoutTitle: string;
  startedAt: string;
  notificationId?: string;
};

type TrainingSessionContextValue = {
  loading: boolean;
  activeSession: ActiveTrainingSession | null;
  elapsedSeconds: number;
  resumeToken: number;
  setActiveSessionFromDbSession: (session: WorkoutSession) => Promise<void>;
  clearActiveSession: () => Promise<void>;
  syncWithServer: () => Promise<void>;
  setNotificationId: (notificationId: string | undefined) => Promise<void>;
};

const STORAGE_KEY = "@fitbody:active_training_session_v1";

const TrainingSessionContext = createContext<TrainingSessionContextValue>({
  loading: true,
  activeSession: null,
  elapsedSeconds: 0,
  resumeToken: 0,
  setActiveSessionFromDbSession: async () => {},
  clearActiveSession: async () => {},
  syncWithServer: async () => {},
  setNotificationId: async () => {},
});

function safeParseSession(raw: string | null): ActiveTrainingSession | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (
      typeof parsed.id !== "string" ||
      typeof parsed.studentId !== "string" ||
      typeof parsed.workoutId !== "string" ||
      typeof parsed.workoutTitle !== "string" ||
      typeof parsed.startedAt !== "string"
    ) {
      return null;
    }
    return parsed as ActiveTrainingSession;
  } catch {
    return null;
  }
}

function computeElapsedSeconds(startedAtIso: string, nowMs: number) {
  const startMs = new Date(startedAtIso).getTime();
  if (!Number.isFinite(startMs)) return 0;
  const diffSec = Math.floor((nowMs - startMs) / 1000);
  return diffSec > 0 ? diffSec : 0;
}

export function TrainingSessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeSession, setActiveSession] = useState<ActiveTrainingSession | null>(
    null,
  );
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [resumeToken, setResumeToken] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const appStateRef = useRef(AppState.currentState);

  const persist = useCallback(async (value: ActiveTrainingSession | null) => {
    if (!value) {
      await AsyncStorage.removeItem(STORAGE_KEY);
      return;
    }
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  }, []);

  const syncWithServer = useCallback(async () => {
    if (!user) return;
    try {
      const serverActive = await getActiveSession(user.id);
      if (!serverActive) {
        if (activeSession?.studentId === user.id) {
          setActiveSession(null);
          setElapsedSeconds(0);
          await persist(null);
        }
        return;
      }
      await setActiveSessionFromDbSession(serverActive);
    } catch {}
  }, [activeSession?.studentId, persist, user]);

  const setActiveSessionFromDbSession = useCallback(
    async (session: WorkoutSession) => {
      const next: ActiveTrainingSession = {
        id: session.id,
        studentId: session.studentId,
        workoutId: session.workoutId || "",
        workoutTitle: session.workoutTitle,
        startedAt: session.startedAt,
      };
      setActiveSession((prev) => ({
        ...next,
        notificationId: prev?.notificationId,
      }));
      setElapsedSeconds(computeElapsedSeconds(next.startedAt, Date.now()));
      await persist({
        ...next,
        notificationId: activeSession?.notificationId,
      });
    },
    [activeSession?.notificationId, persist],
  );

  const clearActiveSession = useCallback(async () => {
    setActiveSession(null);
    setElapsedSeconds(0);
    await persist(null);
  }, [persist]);

  const setNotificationId = useCallback(
    async (notificationId: string | undefined) => {
      setActiveSession((prev) => {
        if (!prev) return prev;
        return { ...prev, notificationId };
      });
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const existing = safeParseSession(raw);
      if (!existing) return;
      await persist({ ...existing, notificationId });
    },
    [persist],
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        const stored = safeParseSession(raw);
        if (!mounted) return;

        if (stored && user && stored.studentId !== user.id) {
          await AsyncStorage.removeItem(STORAGE_KEY);
          setActiveSession(null);
          setElapsedSeconds(0);
        } else {
          setActiveSession(stored);
          setElapsedSeconds(stored ? computeElapsedSeconds(stored.startedAt, Date.now()) : 0);
        }

        if (user) {
          await syncWithServer();
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [syncWithServer, user]);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!activeSession) return;
    if (appStateRef.current !== "active") return;

    intervalRef.current = setInterval(() => {
      setElapsedSeconds(computeElapsedSeconds(activeSession.startedAt, Date.now()));
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [activeSession]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", async (nextState) => {
      const prev = appStateRef.current;
      appStateRef.current = nextState;

      if (nextState === "active") {
        setResumeToken((t) => t + 1);
        if (activeSession) {
          setElapsedSeconds(computeElapsedSeconds(activeSession.startedAt, Date.now()));
          if (prev !== "active") {
            router.replace("/(tabs)/workouts");
          }
          if (activeSession.notificationId) {
            await dismissTrainingNotification(activeSession.notificationId);
            await setNotificationId(undefined);
          }
        }
        await syncWithServer();
      }

      if (prev === "active" && nextState !== "active") {
        if (activeSession) {
          const seconds = computeElapsedSeconds(activeSession.startedAt, Date.now());
          setElapsedSeconds(seconds);
          if (activeSession.notificationId) {
            await dismissTrainingNotification(activeSession.notificationId);
          }
          const id = await showTrainingNotification({
            workoutTitle: activeSession.workoutTitle,
            elapsedSeconds: seconds,
          });
          if (id) {
            await setNotificationId(id);
          }
        }
      }
    });

    return () => sub.remove();
  }, [activeSession, syncWithServer]);

  const value = useMemo<TrainingSessionContextValue>(
    () => ({
      loading,
      activeSession,
      elapsedSeconds,
      resumeToken,
      setActiveSessionFromDbSession,
      clearActiveSession,
      syncWithServer,
      setNotificationId,
    }),
    [
      activeSession,
      clearActiveSession,
      elapsedSeconds,
      loading,
      resumeToken,
      setActiveSessionFromDbSession,
      setNotificationId,
      syncWithServer,
    ],
  );

  return (
    <TrainingSessionContext.Provider value={value}>
      {children}
    </TrainingSessionContext.Provider>
  );
}

export function useTrainingSession() {
  return useContext(TrainingSessionContext);
}

export function formatElapsedTime(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0
    ? `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
    : `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}
