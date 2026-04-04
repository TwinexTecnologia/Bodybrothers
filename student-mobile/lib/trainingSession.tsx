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
import { loadActiveSession, saveActiveSession } from "./trainingSessionStorage";
import {
  computeElapsedSeconds,
  formatElapsedTime,
  type ActiveTrainingSession,
} from "./trainingSessionTypes";

export type {
  ActiveTrainingSession,
} from "./trainingSessionTypes";

export { formatElapsedTime } from "./trainingSessionTypes";

type TrainingSessionContextValue = {
  loading: boolean;
  activeSession: ActiveTrainingSession | null;
  elapsedSeconds: number;
  resumeToken: number;
  isPaused: boolean;
  setActiveSessionFromDbSession: (session: WorkoutSession) => Promise<void>;
  clearActiveSession: () => Promise<void>;
  syncWithServer: () => Promise<void>;
  setNotificationId: (notificationId: string | undefined) => Promise<void>;
  pauseTraining: () => Promise<void>;
  resumeTraining: () => Promise<void>;
  updateCurrentExercise: (name: string, typeLabel: string) => Promise<void>;
};

const TrainingSessionContext = createContext<TrainingSessionContextValue>({
  loading: true,
  activeSession: null,
  elapsedSeconds: 0,
  resumeToken: 0,
  isPaused: false,
  setActiveSessionFromDbSession: async () => {},
  clearActiveSession: async () => {},
  syncWithServer: async () => {},
  setNotificationId: async () => {},
  pauseTraining: async () => {},
  resumeTraining: async () => {},
  updateCurrentExercise: async () => {},
});

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
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appStateRef = useRef(AppState.currentState);
  const sessionRef = useRef<ActiveTrainingSession | null>(null);
  sessionRef.current = activeSession;

  const isPaused = Boolean(activeSession?.pauseStartedAt);

  const persist = useCallback(async (value: ActiveTrainingSession | null) => {
    await saveActiveSession(value);
  }, []);

  const setActiveSessionFromDbSession = useCallback(
    async (session: WorkoutSession) => {
      const next: ActiveTrainingSession = {
        id: session.id,
        studentId: session.studentId,
        workoutId: session.workoutId || "",
        workoutTitle: session.workoutTitle,
        startedAt: session.startedAt,
        totalPausedSeconds: 0,
        pauseStartedAt: null,
      };
      setActiveSession((prev) => {
        let result: ActiveTrainingSession;
        if (prev && prev.id === next.id) {
          result = {
            ...next,
            notificationId: prev.notificationId,
            totalPausedSeconds: prev.totalPausedSeconds ?? 0,
            pauseStartedAt: prev.pauseStartedAt ?? null,
            currentExerciseName: prev.currentExerciseName,
            currentExerciseTypeLabel: prev.currentExerciseTypeLabel,
          };
        } else {
          result = { ...next, totalPausedSeconds: 0, pauseStartedAt: null };
        }
        void persist(result);
        queueMicrotask(() =>
          setElapsedSeconds(computeElapsedSeconds(result, Date.now())),
        );
        return result;
      });
    },
    [persist],
  );

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
  }, [activeSession?.studentId, persist, setActiveSessionFromDbSession, user]);

  const clearActiveSession = useCallback(async () => {
    const prev = sessionRef.current;
    if (prev?.notificationId) {
      await dismissTrainingNotification(prev.notificationId);
    }
    setActiveSession(null);
    setElapsedSeconds(0);
    await persist(null);
  }, [persist]);

  const setNotificationId = useCallback(
    async (notificationId: string | undefined) => {
      setActiveSession((prev) => {
        if (!prev) return prev;
        const updated = { ...prev, notificationId };
        void saveActiveSession(updated);
        return updated;
      });
    },
    [],
  );

  const pauseTraining = useCallback(async () => {
    setActiveSession((prev) => {
      if (!prev || prev.pauseStartedAt) return prev;
      const next: ActiveTrainingSession = {
        ...prev,
        pauseStartedAt: new Date().toISOString(),
      };
      void saveActiveSession(next);
      return next;
    });
  }, []);

  const resumeTraining = useCallback(async () => {
    setActiveSession((prev) => {
      if (!prev?.pauseStartedAt) return prev;
      const p = new Date(prev.pauseStartedAt).getTime();
      const add = Math.max(0, Math.floor((Date.now() - p) / 1000));
      const next: ActiveTrainingSession = {
        ...prev,
        pauseStartedAt: null,
        totalPausedSeconds: (prev.totalPausedSeconds ?? 0) + add,
      };
      void saveActiveSession(next);
      return next;
    });
  }, []);

  const updateCurrentExercise = useCallback(
    async (name: string, typeLabel: string) => {
      setActiveSession((prev) => {
        if (!prev) return prev;
        const next: ActiveTrainingSession = {
          ...prev,
          currentExerciseName: name,
          currentExerciseTypeLabel: typeLabel,
        };
        void saveActiveSession(next);
        return next;
      });
    },
    [],
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const stored = await loadActiveSession();
        if (!mounted) return;

        if (stored && user && stored.studentId !== user.id) {
          await saveActiveSession(null);
          setActiveSession(null);
          setElapsedSeconds(0);
        } else {
          setActiveSession(stored);
          setElapsedSeconds(
            stored
              ? computeElapsedSeconds(stored, Date.now())
              : 0,
          );
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
      const s = sessionRef.current;
      if (!s) return;
      setElapsedSeconds(computeElapsedSeconds(s, Date.now()));
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
        if (user) {
          const latest = await loadActiveSession();
          if (latest && latest.studentId === user.id) {
            setActiveSession(latest);
            setElapsedSeconds(computeElapsedSeconds(latest, Date.now()));
          }
        }
        setResumeToken((t) => t + 1);
        const s = sessionRef.current;
        if (s) {
          setElapsedSeconds(computeElapsedSeconds(s, Date.now()));
          if (prev !== "active") {
            router.replace("/(tabs)/workouts");
          }
          if (s.notificationId) {
            await dismissTrainingNotification(s.notificationId);
            await setNotificationId(undefined);
          }
        }
        await syncWithServer();
      }

      if (prev === "active" && nextState !== "active") {
        const s = sessionRef.current;
        if (s) {
          const seconds = computeElapsedSeconds(s, Date.now());
          setElapsedSeconds(seconds);
          if (s.notificationId) {
            await dismissTrainingNotification(s.notificationId);
          }
          const id = await showTrainingNotification({
            workoutTitle: s.workoutTitle,
            elapsedSeconds: seconds,
            exerciseName: s.currentExerciseName,
            exerciseTypeLabel: s.currentExerciseTypeLabel,
            state: s.pauseStartedAt ? "paused" : "active",
            sessionId: s.id,
          });
          if (id) {
            await setNotificationId(id);
          }
        }
      }
    });

    return () => sub.remove();
  }, [setNotificationId, syncWithServer, user]);

  const value = useMemo<TrainingSessionContextValue>(
    () => ({
      loading,
      activeSession,
      elapsedSeconds,
      resumeToken,
      isPaused,
      setActiveSessionFromDbSession,
      clearActiveSession,
      syncWithServer,
      setNotificationId,
      pauseTraining,
      resumeTraining,
      updateCurrentExercise,
    }),
    [
      activeSession,
      clearActiveSession,
      elapsedSeconds,
      isPaused,
      loading,
      pauseTraining,
      resumeTraining,
      resumeToken,
      setActiveSessionFromDbSession,
      setNotificationId,
      syncWithServer,
      updateCurrentExercise,
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
