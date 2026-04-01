import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase";
import { finishSession } from "../lib/history";
import { ActiveTrainingSession, formatElapsedTime } from "../lib/trainingSession";
import { VideoView, useVideoPlayer } from "expo-video";
import * as VideoThumbnails from "expo-video-thumbnails";
import YoutubePlayer from "react-native-youtube-iframe";
import {
  CheckCircle,
  Clock,
  MessageSquare,
  Play,
  StopCircle,
  X,
} from "lucide-react-native";

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
  notes?: string;
  videoUrl?: string;
  video_url?: string;
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
    exercises: Exercise[];
    notes?: string;
  };
};

type Props = {
  visible: boolean;
  session: ActiveTrainingSession;
  elapsedSeconds: number;
  onClose: () => void;
  onFinished: () => Promise<void>;
  onRequestRefreshDays: () => Promise<void>;
};

type ThumbnailMap = Record<number, string>;

function isMp4(url: string) {
  return url?.includes(".mp4") || url?.includes("video");
}

function getYoutubeId(url: string) {
  const match = url.match(/^.*(youtu.be\/|watch\?v=|embed\/|shorts\/)([^#&?]*).*/);
  return match?.[2];
}

function resolveYoutubeThumb(url: string) {
  const id = getYoutubeId(url);
  if (!id) return null;
  return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
}

export default function ActiveTrainingModal({
  visible,
  session,
  elapsedSeconds,
  onClose,
  onFinished,
  onRequestRefreshDays,
}: Props) {
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [loading, setLoading] = useState(true);
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [sessionNotes, setSessionNotes] = useState("");
  const [isFinishing, setIsFinishing] = useState(false);

  const [thumbnails, setThumbnails] = useState<ThumbnailMap>({});
  const thumbnailsCache = useRef<ThumbnailMap>({});
  const processing = useRef<Record<number, boolean>>({});

  const [activeVideoIndex, setActiveVideoIndex] = useState<number | null>(null);
  const [fullscreenIndex, setFullscreenIndex] = useState<number | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);

  const player = useVideoPlayer("");
  const { width } = useWindowDimensions();
  const isWide = width >= 720;

  const ensureThumbnail = useCallback(
    async (index: number, video: string) => {
      if (thumbnailsCache.current[index]) return;
      if (processing.current[index]) return;
      processing.current[index] = true;
      try {
        let uri: string | null = null;
        if (isMp4(video)) {
          try {
            const result = await VideoThumbnails.getThumbnailAsync(video, { time: 1000 });
            uri = result.uri;
          } catch {}
        } else {
          uri = resolveYoutubeThumb(video);
        }
        if (!uri) uri = "https://via.placeholder.com/300x200.png?text=Video";
        thumbnailsCache.current[index] = uri;
        setThumbnails((prev) => ({ ...prev, [index]: uri }));
      } finally {
        processing.current[index] = false;
      }
    },
    [],
  );

  const viewabilityConfig = useMemo(() => ({ itemVisiblePercentThreshold: 35 }), []);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<{ index: number | null; item: Exercise }> }) => {
      viewableItems.forEach((v) => {
        if (v.index == null) return;
        const ex = v.item;
        const video = ex.videoUrl || ex.video_url;
        if (!video) return;
        ensureThumbnail(v.index, video);
      });
    },
  );

  useEffect(() => {
    if (!visible) return;
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const { data: workoutData, error } = await supabase
          .from("protocols")
          .select("*")
          .eq("id", session.workoutId)
          .single();
        if (error) throw error;
        if (!mounted) return;
        setWorkout(workoutData);
      } catch (e) {
        Alert.alert("Erro", "Não foi possível carregar o treino ativo.");
        onClose();
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [onClose, session.workoutId, visible]);

  useEffect(() => {
    const sub = player.addListener("statusChange", (status) => {
      if (status.status === "loading") setVideoLoading(true);
      if (status.status === "readyToPlay") setVideoLoading(false);
      if (status.status === "error") setVideoLoading(false);
    });
    return () => sub.remove();
  }, [player]);

  const activeVideoUrl = useMemo(() => {
    if (!workout || activeVideoIndex == null) return null;
    const ex = workout.data.exercises[activeVideoIndex];
    if (!ex) return null;
    return ex.videoUrl || ex.video_url || null;
  }, [activeVideoIndex, workout]);

  useEffect(() => {
    const load = async () => {
      if (!activeVideoUrl || !isMp4(activeVideoUrl)) {
        player.pause();
        await player.replaceAsync(null);
        return;
      }
      try {
        setVideoLoading(true);
        await player.replaceAsync({ uri: activeVideoUrl });
        player.play();
      } catch {
        setVideoLoading(false);
      }
    };
    load();
  }, [activeVideoUrl, player]);

  const handleCloseVideo = useCallback(async () => {
    setActiveVideoIndex(null);
    setFullscreenIndex(null);
    setVideoLoading(false);
    player.pause();
    await player.replaceAsync(null);
  }, [player]);

  const handleFinish = useCallback(async () => {
    setIsFinishing(true);
    try {
      await finishSession(session.id, elapsedSeconds, sessionNotes);
      setShowFinishModal(false);
      setIsFinishing(false);
      await handleCloseVideo();
      await onFinished();
      await onRequestRefreshDays();
      setTimeout(() => setShowSuccessModal(true), 250);
    } catch {
      setShowFinishModal(false);
      setIsFinishing(false);
      Alert.alert("Erro", "Não foi possível finalizar o treino, mas tentamos salvar.");
      await onFinished();
    }
  }, [
    elapsedSeconds,
    handleCloseVideo,
    onFinished,
    onRequestRefreshDays,
    session.id,
    sessionNotes,
  ]);

  const isWeb = Platform.OS === "web";
  const renderExercise = ({ item: ex, index: i }: { item: Exercise; index: number }) => {
    const video = ex.videoUrl || ex.video_url;
    const thumb = thumbnails[i];
    const playing = activeVideoIndex === i;
    const showInlineVideo = playing && !!video;

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
      <View style={styles.exerciseCard}>
        <View style={styles.exerciseLeft}>
          <View style={styles.cardHeader}>
            <View style={styles.indexBadge}>
              <Text style={styles.indexText}>{i + 1}</Text>
            </View>
            <Text style={styles.exerciseName} numberOfLines={2}>
              {ex.name}
            </Text>
          </View>

          <View style={styles.setsContainer}>
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
                <View
                  key={`${i}-${idx}`}
                  style={[
                    styles.setBox,
                    { backgroundColor: bg, borderColor: borderColor },
                  ]}
                >
                  <View style={styles.setTopRow}>
                    <View style={styles.setLabelRow}>
                      <View style={styles.setLabelPill}>
                        <Text style={[styles.setLabelText, { color }]}>{label}</Text>
                      </View>
                      <Text style={styles.setDetailsText} numberOfLines={1}>
                        {set.series} x {set.reps}
                      </Text>
                    </View>
                    {!!set.load && (
                      <Text style={styles.setLoadText} numberOfLines={1}>
                        {set.load}
                      </Text>
                    )}
                  </View>

                  {!!set.rest && (
                    <View style={styles.restRow}>
                      <Clock size={14} color="#94a3b8" />
                      <Text style={styles.restText}>{set.rest}</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>

          {!!ex.notes && (
            <View style={styles.noteBox}>
              <MessageSquare size={14} color="#f97316" />
              <Text style={styles.noteText}>{ex.notes}</Text>
            </View>
          )}
        </View>

        <View style={styles.exerciseRight}>
          {!!video && !showInlineVideo && (
            <TouchableOpacity
              style={styles.thumbBox}
              onPress={() => setActiveVideoIndex(i)}
              activeOpacity={0.9}
              testID={`exercise-video-thumb-${i}`}
            >
              {thumb ? (
                <Image source={{ uri: thumb }} style={styles.thumbImage} resizeMode="cover" />
              ) : (
                <View style={styles.thumbLoading}>
                  <ActivityIndicator color="#fff" />
                </View>
              )}
              <View style={styles.playOverlay}>
                <Play size={22} fill="#fff" color="#fff" />
              </View>
            </TouchableOpacity>
          )}

          {!!video && showInlineVideo && (
            <View style={styles.inlineVideoBox} testID={`exercise-video-inline-${i}`}>
              <View style={styles.inlineVideoHeader}>
                <TouchableOpacity
                  style={styles.inlineVideoButton}
                  onPress={() => setFullscreenIndex(i)}
                  testID={`exercise-video-fullscreen-${i}`}
                >
                  <Text style={styles.inlineVideoButtonText}>Tela cheia</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.inlineVideoButton} onPress={handleCloseVideo}>
                  <Text style={styles.inlineVideoButtonText}>Fechar</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.inlineVideoBody}>
                {videoLoading && (
                  <View style={styles.inlineVideoLoading}>
                    <ActivityIndicator color="#fff" />
                  </View>
                )}

                {isMp4(video) ? (
                  <VideoView
                    player={player}
                    style={styles.inlineVideo}
                    allowsFullscreen={false}
                    nativeControls
                  />
                ) : (
                  <>
                    {isWeb ? (
                      <iframe
                        src={`https://www.youtube.com/embed/${getYoutubeId(video)}?autoplay=1`}
                        style={{ width: "100%", height: "100%", border: "none" }}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    ) : (
                      <YoutubePlayer
                        height={styles.inlineVideo.height as number}
                        width={styles.inlineVideo.width as number}
                        play
                        videoId={getYoutubeId(video)}
                        onReady={() => setVideoLoading(false)}
                        onError={() => setVideoLoading(false)}
                      />
                    )}
                  </>
                )}
              </View>
            </View>
          )}
        </View>
      </View>
    );
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>TREINO EM ANDAMENTO</Text>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <X color="#0f172a" size={22} />
            </TouchableOpacity>
          </View>

          <Text style={styles.workoutTitle} numberOfLines={1}>
            {workout?.title || session.workoutTitle}
          </Text>
          <Text style={styles.timerText}>{formatElapsedTime(elapsedSeconds)}</Text>

          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.finishButton} onPress={() => setShowFinishModal(true)}>
              <StopCircle color="#fff" size={18} />
              <Text style={styles.finishButtonText}>FINALIZAR</Text>
            </TouchableOpacity>
          </View>
        </View>

        {loading || !workout ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={{ marginTop: 10, color: "#64748b" }}>Carregando treino...</Text>
          </View>
        ) : (
          <FlatList
            data={workout.data.exercises}
            keyExtractor={(_, i) => String(i)}
            contentContainerStyle={styles.content}
            viewabilityConfig={viewabilityConfig}
            onViewableItemsChanged={onViewableItemsChanged.current}
            ListHeaderComponent={
              workout.data.notes ? (
                <View style={styles.generalNotesBox}>
                  <View style={styles.generalNotesTitleRow}>
                    <MessageSquare size={18} color="#f97316" />
                    <Text style={styles.generalNotesTitle}>OBSERVAÇÕES GERAIS</Text>
                  </View>
                  <Text style={styles.generalNotesText}>{workout.data.notes}</Text>
                </View>
              ) : null
            }
            ListFooterComponent={<View style={{ height: 24 }} />}
            renderItem={renderExercise}
          />
        )}

        <Modal visible={showFinishModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Finalizar treino</Text>
              <Text style={styles.modalSubtitle}>
                Quer deixar um feedback para seu personal? (opcional)
              </Text>

              <TextInput
                style={styles.input}
                value={sessionNotes}
                onChangeText={setSessionNotes}
                placeholder="Escreva aqui..."
                placeholderTextColor="#94a3b8"
                multiline
                textAlignVertical="top"
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setShowFinishModal(false)}
                  disabled={isFinishing}
                >
                  <Text style={styles.cancelText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.confirmButton]}
                  onPress={handleFinish}
                  disabled={isFinishing}
                >
                  {isFinishing ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.confirmText}>Finalizar</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <Modal visible={showSuccessModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.successBox}>
              <View style={styles.successIcon}>
                <CheckCircle size={44} color="#16a34a" />
              </View>
              <Text style={styles.successTitle}>Treino finalizado!</Text>
              <Text style={styles.successSubtitle}>Bom trabalho. Você mandou bem hoje.</Text>
              <TouchableOpacity
                style={styles.successButton}
                onPress={() => {
                  setShowSuccessModal(false);
                  onClose();
                }}
              >
                <Text style={styles.successButtonText}>Voltar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <Modal visible={fullscreenIndex != null} animationType="slide" presentationStyle="fullScreen">
          <SafeAreaView style={{ flex: 1, backgroundColor: "#000" }}>
            <View style={styles.fullscreenHeader}>
              <Text style={styles.fullscreenTitle}>Vídeo</Text>
              <TouchableOpacity
                onPress={() => setFullscreenIndex(null)}
                style={{ padding: 10 }}
              >
                <X color="#fff" size={22} />
              </TouchableOpacity>
            </View>

            {workout && fullscreenIndex != null ? (
              (() => {
                const ex = workout.data.exercises[fullscreenIndex];
                const video = ex?.videoUrl || ex?.video_url;
                if (!video) return null;
                if (isMp4(video)) {
                  return (
                    <VideoView
                      player={player}
                      style={{ flex: 1 }}
                      allowsFullscreen={false}
                      nativeControls
                    />
                  );
                }
                if (isWeb) {
                  return (
                    <iframe
                      src={`https://www.youtube.com/embed/${getYoutubeId(video)}?autoplay=1`}
                      style={{ width: "100%", height: "100%", border: "none" }}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  );
                }
                return (
                  <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                    <YoutubePlayer
                      height={360}
                      width={Math.min(width, 960)}
                      play
                      videoId={getYoutubeId(video)}
                      onReady={() => setVideoLoading(false)}
                      onError={() => setVideoLoading(false)}
                    />
                  </View>
                );
              })()
            ) : (
              <View style={{ flex: 1 }} />
            )}
          </SafeAreaView>
        </Modal>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },

  header: {
    padding: 20,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    alignItems: "center",
    paddingBottom: 20,
  },
  headerTop: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  badge: {
    backgroundColor: "#dcfce7",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  badgeText: { color: "#166534", fontWeight: "800", fontSize: 10, letterSpacing: 0.5 },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  workoutTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 6,
    textAlign: "center",
  },
  timerText: {
    fontSize: 48,
    fontWeight: "800",
    color: "#3b82f6",
    fontFamily: "monospace",
    letterSpacing: -1.5,
    lineHeight: 52,
  },
  headerActions: { marginTop: 12 },
  finishButton: {
    backgroundColor: "#ef4444",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 22,
  },
  finishButtonText: { color: "#fff", fontWeight: "800", fontSize: 12, letterSpacing: 0.5 },

  content: { padding: 16, paddingBottom: 40 },
  generalNotesBox: {
    backgroundColor: "#fff7ed",
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#ffedd5",
  },
  generalNotesTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  generalNotesTitle: { fontSize: 12, fontWeight: "900", color: "#ea580c", letterSpacing: 0.5 },
  generalNotesText: { fontSize: 14, color: "#c2410c", lineHeight: 20, marginTop: 4 },

  exerciseCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  exerciseLeft: { flex: 1, minWidth: 0 },
  exerciseRight: { width: 120, alignItems: "flex-end" },
  cardHeader: { flexDirection: "row", alignItems: "center", marginBottom: 10, gap: 10 },
  indexBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
  },
  indexText: { fontSize: 13, fontWeight: "900", color: "#94a3b8" },
  exerciseName: { fontSize: 16, fontWeight: "800", color: "#0f172a", flex: 1 },

  setsContainer: { gap: 8 },
  setBox: { borderRadius: 12, padding: 12, borderWidth: 1 },
  setTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  setLabelRow: { flexDirection: "row", alignItems: "center", gap: 8, minWidth: 0, flex: 1 },
  setLabelPill: {
    backgroundColor: "#fff",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  setLabelText: { fontSize: 11, fontWeight: "900", letterSpacing: 0.5 },
  setDetailsText: { fontWeight: "800", color: "#1e293b", fontSize: 14, flexShrink: 1 },
  setLoadText: {
    fontSize: 12,
    color: "#475569",
    fontWeight: "800",
    textTransform: "uppercase",
    marginLeft: 10,
    flexShrink: 1,
    maxWidth: 86,
    textAlign: "right",
  },
  restRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  restText: { fontSize: 12, color: "#64748b", fontWeight: "700" },

  noteBox: {
    marginTop: 10,
    padding: 10,
    backgroundColor: "#fff7ed",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ffedd5",
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
  },
  noteText: { fontSize: 13, color: "#c2410c", flex: 1, lineHeight: 18 },

  thumbBox: {
    width: 120,
    height: 120,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#000",
    position: "relative",
  },
  thumbImage: { width: "100%", height: "100%" },
  thumbLoading: { flex: 1, alignItems: "center", justifyContent: "center" },
  playOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.28)",
    alignItems: "center",
    justifyContent: "center",
  },

  inlineVideoBox: {
    width: 120,
    backgroundColor: "#000",
    borderRadius: 12,
    overflow: "hidden",
  },
  inlineVideoHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  inlineVideoButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  inlineVideoButtonText: { color: "#fff", fontWeight: "800", fontSize: 11 },
  inlineVideoBody: { width: 120, height: 120, position: "relative" },
  inlineVideo: { width: 120, height: 120 },
  inlineVideoLoading: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
    backgroundColor: "rgba(0,0,0,0.35)",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalContent: {
    backgroundColor: "#fff",
    width: "100%",
    borderRadius: 24,
    padding: 28,
  },
  modalTitle: { fontSize: 22, fontWeight: "900", color: "#0f172a", marginBottom: 8 },
  modalSubtitle: { fontSize: 15, color: "#64748b", marginBottom: 18, lineHeight: 22 },
  input: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 16,
    padding: 16,
    minHeight: 120,
    marginBottom: 18,
    fontSize: 16,
    color: "#334155",
  },
  modalButtons: { flexDirection: "column", gap: 12 },
  modalButton: {
    width: "100%",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButton: { backgroundColor: "#f1f5f9" },
  cancelText: { color: "#0f172a", fontWeight: "800" },
  confirmButton: { backgroundColor: "#ef4444" },
  confirmText: { color: "#fff", fontWeight: "900" },

  successBox: { backgroundColor: "#fff", width: "100%", borderRadius: 24, padding: 28 },
  successIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#f0fdf4",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    alignSelf: "center",
  },
  successTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#0f172a",
    textAlign: "center",
    marginBottom: 6,
  },
  successSubtitle: { fontSize: 15, color: "#64748b", textAlign: "center", marginBottom: 18 },
  successButton: {
    backgroundColor: "#3b82f6",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  successButtonText: { color: "#fff", fontWeight: "900", fontSize: 14 },

  fullscreenHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 6,
    backgroundColor: "#000",
  },
  fullscreenTitle: { color: "#fff", fontWeight: "900", fontSize: 14 },
});
