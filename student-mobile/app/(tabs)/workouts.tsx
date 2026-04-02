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
  FlatList,
  useWindowDimensions,
} from "react-native";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabase";
import {
  Dumbbell,
  ChevronRight,
  X,
  Clock,
  Play,
  CheckCircle,
  ArrowRight,
  MessageSquare,
  ChevronLeft,
} from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { startSession, getWeeklyActivity } from "../../lib/history";
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
import { useVideoStrings } from "../../lib/videoStrings";
import { useLocalSearchParams } from "expo-router";
import { VideoView, useVideoPlayer } from "expo-video";
import * as VideoThumbnails from "expo-video-thumbnails";
import YoutubePlayer from "react-native-youtube-iframe";
import { getStartWorkoutBlockReason } from "../../lib/workoutStartGuard";

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

const DEBUG_WORKOUTS =
  __DEV__ && process.env.EXPO_PUBLIC_DEBUG_WORKOUTS === "1";

function debugWorkouts(message: string, data?: Record<string, unknown>) {
  if (!DEBUG_WORKOUTS) return;
  if (data) console.log(`[workouts] ${message}`, data);
  else console.log(`[workouts] ${message}`);
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
  const { t: tVideo } = useVideoStrings();
  const {
    activeSession,
    elapsedSeconds,
    loading: trainingLoading,
    setActiveSessionFromDbSession,
    clearActiveSession,
  } = useTrainingSession();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [schedule, setSchedule] = useState<Record<string, string[]>>({});
  const [activeDays, setActiveDays] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null);

  const [previewActiveVideoIndex, setPreviewActiveVideoIndex] = useState<
    number | null
  >(null);
  const [previewFullscreenIndex, setPreviewFullscreenIndex] = useState<
    number | null
  >(null);
  const [previewVideoLoading, setPreviewVideoLoading] = useState(false);
  const [previewThumbnails, setPreviewThumbnails] = useState<
    Record<number, string>
  >({});
  const previewThumbnailsCache = useRef<Record<number, string>>({});
  const previewThumbProcessing = useRef<Record<number, boolean>>({});
  const previewPlayer = useVideoPlayer("");
  const previewNativeFullscreenRef = useRef(false);
  const previewPendingClearRef = useRef(false);

  const clearPreviewPlayer = useCallback(async () => {
    previewPlayer.pause();
    try {
      await previewPlayer.replaceAsync(null);
    } catch {}
  }, [previewPlayer]);

  const requestClearPreviewPlayer = useCallback(() => {
    if (previewNativeFullscreenRef.current) {
      previewPendingClearRef.current = true;
      previewPlayer.pause();
      return;
    }
    previewPendingClearRef.current = false;
    void clearPreviewPlayer();
  }, [clearPreviewPlayer, previewPlayer]);

  const isWide = viewportWidth >= 720;

  const closeWorkoutModal = useCallback(() => {
    debugWorkouts("closeWorkoutModal");
    setSelectedWorkout(null);
    setPreviewActiveVideoIndex(null);
    setPreviewFullscreenIndex(null);
    setPreviewVideoLoading(false);
    requestClearPreviewPlayer();
  }, [requestClearPreviewPlayer]);

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
      setWorkouts(data || []);
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

  // Agrupamento
  const workoutsByDay = DAYS_ORDER.map((dayKey) => {
    const workoutIdsForDay: string[] = [];
    Object.entries(schedule).forEach(([wId, days]) => {
      if (Array.isArray(days)) {
        const normalizedDays = days.map((d) => d.toLowerCase());
        if (normalizedDays.includes(dayKey)) workoutIdsForDay.push(wId);
      }
    });
    const dayWorkouts = workouts.filter((w) => workoutIdsForDay.includes(w.id));
    return { dayKey, label: DAYS_MAP[dayKey], workouts: dayWorkouts };
  }).filter((group) => group.workouts.length > 0);

  const unscheduledWorkouts = workouts.filter((w) => {
    const days = schedule ? schedule[w.id] : undefined;
    return !days || !Array.isArray(days) || days.length === 0;
  });

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
  const onPreviewViewableItemsChanged = useRef(
    ({
      viewableItems,
    }: {
      viewableItems: Array<{ index: number | null; item: Exercise }>;
    }) => {
      viewableItems.forEach((v) => {
        if (v.index == null) return;
        const video = v.item.videoUrl || v.item.video_url;
        if (!video) return;
        void ensurePreviewThumbnail(v.index, video);
      });
    },
  );

  useEffect(() => {
    setPreviewActiveVideoIndex(null);
    setPreviewFullscreenIndex(null);
    setPreviewVideoLoading(false);
    setPreviewThumbnails({});
    previewThumbnailsCache.current = {};
    previewThumbProcessing.current = {};
    requestClearPreviewPlayer();
  }, [requestClearPreviewPlayer, selectedWorkout?.id]);

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
              <Text style={styles.activeBannerSubtitle} numberOfLines={1}>
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
                <TouchableOpacity onPress={() => setSelectedWorkout(w)}>
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
          <View style={{ flex: 1, backgroundColor: "#f8fafc" }}>
            {/* Header Azul Escuro */}
            <LinearGradient
              colors={["#1e3a8a", "#172554"]}
              style={styles.modalHeader}
            >
              <TouchableOpacity
                onPress={closeWorkoutModal}
                style={styles.backButton}
              >
                <ChevronLeft size={16} color="#fff" />
                <Text style={{ color: "#fff", fontWeight: "bold" }}>
                  Voltar
                </Text>
              </TouchableOpacity>

              <Text style={styles.modalTitle}>{selectedWorkout.title}</Text>

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

              <View style={styles.modalHero}>
                <View style={styles.heroIcon}>
                  <Dumbbell size={32} color="#fff" />
                </View>

                {activeDays.includes(new Date().getDay()) ? (
                  <View style={styles.doneBadge}>
                    <CheckCircle size={20} color="#16a34a" />
                    <Text style={styles.doneText}>TREINO REALIZADO</Text>
                  </View>
                ) : activeSession &&
                  activeSession.workoutId === selectedWorkout.id ? (
                  <ActiveWorkoutHeroActions
                    session={activeSession}
                    elapsedSeconds={elapsedSeconds}
                    onFinished={async () => {
                      await clearActiveSession();
                    }}
                    onRequestRefreshDays={async () => {
                      if (!user) return;
                      const days = await getWeeklyActivity(user.id);
                      setActiveDays(days);
                    }}
                    onPause={() => setSelectedWorkout(null)}
                    onCloseParentModal={() => setSelectedWorkout(null)}
                  />
                ) : activeSession ? (
                  <TouchableOpacity onPress={() => void openActiveWorkout()}>
                    <LinearGradient
                      colors={["#0ea5e9", "#0284c7"]}
                      style={styles.startButton}
                    >
                      <Clock size={20} color="#fff" />
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
                      <Play size={20} fill="#fff" color="#fff" />
                      <Text style={styles.startButtonText}>INICIAR TREINO</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                )}
              </View>
            </LinearGradient>

            <FlatList
              data={selectedWorkout.data.exercises}
              keyExtractor={(_, i) => String(i)}
              contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
              viewabilityConfig={previewViewabilityConfig}
              onViewableItemsChanged={onPreviewViewableItemsChanged.current}
              ListHeaderComponent={
                selectedWorkout.data.notes ? (
                  <View style={styles.notesBox}>
                    <MessageSquare
                      size={18}
                      color="#ea580c"
                      style={{ marginTop: 2 }}
                    />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.notesTitle}>Observações Gerais</Text>
                      <Text style={styles.notesText}>
                        {selectedWorkout.data.notes}
                      </Text>
                    </View>
                  </View>
                ) : null
              }
              renderItem={({ item: ex, index: i }) => {
                const video = ex.videoUrl || ex.video_url;
                const thumb = previewThumbnails[i];
                const playing = previewActiveVideoIndex === i;
                const youtubeId = video ? getYoutubeId(video) : null;
                const suppressInlineVideo = previewFullscreenIndex === i;
                const videoBoxWidth = Math.max(
                  140,
                  Math.round(viewportWidth * 0.5),
                );
                const videoBoxHeight = Math.round((videoBoxWidth * 16) / 9);

                const setsToRender: ExerciseSet[] = (() => {
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
                })();

                return (
                  <View>
                    <Text style={styles.exerciseName} numberOfLines={2}>
                      {ex.name}
                    </Text>
                    <View style={styles.exerciseCard}>
                      <View style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
                        <View style={{ gap: 6 }}>
                          {setsToRender.map((set, idx) => {
                            let color = "#334155";
                            let bg = "transparent";
                            let borderColor = "transparent";
                            let label = "";

                            if (set.type === "warmup") {
                              color = "#ea580c";
                              bg = "#fff7ed";
                              borderColor = "#ffedd5";
                              label = "AQUECIMENTO";
                            } else if (set.type === "working") {
                              color = "#16a34a";
                              bg = "#f0fdf4";
                              borderColor = "#dcfce7";
                              label = "TRABALHO";
                            } else if (set.type === "feeder") {
                              color = "#0284c7";
                              bg = "#f0f9ff";
                              borderColor = "#e0f2fe";
                              label = "PREPARAÇÃO";
                            } else if (set.type === "topset") {
                              color = "#4f46e5";
                              bg = "#eef2ff";
                              borderColor = "#e0e7ff";
                              label = "TOP SET";
                            } else {
                              color = "#475569";
                              bg = "#f8fafc";
                              borderColor = "#e2e8f0";
                              label = set.customLabel || "OUTRO";
                            }

                            return (
                              <ExerciseSetCard
                                key={`${i}-${idx}`}
                                variant={video ? "stacked" : "horizontal"}
                                label={label}
                                accentColor={color}
                                backgroundColor={bg}
                                borderColor={borderColor}
                                series={set.series}
                                reps={set.reps}
                                load={set.load}
                                rest={set.rest}
                                testIDPrefix={`workouts-exercise-${i}-set-${idx}`}
                              />
                            );
                          })}
                        </View>

                        {ex.notes && (
                          <View style={styles.exNoteSimple}>
                            <Text style={styles.exNoteText}>{ex.notes}</Text>
                          </View>
                        )}
                      </View>

                      {!!video && !playing && (
                        <TouchableOpacity
                          style={[
                            styles.thumbBoxSmall,
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
                            <View
                              style={{
                                flex: 1,
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
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
                            styles.inlineThumbBox,
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
                              onNativeFullscreenChange={(isFullscreen) => {
                                previewNativeFullscreenRef.current =
                                  isFullscreen;
                                if (
                                  !isFullscreen &&
                                  previewPendingClearRef.current
                                ) {
                                  previewPendingClearRef.current = false;
                                  void clearPreviewPlayer();
                                }
                              }}
                              testIDPrefix={`workouts-video-${i}`}
                            />
                          ) : (
                            <View style={styles.inlineThumbBody} />
                          )}
                        </View>
                      )}
                    </View>
                  </View>
                );
              }}
            />
          </View>
        )}
      </Modal>

      <Modal
        visible={previewFullscreenIndex != null}
        animationType="slide"
        presentationStyle="fullScreen"
      >
        <View style={{ flex: 1, backgroundColor: "#000" }}>
          <View style={styles.videoHeader}>
            <Text style={{ color: "#fff", fontWeight: "bold" }}>Vídeo</Text>
            <TouchableOpacity
              onPress={() => setPreviewFullscreenIndex(null)}
              style={styles.videoHeaderClose}
              accessibilityRole="button"
              accessibilityLabel={tVideo("close")}
            >
              <X color="#fff" size={24} />
            </TouchableOpacity>
          </View>

          {selectedWorkout && previewFullscreenIndex != null ? (
            (() => {
              const ex = selectedWorkout.data.exercises[previewFullscreenIndex];
              const video = ex?.videoUrl || ex?.video_url;
              if (!video) return null;
              const youtubeId = !isMp4Url(video) ? getYoutubeId(video) : null;

              if (isMp4Url(video)) {
                return (
                  <VideoView
                    player={previewPlayer}
                    style={{ flex: 1 }}
                    fullscreenOptions={{ enable: true, orientation: "default" }}
                    nativeControls
                  />
                );
              }

              if (Platform.OS === "web" && youtubeId) {
                return (
                  <iframe
                    src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1`}
                    style={{ width: "100%", height: "100%", border: "none" }}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                );
              }

              return (
                <View
                  style={{
                    flex: 1,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <YoutubePlayer
                    height={Math.max(
                      200,
                      Math.min(
                        viewportHeight - 72,
                        Math.round((Math.min(viewportWidth, 960) * 9) / 16),
                      ),
                    )}
                    width={Math.min(viewportWidth, 960)}
                    play
                    videoId={youtubeId || undefined}
                    initialPlayerParams={{
                      controls: true,
                      preventFullScreen: true,
                    }}
                    onReady={() => setPreviewVideoLoading(false)}
                    onError={() => setPreviewVideoLoading(false)}
                  />
                </View>
              );
            })()
          ) : (
            <View style={{ flex: 1 }} />
          )}
        </View>
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
  modalHeader: { padding: 20, paddingBottom: 30 },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 12,
  },
  modalTags: { flexDirection: "row", gap: 8, flexWrap: "wrap" }, // Adicionado flexWrap
  tag: {
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  tagText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  modalHero: { marginTop: 20, alignItems: "center", gap: 16 },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  startButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 16,
    shadowColor: "#10b981",
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 20,
    elevation: 10,
  },
  startButtonText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  doneBadge: {
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 30,
  },
  doneText: { color: "#16a34a", fontWeight: "700", fontSize: 14 },

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
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
    flexDirection: "row",
    gap: 8,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    shadowColor: "#000",
    shadowOpacity: 0.02,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
    alignItems: "stretch",
  },
  // Thumb Pequena Direita
  thumbBoxSmall: {
    width: 120,
    height: 214,
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#000",
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
  inlineThumbBox: {
    width: 120,
    height: 214,
    backgroundColor: "#000",
    borderRadius: 12,
    overflow: "hidden",
  },
  inlineThumbHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 6,
    paddingVertical: 0,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  inlineThumbButton: {
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  inlineThumbButtonText: { color: "#fff", fontWeight: "800", fontSize: 10 },
  inlineThumbBody: { flex: 1, position: "relative" },
  inlineThumbVideo: { width: "100%", height: "100%" },
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
    marginTop: 8,
    backgroundColor: "#fff7ed",
    padding: 8,
    borderRadius: 8,
  },
  exNoteText: { fontSize: 12, color: "#c2410c" },

  videoHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  videoHeaderClose: {
    minWidth: 44,
    minHeight: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
});
