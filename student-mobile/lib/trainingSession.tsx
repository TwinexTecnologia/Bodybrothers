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
import { persistFinishActiveSession } from "./activeSessionFinish";
import { getActiveSession, WorkoutSession } from "./history";
import {
  clearActiveSessionInactivity,
  syncActiveSessionInactivity,
} from "./trainingSessionInactivity";
import {
  dismissTrainingNotification,
  showTrainingNotification,
} from "./trainingNotifications";
import { loadActiveSession, saveActiveSession } from "./trainingSessionStorage";
import {
  computeElapsedSeconds,
  formatElapsedTime,
  getNextAutoCloseDeadlineMs,
  shouldAutoCloseTrainingSession,
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
  const [activeSession, setActiveSession] = useState<ActiveTrainingSession | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [resumeToken, setResumeToken] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inactivityTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appStateRef = useRef(AppState.currentState);
  const sessionRef = useRef<ActiveTrainingSession | null>(null);
  const inactivityFinishingRef = useRef(false);
  sessionRef.current = activeSession;

  const isPaused = Boolean(activeSession?.pauseStartedAt);

  const persist = useCallback(async (value: ActiveTrainingSession | null) => {
    await saveActiveSession(value);
  }, []);

  const applySessionState = useCallback((value: ActiveTrainingSession | null) => {
    sessionRef.current = value;
    setActiveSession(value);
    setElapsedSeconds(value ? computeElapsedSeconds(value, Date.now()) : 0);
  }, []);

  const persistSessionWithInactivity = useCallback(
    async (value: ActiveTrainingSession | null) => {
      if (!value) {
        await persist(null);
        return null;
      }
      const persisted = await syncActiveSessionInactivity(value);
      await persist(persisted);
      return persisted;
    },
    [persist],
  );

  const commitActiveSession = useCallback(
    async (value: ActiveTrainingSession | null) => {
      applySessionState(value);
      const persisted = await persistSessionWithInactivity(value);
      if (persisted !== value) {
        applySessionState(persisted);
      }
      return persisted;
    },
    [applySessionState, persistSessionWithInactivity],
  );

  const updateActiveSession = useCallback(
    async (
      updater: (
        prev: ActiveTrainingSession | null,
      ) => ActiveTrainingSession | null,
    ) => {
      const prev = sessionRef.current;
      const next = updater(prev);
      if (next === prev) return prev;
      return await commitActiveSession(next);
    },
    [commitActiveSession],
  );

  const setActiveSessionFromDbSession = useCallback(
    async (session: WorkoutSession) => {
      const now = new Date().toISOString();
      const base: ActiveTrainingSession = {
        id: session.id,
        studentId: session.studentId,
        workoutId: session.workoutId || "",
        workoutTitle: session.workoutTitle,
        startedAt: session.startedAt,
        lastInteractionAt: session.startedAt,
        totalPausedSeconds: 0,
        pauseStartedAt: null,
      };
      const prev = sessionRef.current;
      const next =
        prev && prev.id === base.id
          ? {
              ...base,
              notificationId: prev.notificationId,
              totalPausedSeconds: prev.totalPausedSeconds ?? 0,
              pauseStartedAt: prev.pauseStartedAt ?? null,
              currentExerciseName: prev.currentExerciseName,
              currentExerciseTypeLabel: prev.currentExerciseTypeLabel,
              lastInteractionAt:
                prev.lastInteractionAt ?? prev.startedAt ?? base.startedAt,
            }
          : {
              ...base,
              lastInteractionAt: now,
              totalPausedSeconds: 0,
              pauseStartedAt: null,
            };
      await commitActiveSession(next);
    },
    [commitActiveSession],
  );

  const clearActiveSession = useCallback(async () => {
    const prev = sessionRef.current;
    if (prev?.notificationId) {
      await dismissTrainingNotification(prev.notificationId);
    }
    await clearActiveSessionInactivity(prev);
    applySessionState(null);
    await persist(null);
  }, [applySessionState, persist]);

  const syncWithServer = useCallback(async () => {
    if (!user) return;
    try {
      const serverActive = await getActiveSession(user.id);
      if (!serverActive) {
        if (activeSession?.studentId === user.id) {
          await clearActiveSession();
        }
        return;
      }
      await setActiveSessionFromDbSession(serverActive);
    } catch {}
  }, [activeSession?.studentId, clearActiveSession, setActiveSessionFromDbSession, user]);

  const setNotificationId = useCallback(
    async (notificationId: string | undefined) => {
      const prev = sessionRef.current;
      if (!prev) return;
      const updated = { ...prev, notificationId };
      applySessionState(updated);
      await saveActiveSession(updated);
    },
    [applySessionState],
  );

  const pauseTraining = useCallback(async () => {
    await updateActiveSession((prev) => {
      if (!prev || prev.pauseStartedAt) return prev;
      const now = new Date().toISOString();
      return {
        ...prev,
        pauseStartedAt: now,
        lastInteractionAt: now,
      };
    });
  }, [updateActiveSession]);

  const resumeTraining = useCallback(async () => {
    await updateActiveSession((prev) => {
      if (!prev?.pauseStartedAt) return prev;
      const p = new Date(prev.pauseStartedAt).getTime();
      const add = Math.max(0, Math.floor((Date.now() - p) / 1000));
      const now = new Date().toISOString();
      return {
        ...prev,
        pauseStartedAt: null,
        totalPausedSeconds: (prev.totalPausedSeconds ?? 0) + add,
        lastInteractionAt: now,
      };
    });
  }, [updateActiveSession]);

  const updateCurrentExercise = useCallback(
    async (name: string, typeLabel: string) => {
      await updateActiveSession((prev) => {
        if (!prev) return prev;
        if (
          prev.currentExerciseName === name &&
          prev.currentExerciseTypeLabel === typeLabel
        ) {
          return prev;
        }
        const now = new Date().toISOString();
        return {
          ...prev,
          currentExerciseName: name,
          currentExerciseTypeLabel: typeLabel,
          lastInteractionAt: now,
        };
      });
    },
    [updateActiveSession],
  );

  /** Encerra treino inativo (≥4h sem interação). Só roda com app em execução — sem job no servidor. */
  const runInactivityAutoFinish = useCallback(async () => {
    if (!user || inactivityFinishingRef.current) return;
    const stored = await loadActiveSession();
    if (!stored || stored.studentId !== user.id) return;
    const close = shouldAutoCloseTrainingSession(stored, Date.now());
    if (!close) return;
    inactivityFinishingRef.current = true;
    try {
      await persistFinishActiveSession(stored, { autoClose: close.reason });
      applySessionState(null);
    } finally {
      inactivityFinishingRef.current = false;
    }
  }, [applySessionState, user]);

  useEffect(() => {
    if (loading || !user) return;
    void runInactivityAutoFinish();
  }, [
    loading,
    user?.id,
    activeSession?.id,
    activeSession?.lastInteractionAt,
    runInactivityAutoFinish,
  ]);

  useEffect(() => {
    if (!activeSession || !user || appStateRef.current !== "active") {
      if (inactivityTimeoutRef.current) {
        clearTimeout(inactivityTimeoutRef.current);
        inactivityTimeoutRef.current = null;
      }
      return;
    }
    const deadlineMs = getNextAutoCloseDeadlineMs(activeSession, Date.now());
    if (deadlineMs == null) return;
    const delay = deadlineMs - Date.now();
    if (delay <= 0) {
      void runInactivityAutoFinish();
      return;
    }
    if (inactivityTimeoutRef.current) clearTimeout(inactivityTimeoutRef.current);
    inactivityTimeoutRef.current = setTimeout(() => {
      if (inactivityTimeoutRef.current) {
        clearTimeout(inactivityTimeoutRef.current);
        inactivityTimeoutRef.current = null;
      }
      void runInactivityAutoFinish();
    }, delay);
    return () => {
      if (inactivityTimeoutRef.current) {
        clearTimeout(inactivityTimeoutRef.current);
        inactivityTimeoutRef.current = null;
      }
    };
  }, [
    activeSession?.id,
    activeSession?.lastInteractionAt,
    activeSession?.pauseStartedAt,
    activeSession?.startedAt,
    activeSession?.totalPausedSeconds,
    resumeToken,
    runInactivityAutoFinish,
    user?.id,
  ]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const stored = await loadActiveSession();
        if (!mounted) return;

        if (stored && user && stored.studentId !== user.id) {
          await saveActiveSession(null);
          applySessionState(null);
        } else {
          applySessionState(stored);
          if (stored && user && stored.studentId === user.id) {
            const synced = await persistSessionWithInactivity(stored);
            if (mounted && synced) {
              applySessionState(synced);
            }
          }
        }

        if (user) {
          await syncWithServer();
        }
        await runInactivityAutoFinish();
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [
    applySessionState,
    persistSessionWithInactivity,
    runInactivityAutoFinish,
    syncWithServer,
    user,
  ]);

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
            applySessionState(latest);
            if (!shouldAutoCloseTrainingSession(latest, Date.now())) {
              const synced = await persistSessionWithInactivity(latest);
              applySessionState(synced);
            }
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
        await runInactivityAutoFinish();
      }

      if (prev === "active" && nextState !== "active") {
        if (inactivityTimeoutRef.current) {
          clearTimeout(inactivityTimeoutRef.current);
          inactivityTimeoutRef.current = null;
        }
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
  }, [
    applySessionState,
    persistSessionWithInactivity,
    runInactivityAutoFinish,
    setNotificationId,
    syncWithServer,
    user,
  ]);

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
