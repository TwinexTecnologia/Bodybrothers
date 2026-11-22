import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Animated,
  useWindowDimensions,
  TextInput,
} from "react-native";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabase";
import {
  Dumbbell,
  ChevronRight,
  Clock,
  Play,
  CheckCircle,
  ArrowRight,
  MessageSquare,
  ChevronLeft,
} from "lucide-react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import {
  startSession,
  getWeeklyActivity,
  getTrainingIsFinished,
  saveSessionExerciseLogs,
  getSessionExerciseLogs,
  getLatestExerciseLogs,
  type WorkoutSetLog,
} from "../../lib/history";
import { LinearGradient } from "expo-linear-gradient";
import ActiveWorkoutHeroActions from "../../components/ActiveWorkoutHeroActions";
import ExerciseSetCard from "../../components/ExerciseSetCard";
import WorkoutInlineVideo from "../../components/WorkoutInlineVideo";
import {
  formatElapsedTime,
  useTrainingSession,
} from "../../lib/trainingSession";
import {
  getYoutubeId,
  isMp4Url,
  useMp4PreviewVideo,
} from "../../lib/workoutsPreviewVideo";
import { useLocalSearchParams } from "expo-router";
import { useVideoPlayer } from "expo-video";
import * as VideoThumbnails from "expo-video-thumbnails";
import { getStartWorkoutBlockReason } from "../../lib/workoutStartGuard";
import { Skeleton } from "../../components/ui/skeleton";
import {
  clearWorkoutSessionDrafts,
  loadWorkoutSessionDrafts,
  saveWorkoutSessionDrafts,
  type SessionSetDraft,
} from "../../lib/workoutSessionDrafts";

// Tipos
type ExerciseSet = {
  type: "warmup" | "feeder" | "working" | "custom" | "topset";
  customLabel?: string;
  series: string;
  reps: string;
  load: string;
  rest: string;
};

type Exercise = {
  name: string;
  sets?: ExerciseSet[];
  series: string;
  reps: string;
  load: string;
  rest: string;
  videoUrl?: string;
  video_url?: string;
  notes?: string;
  warmupSeries?: string;
  warmupReps?: string;
  warmupLoad?: string;
  warmupRest?: string;
  feederSeries?: string;
  feederReps?: string;
  feederLoad?: string;
  feederRest?: string;
};

type Workout = {
  id: string;
  title: string;
  data: {
    goal?: string;
    exercises: Exercise[];
    notes?: string;
  };
};

function orderWorkoutsByIds<T extends { id: string }>(list: T[], orderedIds: string[]) {
  if (!orderedIds.length) return list;

  const workoutMap = new Map(list.map((item) => [item.id, item]));
  const ordered = orderedIds
    .map((id) => workoutMap.get(id))
    .filter(Boolean) as T[];
  const remaining = list.filter((item) => !orderedIds.includes(item.id));

  return [...ordered, ...remaining];
}

function normalizeWorkoutDays(days: string[] | undefined) {
  if (!Array.isArray(days)) return [];

  return DAYS_ORDER.filter((dayKey) =>
    days.map((day) => String(day).toLowerCase()).includes(dayKey),
  );
}

const DEBUG_WORKOUTS =
  __DEV__ && process.env.EXPO_PUBLIC_DEBUG_WORKOUTS === "1";

function debugWorkouts(message: string, data?: Record<string, unknown>) {
  if (!DEBUG_WORKOUTS) return;
  if (data) console.log(`[workouts] ${message}`, data);
  else console.log(`[workouts] ${message}`);
}

function getPrimaryExerciseTypeLabel(ex: Exercise): string {
  const sets = ex.sets;
  if (sets && sets.length > 0) {
    const t = sets[0].type;
    if (t === "warmup") return "Aquecimento";
    if (t === "working") return "Série principal";
    if (t === "feeder") return "Feeder";
    if (t === "topset") return "Top set";
    if (t === "custom") return sets[0].customLabel?.trim() || "Personalizado";
  }
  if (ex.warmupSeries || ex.warmupReps) return "Aquecimento";
  if (ex.feederSeries || ex.feederReps) return "Feeder";
  return "Série principal";
}

function buildSessionSetKey(exerciseIndex: number, setIndex: number) {
  return `${exerciseIndex}-${setIndex}`;
}

function normalizeExerciseSets(ex: Exercise): ExerciseSet[] {
  const base: ExerciseSet[] = ex.sets ? [...ex.sets] : [];
  if (base.length > 0) return base;

  const derived: ExerciseSet[] = [];
  if (ex.warmupSeries || ex.warmupReps) {
    derived.push({
      type: "warmup",
      series: ex.warmupSeries || "",
      reps: ex.warmupReps || "",
      load: ex.warmupLoad || "",
      rest: ex.warmupRest || "",
    });
  }
  if (ex.feederSeries || ex.feederReps) {
    derived.push({
      type: "feeder",
      series: ex.feederSeries || "",
      reps: ex.feederReps || "",
      load: ex.feederLoad || "",
      rest: ex.feederRest || "",
    });
  }
  if (ex.series || ex.reps) {
    derived.push({
      type: "working",
      series: ex.series || "",
      reps: ex.reps || "",
      load: ex.load || "",
      rest: ex.rest || "",
    });
  }
  return derived;
}

function getSetVisuals(set: ExerciseSet) {
  if (set.type === "warmup") {
    return {
      color: "#ea580c",
      bg: "#fff7ed",
      borderColor: "#fed7aa",
      label: "AQUECIMENTO",
    };
  }
  if (set.type === "working") {
    return {
      color: "#16a34a",
      bg: "#f0fdf4",
      borderColor: "#bbf7d0",
      label: "TRABALHO",
    };
  }
  if (set.type === "feeder") {
    return {
      color: "#0284c7",
      bg: "#f0f9ff",
      borderColor: "#bae6fd",
      label: "PREPARAÇÃO",
    };
  }
  if (set.type === "topset") {
    return {
      color: "#4f46e5",
      bg: "#eef2ff",
      borderColor: "#c7d2fe",
      label: "TOP SET",
    };
  }
  return {
    color: "#475569",
    bg: "#f8fafc",
    borderColor: "#e2e8f0",
    label: set.customLabel?.trim() || "OUTRO",
  };
}

function parseDecimalInput(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function formatLoadLabel(value?: string | number | null) {
  if (value === undefined || value === null || value === "") return "";
  return `${String(value).replace(".", ",")} kg`;
}

function formatLoadInputValue(value: number) {
  return Number.isInteger(value) ? String(value) : String(value).replace(".", ",");
}

function sanitizeDecimalDraftValue(value: string) {
  return value.replace(/[^0-9,.\-]/g, "");
}

function normalizeLoadDraftValue(value: string) {
  const parsed = parseDecimalInput(value);
  if (parsed === null) return "";
  const normalized = Math.max(0, Math.min(1000, Number(parsed.toFixed(2))));
  return formatLoadInputValue(normalized);
}

function normalizePerformedRepsDraftValue(value: string) {
  const onlyDigits = value.replace(/\D/g, "");
  if (!onlyDigits) return "";
  return String(Math.max(0, Math.min(100, Number(onlyDigits))));
}

function canCompleteSessionSet(draft: SessionSetDraft) {
  return Boolean(draft.load.trim() && draft.performedReps.trim());
}

const DAYS_MAP: Record<string, string> = {
  seg: "Segunda-feira",
  ter: "Terça-feira",
  qua: "Quarta-feira",
  qui: "Quinta-feira",
  sex: "Sexta-feira",
  sab: "Sábado",
  dom: "Domingo",
};
const DAYS_ORDER = ["seg", "ter", "qua", "qui", "sex", "sab", "dom"];

export default function Workouts() {
  const { user } = useAuth();
  const { openActive } = useLocalSearchParams<{ openActive?: string }>();
  const { width: viewportWidth, height: viewportHeight } =
    useWindowDimensions();
  const insets = useSafeAreaInsets();
  const {
    activeSession,
    elapsedSeconds,
    loading: trainingLoading,
    setActiveSessionFromDbSession,
    clearActiveSession,
    isPaused,
    pauseTraining,
    resumeTraining,
    updateCurrentExercise,
  } = useTrainingSession();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [schedule, setSchedule] = useState<Record<string, string[]>>({});
  const [activeDays, setActiveDays] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [workoutLoading, setWorkoutLoading] = useState(false);
  const [isTraningFinished, setIsTraningFinished] = useState(false);
  const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null);

  const [previewActiveVideoIndex, setPreviewActiveVideoIndex] = useState<
    number | null
  >(null);
  const [previewFullscreenIndex, setPreviewFullscreenIndex] = useState<
    number | null
  >(null);
  const [previewInlineSurfaceVersion, setPreviewInlineSurfaceVersion] =
    useState(0);
  const [previewFullscreenLayout, setPreviewFullscreenLayout] = useState<{
    w: number;
    h: number;
  } | null>(null);
  const [previewVideoLoading, setPreviewVideoLoading] = useState(false);
  const [previewThumbnails, setPreviewThumbnails] = useState<
    Record<number, string>
  >({});
  const previewThumbnailsCache = useRef<Record<number, string>>({});
  const previewThumbProcessing = useRef<Record<number, boolean>>({});
  const previewPlayer = useVideoPlayer("");
  const previewFullscreenPlayer = useVideoPlayer("");
  const previewFullscreenLoadedUrlRef = useRef<string | null>(null);
  const [sessionSetDrafts, setSessionSetDrafts] = useState<
    Record<string, SessionSetDraft>
  >({});
  const initializedDraftSessionRef = useRef<string | null>(null);
  const activeWorkoutSession =
    activeSession &&
    selectedWorkout &&
    activeSession.workoutId === selectedWorkout.id
      ? activeSession
      : null;

  const initializeSessionDrafts = useCallback(
    async (sessionId: string, workout: Workout, studentId: string) => {
      const exerciseNames = (workout.data.exercises || [])
        .map((exercise) => exercise.name)
        .filter(Boolean);

      const [savedLogs, latestLogs, localDrafts] = await Promise.all([
        getSessionExerciseLogs(sessionId),
        getLatestExerciseLogs(studentId, exerciseNames),
        loadWorkoutSessionDrafts(sessionId),
      ]);

      const savedLogMap = new Map(
        savedLogs.map((log) => [
          buildSessionSetKey(log.exerciseIndex, log.setIndex),
          log,
        ]),
      );
      const nextDrafts: Record<string, SessionSetDraft> = {};

      (workout.data.exercises || []).forEach((exercise, exerciseIndex) => {
        const sets = normalizeExerciseSets(exercise);
        const latestBySet = latestLogs[exercise.name] || {};

        sets.forEach((set, setIndex) => {
          const key = buildSessionSetKey(exerciseIndex, setIndex);
          const savedLog = savedLogMap.get(key);
          const localDraft = localDrafts[key];
          const latest = latestBySet[setIndex];
          const latestLoad = latest?.load ?? null;
          const initialLoad =
            localDraft?.load ??
            (savedLog?.load != null
              ? String(savedLog.load)
              : latestLoad != null
                ? String(latestLoad)
                : "");

          nextDrafts[key] = {
            load: initialLoad,
            performedReps:
              localDraft?.performedReps ??
              (savedLog?.performedReps != null
                ? String(savedLog.performedReps)
                : ""),
            completed: localDraft?.completed ?? savedLog?.completed ?? false,
            lastLoad: latestLoad != null ? String(latestLoad) : undefined,
          };
        });
      });

      initializedDraftSessionRef.current = sessionId;
      setSessionSetDrafts(nextDrafts);
    },
    [],
  );

  const updateSessionSetDraft = useCallback(
    (exerciseIndex: number, setIndex: number, patch: Partial<SessionSetDraft>) => {
      const key = buildSessionSetKey(exerciseIndex, setIndex);
      setSessionSetDrafts((prev) => {
        const currentDraft = prev[key] || {
          load: "",
          performedReps: "",
          completed: false,
        };
        const nextDraft: SessionSetDraft = {
          ...currentDraft,
          ...patch,
        };

        if (
          patch.load !== undefined ||
          patch.performedReps !== undefined ||
          patch.completed !== undefined
        ) {
          if (!canCompleteSessionSet(nextDraft)) {
            nextDraft.completed = false;
          }
        }

        return {
          ...prev,
          [key]: nextDraft,
        };
      });
    },
    [],
  );

  const getSessionSetDraft = useCallback(
    (exerciseIndex: number, setIndex: number) =>
      sessionSetDrafts[buildSessionSetKey(exerciseIndex, setIndex)] || {
        load: "",
        performedReps: "",
        completed: false,
      },
    [sessionSetDrafts],
  );

  const copyPreviousLoad = useCallback(
    (exerciseIndex: number, setIndex: number) => {
      if (setIndex <= 0) return;
      const previous = getSessionSetDraft(exerciseIndex, setIndex - 1);
      if (!previous.load) return;
      updateSessionSetDraft(exerciseIndex, setIndex, { load: previous.load });
    },
    [getSessionSetDraft, updateSessionSetDraft],
  );

  const copyPreviousReps = useCallback(
    (exerciseIndex: number, setIndex: number) => {
      if (setIndex <= 0) return;
      const previous = getSessionSetDraft(exerciseIndex, setIndex - 1);
      if (!previous.performedReps) return;
      updateSessionSetDraft(exerciseIndex, setIndex, {
        performedReps: previous.performedReps,
      });
    },
    [getSessionSetDraft, updateSessionSetDraft],
  );

  const adjustLoad = useCallback(
    (exerciseIndex: number, setIndex: number, delta: number) => {
      const current = parseDecimalInput(
        getSessionSetDraft(exerciseIndex, setIndex).load || "",
      );
      const nextValue = Math.max(
        0,
        Number(((current || 0) + delta).toFixed(2)),
      );
      updateSessionSetDraft(exerciseIndex, setIndex, {
        load: normalizeLoadDraftValue(String(nextValue)),
      });
    },
    [getSessionSetDraft, updateSessionSetDraft],
  );

  const buildSessionLogPayload = useCallback(() => {
    if (!activeWorkoutSession || !selectedWorkout || !user) return [];

    const payload: WorkoutSetLog[] = [];

    (selectedWorkout.data.exercises || []).forEach((exercise, exerciseIndex) => {
      const sets = normalizeExerciseSets(exercise);

      sets.forEach((set, setIndex) => {
        const draft = getSessionSetDraft(exerciseIndex, setIndex);
        const hasMeaningfulData = Boolean(
          draft.load || draft.performedReps || draft.completed,
        );

        if (!hasMeaningfulData) return;

        const visuals = getSetVisuals(set);

        payload.push({
          workoutHistoryId: activeWorkoutSession.id,
          studentId: user.id,
          workoutId: selectedWorkout.id,
          exerciseIndex,
          exerciseName: exercise.name,
          setIndex,
          setType: set.type,
          setLabel: visuals.label,
          targetReps: set.reps,
          prescribedLoad: set.load,
          performedReps:
            draft.performedReps !== "" ? Number(draft.performedReps) : null,
          load: parseDecimalInput(draft.load),
          completed: draft.completed,
        });
      });
    });

    return payload;
  }, [activeWorkoutSession, getSessionSetDraft, selectedWorkout, user]);

  const persistCurrentSessionLogs = useCallback(async () => {
    const payload = buildSessionLogPayload();
    if (!payload.length) return;
    await saveSessionExerciseLogs(payload);
  }, [buildSessionLogPayload]);

  const clearCurrentSessionDraftState = useCallback(async () => {
    const sessionId = activeWorkoutSession?.id;
    initializedDraftSessionRef.current = null;
    setSessionSetDrafts({});
    if (sessionId) {
      await clearWorkoutSessionDrafts(sessionId);
    }
  }, [activeWorkoutSession?.id]);

  const clearPreviewPlayer = useCallback(async () => {
    previewPlayer.pause();
    try {
      await previewPlayer.replaceAsync(null);
    } catch {}
  }, [previewPlayer]);

  const clearPreviewFullscreenPlayer = useCallback(async () => {
    previewFullscreenPlayer.pause();
    try {
      await previewFullscreenPlayer.replaceAsync(null);
    } catch {}
    previewFullscreenLoadedUrlRef.current = null;
  }, [previewFullscreenPlayer]);

  const requestClearPreviewPlayer = useCallback(() => {
    previewPlayer.pause();
    void clearPreviewPlayer();
  }, [clearPreviewPlayer, previewPlayer]);

  useEffect(() => {
    if (previewFullscreenIndex == null) {
      setPreviewFullscreenLayout(null);
    }
  }, [previewFullscreenIndex]);

  useEffect(() => {
    if (!user || !activeWorkoutSession || !selectedWorkout) {
      initializedDraftSessionRef.current = null;
      setSessionSetDrafts({});
      return;
    }

    if (initializedDraftSessionRef.current === activeWorkoutSession.id) return;

    void initializeSessionDrafts(
      activeWorkoutSession.id,
      selectedWorkout,
      user.id,
    );
  }, [activeWorkoutSession, initializeSessionDrafts, selectedWorkout, user]);

  useEffect(() => {
    if (!activeWorkoutSession) return;
    void saveWorkoutSessionDrafts(activeWorkoutSession.id, sessionSetDrafts);
  }, [activeWorkoutSession, sessionSetDrafts]);

  const isWide = viewportWidth >= 720;
  const workoutModalScrollY = useRef(new Animated.Value(0)).current;
  const workoutModalHeaderCollapsedHeight = insets.top + 64;
  const workoutModalHeaderExpandedHeight = useMemo(() => {
    const maxAllowed = Math.round(viewportHeight * 0.28);
    return Math.min(
      260,
      Math.max(workoutModalHeaderCollapsedHeight + 96, maxAllowed),
    );
  }, [viewportHeight, workoutModalHeaderCollapsedHeight]);
  const workoutModalHeaderCollapseRange =
    workoutModalHeaderExpandedHeight - workoutModalHeaderCollapsedHeight;
  const workoutModalHeaderHeight = workoutModalScrollY.interpolate({
    inputRange: [0, workoutModalHeaderCollapseRange],
    outputRange: [
      workoutModalHeaderExpandedHeight,
      workoutModalHeaderCollapsedHeight,
    ],
    extrapolate: "clamp",
  });
  const workoutModalHeaderExpandedOpacity = workoutModalScrollY.interpolate({
    inputRange: [0, workoutModalHeaderCollapseRange * 0.6],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });
  const workoutModalHeaderCollapsedOpacity = workoutModalScrollY.interpolate({
    inputRange: [
      workoutModalHeaderCollapseRange * 0.35,
      workoutModalHeaderCollapseRange,
    ],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  const closeWorkoutModal = useCallback(() => {
    debugWorkouts("closeWorkoutModal");
    setSelectedWorkout(null);
    setPreviewActiveVideoIndex(null);
    setPreviewFullscreenIndex(null);
    setPreviewVideoLoading(false);
    requestClearPreviewPlayer();
    void clearPreviewFullscreenPlayer();
  }, [clearPreviewFullscreenPlayer, requestClearPreviewPlayer]);

  const openActiveWorkout = useCallback(async () => {
    debugWorkouts("openActiveWorkout:request", {
      hasActiveSession: !!activeSession,
      activeWorkoutId: activeSession?.workoutId,
      selectedWorkoutId: selectedWorkout?.id,
    });
    if (!activeSession) return;
    if (!activeSession.workoutId) {
      Alert.alert("Erro", "Não foi possível abrir o treino ativo.");
      return;
    }
    if (selectedWorkout?.id === activeSession.workoutId) return;

    const local = workouts.find((w) => w.id === activeSession.workoutId);
    if (local) {
      setSelectedWorkout(local);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("protocols")
        .select("*")
        .eq("id", activeSession.workoutId)
        .single();
      if (error || !data) throw error || new Error("workout_not_found");
      setSelectedWorkout(data);
    } catch {
      Alert.alert("Erro", "Não foi possível abrir o treino ativo.");
    }
  }, [activeSession, selectedWorkout?.id, workouts]);

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const { data: profile } = await supabase
        .from("profiles")
        .select("data")
        .eq("id", user.id)
        .single();

      const status = profile?.data?.status || "ativo";
      if (status !== "ativo" && status !== "active") {
        Alert.alert(
          "Acesso Bloqueado",
          "Sua conta está inativa. Contate seu personal.",
        );
        return;
      }

      const linkedIds = profile?.data?.workoutIds || [];
      const sched = profile?.data?.workoutSchedule || {};
      setSchedule(sched);

      const days = await getWeeklyActivity(user.id);
      setActiveDays(days);

      let query = supabase
        .from("protocols")
        .select("*")
        .eq("type", "workout")
        .eq("status", "active");

      if (linkedIds.length > 0) {
        query = query.or(
          `student_id.eq.${user.id},id.in.(${linkedIds.join(",")})`,
        );
      } else {
        query = query.eq("student_id", user.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      setWorkouts(orderWorkoutsByIds(data || [], linkedIds));
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleStartSession = async (w: Workout) => {
    try {
      if (!user) return;

      debugWorkouts("handleStartSession:request", {
        workoutId: w.id,
        workoutTitle: w.title,
        hasActiveSession: !!activeSession,
        todayIndex: new Date().getDay(),
      });

      const todayIndex = new Date().getDay();
      const blockReason = getStartWorkoutBlockReason({
        activeDays,
        todayIndex,
        hasActiveSession: !!activeSession,
      });
      if (blockReason === "already_trained_today") {
        debugWorkouts("handleStartSession:blocked", { reason: blockReason });
        Alert.alert("Descanso", "Você já treinou hoje! Volte amanhã. 💪");
        return;
      }
      if (blockReason === "active_session") {
        debugWorkouts("handleStartSession:blocked", { reason: blockReason });
        Alert.alert(
          "Treino em andamento",
          "Você já tem um treino ativo. Finalize o treino atual para iniciar outro.",
          [
            { text: "Cancelar", style: "cancel" },
            {
              text: "Abrir treino ativo",
              onPress: () => void openActiveWorkout(),
            },
          ],
        );
        return;
      }

      const session = await startSession(w.id, w.title, user.id);
      await setActiveSessionFromDbSession(session);
      setSelectedWorkout(w);
      debugWorkouts("handleStartSession:started", { sessionId: session.id });
    } catch (error) {
      debugWorkouts("handleStartSession:error");
      Alert.alert("Erro", "Não foi possível iniciar o treino.");
    }
  };

  // Agrupamento: a ordem dos blocos segue a ordem manual dos treinos
  const workoutsByDay = (() => {
    const groups = new Map<string, Workout[]>();

    workouts.forEach((workout) => {
      const normalizedDays = normalizeWorkoutDays(schedule?.[workout.id]);
      normalizedDays.forEach((dayKey) => {
        if (!groups.has(dayKey)) groups.set(dayKey, []);
        groups.get(dayKey)!.push(workout);
      });
    });

    return Array.from(groups.entries()).map(([dayKey, dayWorkouts]) => ({
      dayKey,
      label: DAYS_MAP[dayKey],
      workouts: dayWorkouts,
    }));
  })();

  const unscheduledWorkouts = workouts.filter((w) => {
    return normalizeWorkoutDays(schedule?.[w.id]).length === 0;
  });

  const openWorkout = useCallback(
    async (w: Workout) => {
      if (!user) return;

      setWorkoutLoading(true);
      try {
        setSelectedWorkout(w);
        const isTrainingFinished = await getTrainingIsFinished(user.id, w.id);
        setIsTraningFinished(isTrainingFinished);
      } catch {
        Alert.alert("Erro", "Não foi possível abrir o treino.");
      } finally {
        setWorkoutLoading(false);
      }
    },
    [user, setSelectedWorkout, setIsTraningFinished],
  );

  const getYoutubeThumbnail = useCallback((url?: string) => {
    if (!url) return null;
    const id = getYoutubeId(url);
    return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
  }, []);

  const ensurePreviewThumbnail = useCallback(
    async (index: number, video: string) => {
      if (previewThumbnailsCache.current[index]) return;
      if (previewThumbProcessing.current[index]) return;
      previewThumbProcessing.current[index] = true;
      try {
        let uri: string | null = null;
        if (isMp4Url(video)) {
          try {
            const result = await VideoThumbnails.getThumbnailAsync(video, {
              time: 1000,
            });
            uri = result.uri;
          } catch {}
        } else {
          uri = getYoutubeThumbnail(video);
        }
        if (!uri) uri = "https://via.placeholder.com/300x200.png?text=Video";
        previewThumbnailsCache.current[index] = uri;
        setPreviewThumbnails((prev) => ({ ...prev, [index]: uri as string }));
      } finally {
        previewThumbProcessing.current[index] = false;
      }
    },
    [getYoutubeThumbnail],
  );

  const previewViewabilityConfig = useMemo(
    () => ({ itemVisiblePercentThreshold: 35 }),
    [],
  );
  const onPreviewViewableItemsChanged = useCallback(
    ({
      viewableItems,
    }: {
      viewableItems: Array<{
        index: number | null;
        item: Exercise;
        isViewable?: boolean;
      }>;
    }) => {
      viewableItems.forEach((v) => {
        if (v.index == null) return;
        const video = v.item.videoUrl || v.item.video_url;
        if (!video) return;
        void ensurePreviewThumbnail(v.index, video);
      });

      if (
        !activeSession ||
        !selectedWorkout ||
        activeSession.workoutId !== selectedWorkout.id
      ) {
        return;
      }
      const visible = viewableItems.filter(
        (v) =>
          v.index != null &&
          (v.isViewable === undefined || v.isViewable === true),
      );
      const top = visible[0];
      if (!top?.item || top.index == null) return;
      const label = getPrimaryExerciseTypeLabel(top.item);
      void updateCurrentExercise(top.item.name, label);
    },
    [
      activeSession,
      selectedWorkout,
      ensurePreviewThumbnail,
      updateCurrentExercise,
    ],
  );

  useEffect(() => {
    setPreviewActiveVideoIndex(null);
    setPreviewFullscreenIndex(null);
    setPreviewVideoLoading(false);
    setPreviewThumbnails({});
    previewThumbnailsCache.current = {};
    previewThumbProcessing.current = {};
    requestClearPreviewPlayer();
    void clearPreviewFullscreenPlayer();
  }, [clearPreviewFullscreenPlayer, requestClearPreviewPlayer, selectedWorkout?.id]);

  useEffect(() => {
    const sub = previewPlayer.addListener("statusChange", (status) => {
      if (status.status === "loading") setPreviewVideoLoading(true);
      if (status.status === "readyToPlay") setPreviewVideoLoading(false);
      if (status.status === "error") setPreviewVideoLoading(false);
    });
    return () => sub.remove();
  }, [previewPlayer]);

  const previewVideoUrl = useMemo(() => {
    if (!selectedWorkout || previewActiveVideoIndex == null) return null;
    const ex = selectedWorkout.data.exercises[previewActiveVideoIndex];
    return ex?.videoUrl || ex?.video_url || null;
  }, [previewActiveVideoIndex, selectedWorkout]);

  const previewMp4Url = useMemo(() => {
    if (!previewVideoUrl) return null;
    return isMp4Url(previewVideoUrl) ? previewVideoUrl : null;
  }, [previewVideoUrl]);

  const previewFullscreenVideoUrl = useMemo(() => {
    if (!selectedWorkout || previewFullscreenIndex == null) return null;
    const ex = selectedWorkout.data.exercises[previewFullscreenIndex];
    return ex?.videoUrl || ex?.video_url || null;
  }, [previewFullscreenIndex, selectedWorkout]);

  const previewFullscreenMp4Url = useMemo(() => {
    if (!previewFullscreenVideoUrl) return null;
    return isMp4Url(previewFullscreenVideoUrl) ? previewFullscreenVideoUrl : null;
  }, [previewFullscreenVideoUrl]);

  useMp4PreviewVideo({
    player: previewPlayer as any,
    mp4Url: previewMp4Url,
    setLoading: setPreviewVideoLoading,
    debug: (message, data) =>
      debugWorkouts(message, {
        ...data,
        workoutId: selectedWorkout?.id,
        index: previewActiveVideoIndex,
        hasVideo: !!previewVideoUrl,
      }),
  });

  useEffect(() => {
    const syncFullscreenMp4 = async () => {
      if (!previewFullscreenMp4Url || previewFullscreenIndex == null) {
        await clearPreviewFullscreenPlayer();
        return;
      }

      try {
        if (previewFullscreenLoadedUrlRef.current !== previewFullscreenMp4Url) {
          previewFullscreenLoadedUrlRef.current = previewFullscreenMp4Url;
          await previewFullscreenPlayer.replaceAsync({ uri: previewFullscreenMp4Url });
        }
        previewFullscreenPlayer.muted = !!previewPlayer.muted;
        previewFullscreenPlayer.volume = Number.isFinite(previewPlayer.volume)
          ? previewPlayer.volume
          : 1;
        previewFullscreenPlayer.currentTime = Number.isFinite(previewPlayer.currentTime)
          ? previewPlayer.currentTime
          : 0;
        if (previewPlayer.playing) previewFullscreenPlayer.play();
        else previewFullscreenPlayer.pause();
        previewPlayer.pause();
      } catch {
        setPreviewVideoLoading(false);
      }
    };

    void syncFullscreenMp4();
  }, [
    clearPreviewFullscreenPlayer,
    previewFullscreenIndex,
    previewFullscreenMp4Url,
    previewFullscreenPlayer,
    previewPlayer,
  ]);

  const closePreviewFullscreen = useCallback(() => {
    const syncBackToInline = async () => {
      if (previewFullscreenMp4Url) {
        try {
          const nextMuted = !!previewFullscreenPlayer.muted;
          const nextVolume = Number.isFinite(previewFullscreenPlayer.volume)
            ? previewFullscreenPlayer.volume
            : 1;
          const nextTime = Number.isFinite(previewFullscreenPlayer.currentTime)
            ? previewFullscreenPlayer.currentTime
            : previewPlayer.currentTime;
          const wasPlaying = !!previewFullscreenPlayer.playing;

          setPreviewVideoLoading(true);
          previewPlayer.pause();
          await previewPlayer.replaceAsync({ uri: previewFullscreenMp4Url });
          previewPlayer.muted = nextMuted;
          previewPlayer.volume = nextVolume;
          previewPlayer.currentTime = nextTime;
          if (wasPlaying) previewPlayer.play();
          else previewPlayer.pause();
          setPreviewInlineSurfaceVersion((v) => v + 1);
        } catch {
          setPreviewVideoLoading(false);
        }
        await clearPreviewFullscreenPlayer();
      }

      setPreviewFullscreenIndex(null);
      setPreviewVideoLoading(false);
    };

    void syncBackToInline();
  }, [
    clearPreviewFullscreenPlayer,
    previewFullscreenMp4Url,
    previewFullscreenPlayer,
    previewPlayer,
  ]);

  useEffect(() => {
    if (openActive !== "1") return;
    if (!activeSession) return;
    if (trainingLoading) return;
    void openActiveWorkout();
  }, [activeSession, openActive, openActiveWorkout, trainingLoading]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Seus Treinos</Text>
          <Text style={styles.dateText}>
            {new Date().toLocaleDateString("pt-BR", {
              weekday: "long",
              day: "numeric",
            })}
          </Text>
        </View>

        {!!activeSession && (
          <View style={styles.activeBanner}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.activeBannerTitle} numberOfLines={1}>
                Treino em andamento
              </Text>
              <Text style={styles.activeBannerSubtitle} numberOfLines={2}>
                {isPaused ? "Pausado · " : ""}
                {activeSession.workoutTitle} •{" "}
                {formatElapsedTime(elapsedSeconds)}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.activeBannerButton}
              onPress={() => void openActiveWorkout()}
            >
              <Text style={styles.activeBannerButtonText}>Abrir</Text>
            </TouchableOpacity>
          </View>
        )}

        {loading && (
          <ActivityIndicator
            size="large"
            color="#3b82f6"
            style={{ marginTop: 20 }}
          />
        )}

        {!loading && workouts.length === 0 && (
          <View style={styles.emptyState}>
            <Dumbbell size={48} color="#cbd5e1" />
            <Text style={styles.emptyText}>Nenhum treino encontrado.</Text>
          </View>
        )}

        {workoutsByDay.map((group) => (
          <View key={group.dayKey} style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>{group.label}</Text>
                {group.workouts[0]?.data.goal && (
                  <Text style={styles.sectionSubtitle}>
                    Foco:{" "}
                    <Text style={{ color: "#3b82f6", fontWeight: "bold" }}>
                      {group.workouts[0].data.goal}
                    </Text>
                  </Text>
                )}
              </View>
              <View style={styles.countBadge}>
                <Text style={styles.countText}>
                  {group.workouts.length}{" "}
                  {group.workouts.length === 1 ? "treino" : "treinos"}
                </Text>
              </View>
            </View>

            {group.workouts.map((w) => (
              <View key={w.id} style={styles.workoutItem}>
                <Text style={styles.workoutTitleItem}>{w.title}</Text>
                <TouchableOpacity onPress={() => openWorkout(w)}>
                  <LinearGradient
                    colors={["#0ea5e9", "#0284c7"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.viewButton}
                  >
                    <Text style={styles.viewButtonText}>VER TREINO</Text>
                    <View style={styles.arrowBox}>
                      <ArrowRight size={14} color="#0ea5e9" />
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ))}

        {unscheduledWorkouts.length > 0 && (
          <View style={{ marginTop: 24 }}>
            <Text style={styles.otherTitle}>Outros Treinos Disponíveis</Text>
            {unscheduledWorkouts.map((w) => (
              <View key={w.id} style={styles.otherCard}>
                <View>
                  <Text style={styles.otherCardTitle}>{w.title}</Text>
                  <Text style={styles.otherCardSub}>
                    {w.data.exercises.length} exercícios
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.otherButton}
                  onPress={() => setSelectedWorkout(w)}
                >
                  <Text style={styles.otherButtonText}>Ver</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Modal de Detalhes Moderno */}
      <Modal
        visible={!!selectedWorkout}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        {selectedWorkout && (
          <SafeAreaView
            style={{ flex: 1, backgroundColor: "#f8fafc" }}
            edges={["bottom"]}
          >
            <Animated.View
              style={[
                styles.workoutModalHeaderContainer,
                { height: workoutModalHeaderHeight },
              ]}
            >
              <LinearGradient
                colors={["#1e3a8a", "#172554"]}
                style={StyleSheet.absoluteFill}
              />

              <View
                style={[
                  styles.workoutModalHeaderInner,
                  { paddingTop: insets.top + 10 },
                ]}
              >
                <Animated.View
                  style={[
                    styles.workoutModalHeaderCollapsed,
                    { opacity: workoutModalHeaderCollapsedOpacity },
                  ]}
                  pointerEvents="box-none"
                >
                  <View style={styles.workoutModalHeaderRow}>
                    <TouchableOpacity
                      onPress={closeWorkoutModal}
                      style={styles.workoutModalBackIconButton}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      testID="workouts-modal-back-collapsed"
                    >
                      <ChevronLeft size={18} color="#fff" />
                    </TouchableOpacity>

                    <Text
                      style={styles.workoutModalCollapsedTitle}
                      numberOfLines={1}
                    >
                      {selectedWorkout.title}
                    </Text>

                    {workoutLoading ? (
                      <View style={styles.workoutModalCompactAction}>
                        <ActivityIndicator color="#fff" />
                      </View>
                    ) : isTraningFinished ? (
                      <View
                        style={[
                          styles.workoutModalCompactAction,
                          styles.workoutModalCompactActionDone,
                        ]}
                      >
                        <CheckCircle size={18} color="#16a34a" />
                      </View>
                    ) : activeSession &&
                      activeSession.workoutId === selectedWorkout.id ? (
                      <TouchableOpacity
                        onPress={
                          isPaused
                            ? () => void resumeTraining()
                            : () => {
                                void pauseTraining();
                                setSelectedWorkout(null);
                              }
                        }
                        testID={
                          isPaused
                            ? "workouts-modal-resume"
                            : "workouts-modal-pause"
                        }
                      >
                        <LinearGradient
                          colors={
                            isPaused
                              ? ["#10b981", "#059669"]
                              : ["#0ea5e9", "#0284c7"]
                          }
                          style={styles.workoutModalCompactAction}
                        >
                          {isPaused ? (
                            <Play size={16} color="#fff" fill="#fff" />
                          ) : (
                            <Clock size={16} color="#fff" />
                          )}
                          <Text style={styles.workoutModalCompactActionText}>
                            {isPaused ? "RETOMAR" : "PAUSAR"}
                          </Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    ) : activeSession ? (
                      <TouchableOpacity
                        onPress={() => void openActiveWorkout()}
                        testID="workouts-modal-open-active"
                      >
                        <LinearGradient
                          colors={["#0ea5e9", "#0284c7"]}
                          style={styles.workoutModalCompactAction}
                        >
                          <Clock size={16} color="#fff" />
                          <Text style={styles.workoutModalCompactActionText}>
                            ATIVO
                          </Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        onPress={() => handleStartSession(selectedWorkout)}
                        testID="workouts-modal-start"
                      >
                        <LinearGradient
                          colors={["#10b981", "#059669"]}
                          style={styles.workoutModalCompactAction}
                        >
                          <Play size={16} color="#fff" fill="#fff" />
                          <Text style={styles.workoutModalCompactActionText}>
                            INICIAR
                          </Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    )}
                  </View>
                </Animated.View>

                <Animated.View
                  style={[
                    styles.workoutModalHeaderExpanded,
                    { opacity: workoutModalHeaderExpandedOpacity },
                  ]}
                  pointerEvents="box-none"
                >
                  <View style={styles.workoutModalHeaderTopRow}>
                    <TouchableOpacity
                      onPress={closeWorkoutModal}
                      style={styles.backButton}
                      testID="workouts-modal-back"
                    >
                      <ChevronLeft size={16} color="#fff" />
                      <Text style={styles.backButtonText}>Voltar</Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.modalTitle} numberOfLines={2}>
                    {selectedWorkout.title}
                  </Text>

                  <View style={styles.modalTags}>
                    {selectedWorkout.data.goal && (
                      <View style={styles.tag}>
                        <Text style={styles.tagText}>
                          {selectedWorkout.data.goal}
                        </Text>
                      </View>
                    )}
                    <View style={styles.tag}>
                      <Text style={styles.tagText}>
                        {selectedWorkout.data.exercises.length} exercícios
                      </Text>
                    </View>
                  </View>
                </Animated.View>
              </View>
            </Animated.View>

            <Animated.FlatList
              data={selectedWorkout.data.exercises}
              keyExtractor={(_, i) => String(i)}
              contentContainerStyle={{
                paddingTop: workoutModalHeaderExpandedHeight + 16,
                paddingHorizontal: 16,
                paddingBottom: 100,
              }}
              scrollEventThrottle={16}
              onScroll={Animated.event(
                [
                  {
                    nativeEvent: { contentOffset: { y: workoutModalScrollY } },
                  },
                ],
                { useNativeDriver: false },
              )}
              viewabilityConfig={previewViewabilityConfig}
              onViewableItemsChanged={onPreviewViewableItemsChanged}
              ListHeaderComponent={
                <View style={styles.workoutModalListHeader}>
                  <LinearGradient
                    colors={["#1e3a8a", "#172554"]}
                    style={styles.workoutModalHeroCard}
                  >
                    <View style={styles.workoutModalHeroTopRow}>
                      <View style={styles.workoutModalHeroIcon}>
                        <Dumbbell size={22} color="#fff" />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.workoutModalHeroTitle}>
                          {selectedWorkout.data.goal
                            ? selectedWorkout.data.goal
                            : "Treino"}
                        </Text>
                        <Text style={styles.workoutModalHeroSubtitle}>
                          {selectedWorkout.data.exercises.length} exercícios
                        </Text>
                      </View>
                    </View>

                    <View style={styles.workoutModalHeroActions}>
                      {workoutLoading ? (
                        <Skeleton />
                      ) : isTraningFinished ? (
                        <View style={styles.doneBadge}>
                          <CheckCircle size={18} color="#16a34a" />
                          <Text style={styles.doneText}>TREINO REALIZADO</Text>
                        </View>
                      ) : activeSession &&
                        activeSession.workoutId === selectedWorkout.id ? (
                        <ActiveWorkoutHeroActions
                          session={activeSession}
                          elapsedSeconds={elapsedSeconds}
                          isPaused={isPaused}
                          beforeFinish={persistCurrentSessionLogs}
                          onFinished={async () => {
                            await clearCurrentSessionDraftState();
                            await clearActiveSession();
                          }}
                          onRequestRefreshDays={async () => {
                            if (!user) return;
                            const days = await getWeeklyActivity(user.id);
                            setActiveDays(days);
                          }}
                          onPause={() => {
                            void pauseTraining();
                            setSelectedWorkout(null);
                          }}
                          onResume={() => void resumeTraining()}
                          onCloseParentModal={() => setSelectedWorkout(null)}
                        />
                      ) : activeSession ? (
                        <TouchableOpacity
                          onPress={() => void openActiveWorkout()}
                        >
                          <LinearGradient
                            colors={["#0ea5e9", "#0284c7"]}
                            style={styles.startButton}
                          >
                            <Clock size={18} color="#fff" />
                            <Text style={styles.startButtonText}>
                              ABRIR TREINO ATIVO
                            </Text>
                          </LinearGradient>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          onPress={() => handleStartSession(selectedWorkout)}
                        >
                          <LinearGradient
                            colors={["#10b981", "#059669"]}
                            style={styles.startButton}
                          >
                            <Play size={18} fill="#fff" color="#fff" />
                            <Text style={styles.startButtonText}>
                              INICIAR TREINO
                            </Text>
                          </LinearGradient>
                        </TouchableOpacity>
                      )}
                    </View>
                  </LinearGradient>

                  {selectedWorkout.data.notes ? (
                    <View style={styles.notesBox}>
                      <MessageSquare
                        size={18}
                        color="#ea580c"
                        style={{ marginTop: 2 }}
                      />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.notesTitle}>
                          Observações Gerais
                        </Text>
                        <Text style={styles.notesText}>
                          {selectedWorkout.data.notes}
                        </Text>
                      </View>
                    </View>
                  ) : null}
                </View>
              }
              renderItem={({ item: ex, index: i }) => {
                const video = ex.videoUrl || ex.video_url;
                const thumb = previewThumbnails[i];
                const playing = previewActiveVideoIndex === i;
                const youtubeId = video ? getYoutubeId(video) : null;
                const suppressInlineVideo = previewFullscreenIndex === i;
                const videoBoxWidth = Math.max(
                  220,
                  Math.min(Math.round(viewportWidth - 64), isWide ? 520 : 420),
                );
                const videoBoxHeight = Math.round((videoBoxWidth * 9) / 16);
                const setsToRender = normalizeExerciseSets(ex);

                return (
                  <View>
                    <Text style={styles.exerciseName} numberOfLines={2}>
                      {ex.name}
                    </Text>
                    <View style={styles.exerciseCard}>
                      {ex.notes && (
                        <View style={styles.exNoteSimple}>
                          <Text style={styles.exNoteText}>{ex.notes}</Text>
                        </View>
                      )}

                      {!!video && !playing && (
                        <TouchableOpacity
                          style={[
                            styles.exerciseVideoBox,
                            { width: videoBoxWidth, height: videoBoxHeight },
                          ]}
                          onPress={() => setPreviewActiveVideoIndex(i)}
                          activeOpacity={0.9}
                          testID={`workouts-video-thumb-${i}`}
                        >
                          {thumb ? (
                            <Image
                              source={{ uri: thumb }}
                              style={{ width: "100%", height: "100%" }}
                              resizeMode="cover"
                            />
                          ) : (
                            <View style={styles.exerciseVideoLoadingBox}>
                              <ActivityIndicator color="#fff" />
                            </View>
                          )}
                          <View style={styles.playOverlaySmall}>
                            <Play size={24} fill="#fff" color="#fff" />
                          </View>
                        </TouchableOpacity>
                      )}

                      {!!video && playing && (
                        <View
                          style={[
                            styles.exerciseVideoBox,
                            { width: videoBoxWidth, height: videoBoxHeight },
                          ]}
                        >
                          {previewVideoLoading && (
                            <View style={styles.inlineThumbLoading}>
                              <ActivityIndicator color="#fff" />
                            </View>
                          )}

                          {!suppressInlineVideo ? (
                            <WorkoutInlineVideo
                              key={`preview-inline-${i}-${previewInlineSurfaceVersion}`}
                              width={videoBoxWidth}
                              height={videoBoxHeight}
                              isMp4={isMp4Url(video)}
                              mp4Player={previewPlayer as any}
                              mp4Url={isMp4Url(video) ? video : null}
                              youtubeId={youtubeId}
                              onRequestClose={() => {
                                setPreviewActiveVideoIndex(null);
                                setPreviewFullscreenIndex(null);
                                setPreviewVideoLoading(false);
                                requestClearPreviewPlayer();
                              }}
                              onRequestFullscreen={() => {
                                debugWorkouts(
                                  "previewVideo:fullscreen_request",
                                  {
                                    index: i,
                                    isMp4: isMp4Url(video),
                                    platform: Platform.OS,
                                  },
                                );
                                setPreviewFullscreenIndex(i);
                              }}
                              compactControls
                              testIDPrefix={`workouts-video-${i}`}
                            />
                          ) : (
                            <View style={styles.inlineThumbBody} />
                          )}
                        </View>
                      )}

                      {setsToRender.length > 0 ? (
                        <View style={{ gap: 10 }}>
                          {setsToRender.map((set, idx) => {
                            const visuals = getSetVisuals(set);
                            const draft = getSessionSetDraft(i, idx);
                            const canCompleteSet = canCompleteSessionSet(draft);

                            if (!activeWorkoutSession) {
                              return (
                                <ExerciseSetCard
                                  key={`${i}-${idx}`}
                                  variant="horizontal"
                                  label={visuals.label}
                                  accentColor={visuals.color}
                                  backgroundColor={visuals.bg}
                                  borderColor={visuals.borderColor}
                                  series={set.series}
                                  reps={set.reps}
                                  load={set.load}
                                  rest={set.rest}
                                  testIDPrefix={`workouts-exercise-${i}-set-${idx}`}
                                />
                              );
                            }

                            return (
                              <View
                                key={`${i}-${idx}`}
                                style={[
                                  styles.sessionSetCard,
                                  {
                                    backgroundColor: visuals.bg,
                                    borderColor: visuals.borderColor,
                                  },
                                ]}
                              >
                                <View style={styles.sessionSetHeader}>
                                  <View style={styles.sessionSetHeaderLeft}>
                                    <View
                                      style={[
                                        styles.sessionSetBadge,
                                        { borderColor: `${visuals.color}33` },
                                      ]}
                                    >
                                      <Text
                                        style={[
                                          styles.sessionSetBadgeText,
                                          { color: visuals.color },
                                        ]}
                                      >
                                        {visuals.label}
                                      </Text>
                                    </View>
                                    <Text style={styles.sessionSetTitle}>
                                      {set.series} x {set.reps}
                                    </Text>
                                  </View>

                                  <TouchableOpacity
                                    onPress={() =>
                                      updateSessionSetDraft(i, idx, {
                                        completed: !draft.completed,
                                      })
                                    }
                                    disabled={!draft.completed && !canCompleteSet}
                                    style={[
                                      styles.sessionCompletePill,
                                      draft.completed
                                        ? styles.sessionCompletePillDone
                                        : styles.sessionCompletePillIdle,
                                      !draft.completed &&
                                      !canCompleteSet &&
                                      styles.sessionCompletePillDisabled,
                                    ]}
                                  >
                                    <CheckCircle
                                      size={15}
                                      color={
                                        draft.completed ? "#15803d" : "#64748b"
                                      }
                                    />
                                    <Text
                                      style={[
                                        styles.sessionCompletePillText,
                                        draft.completed &&
                                          styles.sessionCompletePillTextDone,
                                      ]}
                                    >
                                      {draft.completed ? "Concluída" : "Concluir"}
                                    </Text>
                                  </TouchableOpacity>
                                </View>

                                {set.load ? (
                                  <Text style={styles.sessionSuggestedText}>
                                    Sugerido: {formatLoadLabel(set.load)}
                                  </Text>
                                ) : null}

                                {draft.lastLoad ? (
                                  <Text style={styles.sessionLastLoadText}>
                                    Última carga: {formatLoadLabel(draft.lastLoad)}
                                  </Text>
                                ) : null}

                                <View
                                  style={[
                                    styles.sessionInputGrid,
                                    !isWide && styles.sessionInputGridStacked,
                                  ]}
                                >
                                  <View style={styles.sessionInputBlock}>
                                    <Text style={styles.sessionInputLabel}>
                                      Carga (kg)
                                    </Text>
                                    <View style={styles.sessionInputShell}>
                                      <TextInput
                                        value={draft.load}
                                        onChangeText={(value) =>
                                          updateSessionSetDraft(i, idx, {
                                            load: sanitizeDecimalDraftValue(value),
                                          })
                                        }
                                        onBlur={() =>
                                          updateSessionSetDraft(i, idx, {
                                            load: normalizeLoadDraftValue(
                                              draft.load,
                                            ),
                                          })
                                        }
                                        placeholder={set.load ? String(set.load).replace(".", ",") : "20"}
                                        placeholderTextColor="#94a3b8"
                                        keyboardType={
                                          Platform.OS === "ios"
                                            ? "decimal-pad"
                                            : "numeric"
                                        }
                                        style={styles.sessionInputField}
                                      />
                                      <Text style={styles.sessionInputSuffix}>
                                        kg
                                      </Text>
                                    </View>
                                    <View style={styles.sessionQuickActionsRow}>
                                      {[-2.5, 2.5, 5].map((delta) => (
                                        <TouchableOpacity
                                          key={delta}
                                          onPress={() => adjustLoad(i, idx, delta)}
                                          style={styles.sessionQuickActionButton}
                                        >
                                          <Text
                                            style={styles.sessionQuickActionText}
                                          >
                                            {delta > 0
                                              ? `+${String(delta).replace(".", ",")}`
                                              : String(delta).replace(".", ",")}{" "}
                                            kg
                                          </Text>
                                        </TouchableOpacity>
                                      ))}
                                    </View>
                                  </View>

                                  <View style={styles.sessionInputBlock}>
                                    <Text style={styles.sessionInputLabel}>
                                      Reps feitas
                                    </Text>
                                    <TextInput
                                      value={draft.performedReps}
                                      onChangeText={(value) =>
                                        updateSessionSetDraft(i, idx, {
                                          performedReps: value.replace(/\D/g, ""),
                                        })
                                      }
                                      onBlur={() =>
                                        updateSessionSetDraft(i, idx, {
                                          performedReps:
                                            normalizePerformedRepsDraftValue(
                                              draft.performedReps,
                                            ),
                                        })
                                      }
                                      placeholder={set.reps ? `Meta: ${set.reps}` : "Ex: 12"}
                                      placeholderTextColor="#94a3b8"
                                      keyboardType="number-pad"
                                      style={styles.sessionInputFieldSolo}
                                    />
                                  </View>
                                </View>

                                {!canCompleteSet ? (
                                  <Text style={styles.sessionWarningText}>
                                    Preencha carga e reps para concluir a série.
                                  </Text>
                                ) : null}

                                <View style={styles.sessionActionRow}>
                                  {idx > 0 ? (
                                    <>
                                      <TouchableOpacity
                                        onPress={() => copyPreviousLoad(i, idx)}
                                        style={styles.sessionSecondaryButton}
                                      >
                                        <Text
                                          style={styles.sessionSecondaryButtonText}
                                        >
                                          Copiar carga anterior
                                        </Text>
                                      </TouchableOpacity>
                                      <TouchableOpacity
                                        onPress={() => copyPreviousReps(i, idx)}
                                        style={styles.sessionSecondaryButton}
                                      >
                                        <Text
                                          style={styles.sessionSecondaryButtonText}
                                        >
                                          Copiar reps anterior
                                        </Text>
                                      </TouchableOpacity>
                                    </>
                                  ) : null}
                                </View>

                                {set.rest ? (
                                  <View style={styles.sessionRestRow}>
                                    <Clock size={12} color="#64748b" />
                                    <Text style={styles.sessionRestText}>
                                      Descanso: {set.rest}
                                    </Text>
                                  </View>
                                ) : null}
                              </View>
                            );
                          })}
                        </View>
                      ) : (
                        <Text style={styles.emptySetsText}>Sem séries definidas.</Text>
                      )}
                    </View>
                  </View>
                );
              }}
            />

            {selectedWorkout && previewFullscreenIndex != null ? (
              <View style={styles.previewFullscreenOverlay}>
                <View style={styles.previewFullscreenBackdrop} />
                <View
                  style={[
                    styles.previewFullscreenContent,
                  ]}
                  onLayout={(e) => {
                    const { width: w, height: h } = e.nativeEvent.layout;
                    if (w > 0 && h > 0) {
                      setPreviewFullscreenLayout({ w, h });
                    }
                  }}
                >
                  {previewFullscreenLayout ? (() => {
                    const ex =
                      selectedWorkout.data.exercises[previewFullscreenIndex];
                    const video = ex?.videoUrl || ex?.video_url;
                    if (!video) return null;
                    const youtubeId = !isMp4Url(video)
                      ? getYoutubeId(video)
                      : null;
                    return (
                      <WorkoutInlineVideo
                        width={previewFullscreenLayout.w}
                        height={previewFullscreenLayout.h}
                        isMp4={isMp4Url(video)}
                        mp4Player={
                          (isMp4Url(video)
                            ? previewFullscreenPlayer
                            : previewPlayer) as any
                        }
                        mp4Url={isMp4Url(video) ? video : null}
                        youtubeId={youtubeId}
                        onRequestClose={closePreviewFullscreen}
                        onRequestFullscreen={() => {}}
                        alwaysShowControls
                        showFullscreenButton={false}
                        flatRoot
                        contentVariant="fullscreen"
                        safeAreaInsets={insets}
                        testIDPrefix="workouts-video-fullscreen"
                      />
                    );
                  })() : null}
                </View>
              </View>
            ) : null}
          </SafeAreaView>
        )}
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  scrollContent: { padding: 16 },
  headerRow: {
    flexDirection: "column",
    alignItems: "flex-start",
    marginBottom: 24,
    gap: 4,
  },
  headerTitle: { fontSize: 28, fontWeight: "800", color: "#0f172a" },
  dateText: {
    fontSize: 14,
    color: "#64748b",
    textTransform: "capitalize",
    marginTop: 4,
  },
  emptyState: {
    padding: 40,
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 20,
  },
  emptyText: { color: "#94a3b8", marginTop: 16 },
  activeBanner: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 18,
  },
  activeBannerTitle: { fontSize: 14, fontWeight: "900", color: "#0f172a" },
  activeBannerSubtitle: { fontSize: 12, color: "#64748b", marginTop: 2 },
  activeBannerButton: {
    backgroundColor: "#3b82f6",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
  },
  activeBannerButtonText: { color: "#fff", fontWeight: "900", fontSize: 12 },

  // Cards da Lista
  sectionCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  sectionHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f8fafc", // Padding reduzido
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
    flex: 1,
    marginRight: 8,
  }, // Flex 1 para não empurrar
  sectionSubtitle: { fontSize: 13, color: "#64748b", marginTop: 4 },
  countBadge: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    minWidth: 60,
    alignItems: "center",
  }, // Menor
  countText: { fontSize: 11, fontWeight: "600", color: "#475569" },
  workoutItem: { padding: 16 }, // Padding reduzido
  workoutTitleItem: {
    fontSize: 15,
    color: "#334155",
    marginBottom: 10,
    fontWeight: "500",
  },
  viewButton: {
    padding: 12,
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center", // Menor
  },
  viewButtonText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  arrowBox: {
    backgroundColor: "rgba(255,255,255,0.2)",
    padding: 6,
    borderRadius: 8,
  },

  // Outros
  otherTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#64748b",
    marginBottom: 16,
  },
  otherCard: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 20,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  otherCardTitle: { fontSize: 16, fontWeight: "600", color: "#0f172a" },
  otherCardSub: { fontSize: 12, color: "#64748b" },
  otherButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  otherButtonText: { fontWeight: "700", color: "#0f172a", fontSize: 12 },

  // Modal
  workoutModalHeaderContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    overflow: "hidden",
  },
  workoutModalHeaderInner: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    justifyContent: "center",
  },
  workoutModalHeaderCollapsed: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
  },
  workoutModalHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  workoutModalBackIconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  workoutModalCollapsedTitle: {
    flex: 1,
    minWidth: 0,
    color: "#fff",
    fontWeight: "900",
    fontSize: 16,
    letterSpacing: 0.2,
  },
  workoutModalCompactAction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 12,
    height: 38,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  workoutModalCompactActionText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 12,
    letterSpacing: 0.6,
  },
  workoutModalCompactActionDone: {
    backgroundColor: "#fff",
    borderColor: "rgba(255,255,255,0.22)",
  },
  workoutModalHeaderExpanded: {
    justifyContent: "center",
    gap: 8,
  },
  workoutModalHeaderTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  backButtonText: { color: "#fff", fontWeight: "900", fontSize: 13 },
  modalTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#fff",
  },
  modalTags: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  tag: {
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  tagText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  workoutModalListHeader: { gap: 14, marginBottom: 18 },
  workoutModalHeroCard: {
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  workoutModalHeroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  workoutModalHeroIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  workoutModalHeroTitle: { color: "#fff", fontWeight: "900", fontSize: 14 },
  workoutModalHeroSubtitle: {
    color: "rgba(255,255,255,0.84)",
    marginTop: 2,
    fontSize: 12,
    fontWeight: "700",
  },
  workoutModalHeroActions: { marginTop: 14, alignItems: "center" },
  startButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
    shadowColor: "#10b981",
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 20,
    elevation: 10,
  },
  startButtonText: { color: "#fff", fontWeight: "900", fontSize: 14 },
  doneBadge: {
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 30,
  },
  doneText: { color: "#16a34a", fontWeight: "900", fontSize: 13 },

  // Exercises - Novo Layout Horizontal
  notesBox: {
    backgroundColor: "#fff7ed",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#ffedd5",
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  notesTitle: {
    color: "#ea580c",
    fontWeight: "800",
    fontSize: 12,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  notesText: { color: "#9a3412", fontSize: 14, lineHeight: 20 },

  exerciseCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 12,
    marginBottom: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    shadowColor: "#000",
    shadowOpacity: 0.02,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
    alignItems: "stretch",
  },
  exerciseVideoBox: {
    borderRadius: 14,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#000",
    alignSelf: "center",
  },
  exerciseVideoLoadingBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  playOverlaySmall: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  inlineThumbBody: { flex: 1, position: "relative" },
  inlineThumbLoading: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
    zIndex: 2,
  },
  sessionSetCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    gap: 10,
  },
  sessionSetHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  sessionSetHeaderLeft: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  sessionSetBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#fff",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  sessionSetBadgeText: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.4,
  },
  sessionSetTitle: {
    color: "#0f172a",
    fontWeight: "900",
    fontSize: 15,
  },
  sessionCompletePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
  },
  sessionCompletePillIdle: {
    backgroundColor: "rgba(255,255,255,0.76)",
    borderColor: "#cbd5e1",
  },
  sessionCompletePillDone: {
    backgroundColor: "#dcfce7",
    borderColor: "#86efac",
  },
  sessionCompletePillDisabled: {
    opacity: 0.55,
  },
  sessionCompletePillText: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "800",
  },
  sessionCompletePillTextDone: {
    color: "#166534",
  },
  sessionSuggestedText: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "700",
  },
  sessionLastLoadText: {
    color: "#1d4ed8",
    fontSize: 12,
    fontWeight: "700",
  },
  sessionInputGrid: {
    flexDirection: "row",
    gap: 10,
  },
  sessionInputGridStacked: {
    flexDirection: "column",
  },
  sessionInputBlock: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  sessionInputLabel: {
    fontSize: 11,
    color: "#475569",
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  sessionInputShell: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#fff",
    overflow: "hidden",
    minWidth: 0,
  },
  sessionInputField: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  sessionInputSuffix: {
    paddingHorizontal: 12,
    color: "#64748b",
    fontSize: 12,
    fontWeight: "800",
    borderLeftWidth: 1,
    borderLeftColor: "#e2e8f0",
  },
  sessionInputFieldSolo: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
    minWidth: 0,
  },
  sessionQuickActionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  sessionQuickActionButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  sessionQuickActionText: {
    color: "#1d4ed8",
    fontSize: 12,
    fontWeight: "800",
  },
  sessionWarningText: {
    color: "#b45309",
    fontSize: 12,
    fontWeight: "700",
  },
  sessionActionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  sessionSecondaryButton: {
    borderRadius: 999,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#dbeafe",
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  sessionSecondaryButtonText: {
    color: "#1e3a8a",
    fontSize: 12,
    fontWeight: "800",
  },
  sessionRestRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sessionRestText: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "700",
  },
  emptySetsText: {
    color: "#94a3b8",
    fontStyle: "italic",
  },
  previewFullscreenOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    elevation: 50,
  },
  previewFullscreenBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
  },
  previewFullscreenContent: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    backgroundColor: "#000",
  },

  // Textos Simples
  simpleSetText: {
    fontSize: 13,
    color: "#334155",
    fontWeight: "500",
    marginBottom: 2,
  },
  simpleSetLabel: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "bold",
    textTransform: "uppercase",
    marginRight: 4,
  },

  exerciseName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 8,
  },
  exNoteSimple: {
    backgroundColor: "#fff7ed",
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ffedd5",
  },
  exNoteText: { fontSize: 12, color: "#c2410c", lineHeight: 18 },

});
