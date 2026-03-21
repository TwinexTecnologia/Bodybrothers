import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  ActivityIndicator,
  FlatList,
  Image,
  TextInput,
  Platform,
  useWindowDimensions,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase";
import { finishSession } from "../lib/history";
import { VideoView, useVideoPlayer } from "expo-video";
import * as VideoThumbnails from "expo-video-thumbnails";
import YoutubePlayer from "react-native-youtube-iframe";
import {
  X,
  Play,
  MessageSquare,
  CheckCircle,
  Clock,
  StopCircle,
} from "lucide-react-native";

type ExerciseSet = {
  type: "warmup" | "feeder" | "working" | "custom";
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

export default function Session() {
  const { sessionId } = useLocalSearchParams();

  const [workout, setWorkout] = useState<Workout | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [loading, setLoading] = useState(true);

  const [showFinishModal, setShowFinishModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [sessionNotes, setSessionNotes] = useState("");

  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoLoading, setVideoLoading] = useState(true);

  const [thumbnails, setThumbnails] = useState({});
  const thumbnailsCache = useRef({});
  const processing = useRef({});

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const player = useVideoPlayer("");
  const { height: viewportHeight, width: viewportWidth } =
    useWindowDimensions();

  useEffect(() => {
    if (sessionId) loadSession();
  }, [sessionId]);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    const load = async () => {
      if (videoUrl && isMp4(videoUrl)) {
        try {
          await player.replaceAsync({ uri: videoUrl });
          player.play();
        } catch {}
      } else {
        player.pause();
        await player.replaceAsync(null);
      }
    };

    const pause = () => {
      if (!videoUrl) {
        player.pause();
        player.replaceAsync(null);
      }
    };

    load();
    pause();
  }, [videoUrl]);

  useEffect(() => {
    const sub = player.addListener("statusChange", (status) => {
      if (status.status === "loading") setVideoLoading(true);
      if (status.status === "readyToPlay") setVideoLoading(false);
    });

    return () => sub.remove();
  }, [player]);

  // thumbnails
  useEffect(() => {
    if (!workout) return;

    workout.data.exercises.forEach(async (ex, index) => {
      const video = ex.videoUrl || ex.video_url;
      if (!video) return;

      if (thumbnailsCache.current[index]) return;
      if (processing.current[index]) return;

      processing.current[index] = true;

      try {
        let uri = null;

        if (isMp4(video)) {
          try {
            const result = await VideoThumbnails.getThumbnailAsync(video, {
              time: 1000,
            });
            uri = result.uri;
          } catch {}
        } else {
          const id = getYoutubeId(video);
          if (id) {
            uri = `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
          }
        }

        if (!uri) {
          uri = "https://via.placeholder.com/300x200.png?text=Video";
        }

        thumbnailsCache.current[index] = uri;
        setThumbnails((prev) => ({ ...prev, [index]: uri }));
      } finally {
        processing.current[index] = false;
      }
    });
  }, [workout]);

  async function loadSession() {
    try {
      const { data: sessionData, error: sessionError } = await supabase
        .from("workout_history")
        .select("*")
        .eq("id", sessionId)
        .single();

      if (sessionError || !sessionData)
        throw new Error("Sessão não encontrada");

      const start = new Date(sessionData.started_at);
      const now = new Date();
      const diffSec = Math.floor((now.getTime() - start.getTime()) / 1000);
      setElapsedSeconds(diffSec > 0 ? diffSec : 0);

      const { data: workoutData, error: workoutError } = await supabase
        .from("protocols")
        .select("*")
        .eq("id", sessionData.workout_id)
        .single();

      if (workoutError) throw workoutError;
      setWorkout(workoutData);
    } catch (error) {
      console.error(error);
      Alert.alert("Erro", "Não foi possível carregar o treino.");
      router.back();
    } finally {
      setLoading(false);
    }
  }

  async function handleFinish() {
    if (!sessionId) {
      Alert.alert("Erro", "ID da sessão inválido.");
      return;
    }

    setIsFinishing(true); // Ativa loading
    if (timerRef.current) clearInterval(timerRef.current);

    try {
      await finishSession(sessionId as string, elapsedSeconds, sessionNotes);

      setShowFinishModal(false);
      setIsFinishing(false);

      // Mostra modal customizado de sucesso (mais robusto que Alert)
      setTimeout(() => {
        setShowSuccessModal(true);
      }, 300);
    } catch (error: any) {
      console.error("Erro ao finalizar:", error);
      setShowFinishModal(false);
      setIsFinishing(false);
      Alert.alert(
        "Erro",
        "Não foi possível finalizar o treino, mas tentamos salvar.",
      );
      router.replace("/(tabs)/dashboard");
    }
  }

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return h > 0
      ? `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
      : `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const isMp4 = (url: string) =>
    url?.includes(".mp4") || url?.includes("video");

  const getYoutubeId = (url: string) => {
    const match = url.match(
      /^.*(youtu.be\/|watch\?v=|embed\/|shorts\/)([^#&?]*).*/,
    );
    return match?.[2];
  };

  if (loading || !workout) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text>Carregando treino...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const youtubeId = videoUrl ? getYoutubeId(videoUrl) : null;
  const isWeb = Platform.OS === "web";
  const youtubeEmbedUrl = youtubeId
    ? `https://www.youtube.com/embed/${youtubeId}?autoplay=1`
    : null;
  const headerMaxHeightPx = Math.round(viewportHeight * 0.25);
  const headerMaxHeight = isWeb ? "25vh" : headerMaxHeightPx;
  const headerPadding = Math.min(
    24,
    Math.max(12, Math.round(headerMaxHeightPx * 0.12)),
  );
  const headerPaddingBottom = Math.min(
    32,
    Math.max(16, Math.round(headerMaxHeightPx * 0.16)),
  );
  const timerFontSize = Math.min(
    56,
    Math.max(28, Math.round(headerMaxHeightPx * 0.42)),
  );
  const workoutTitleFontSize = Math.min(
    24,
    Math.max(16, Math.round(headerMaxHeightPx * 0.16)),
  );
  const isCompactHeader = viewportWidth <= 360 || viewportHeight <= 640;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header com Cronômetro */}
      <View
        style={[
          styles.header,
          {
            maxHeight: headerMaxHeight,
            overflow: "hidden",
            padding: headerPadding,
            paddingBottom: headerPaddingBottom,
          },
        ]}
      >
        <View
          style={[
            styles.headerTop,
            isCompactHeader ? { marginBottom: 12 } : null,
          ]}
        >
          <View style={styles.badge}>
            <Text style={styles.badgeText}>TREINO EM ANDAMENTO</Text>
          </View>
          <TouchableOpacity
            style={styles.finishButton}
            onPress={() => setShowFinishModal(true)}
          >
            <StopCircle color="#fff" size={18} />
            <Text style={styles.finishButtonText}>FINALIZAR</Text>
          </TouchableOpacity>
        </View>

        <Text
          style={[styles.workoutTitle, { fontSize: workoutTitleFontSize }]}
          numberOfLines={1}
        >
          {workout.title}
        </Text>
        <Text
          style={[
            styles.timerText,
            {
              fontSize: timerFontSize,
              lineHeight: timerFontSize,
              letterSpacing: isCompactHeader ? -1 : -2,
            },
          ]}
        >
          {formatTime(elapsedSeconds)}
        </Text>
      </View>

      <FlatList
        data={workout.data.exercises}
        keyExtractor={(_, i) => String(i)}
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          workout.data.notes ? (
            <View style={styles.generalNotesBox}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 4,
                }}
              >
                <MessageSquare size={18} color="#f97316" />
                <Text style={styles.generalNotesTitle}>OBSERVAÇÕES GERAIS</Text>
              </View>
              <Text style={styles.generalNotesText}>{workout.data.notes}</Text>
            </View>
          ) : null
        }
        ListFooterComponent={<View style={{ height: 40 }} />}
        renderItem={({ item: ex, index: i }) => {
          const video = ex.videoUrl || ex.video_url;
          const thumb = thumbnails[i];

          return (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.indexBadge}>
                  <Text style={styles.indexText}>{i + 1}</Text>
                </View>
                <Text style={styles.exerciseName}>{ex.name}</Text>
              </View>

              <View style={styles.setsContainer}>
                {(() => {
                  let setsToRender: ExerciseSet[] = ex.sets || [];
                  if (setsToRender.length === 0) {
                    if (ex.warmupSeries || ex.warmupReps) {
                      setsToRender.push({
                        type: "warmup",
                        series: ex.warmupSeries || "",
                        reps: ex.warmupReps || "",
                        load: ex.warmupLoad || "",
                        rest: ex.warmupRest || "",
                      });
                    }
                    if (ex.feederSeries || ex.feederReps) {
                      setsToRender.push({
                        type: "feeder",
                        series: ex.feederSeries || "",
                        reps: ex.feederReps || "",
                        load: ex.feederLoad || "",
                        rest: ex.feederRest || "",
                      });
                    }
                    if (ex.series || ex.reps) {
                      setsToRender.push({
                        type: "working",
                        series: ex.series || "",
                        reps: ex.reps || "",
                        load: ex.load || "",
                        rest: ex.rest || "",
                      });
                    }
                  }

                  return setsToRender.map((set, idx) => {
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
                        key={idx}
                        style={{
                          backgroundColor: bg,
                          borderRadius: 12,
                          padding: 12,
                          borderWidth: 1,
                          borderColor: borderColor,
                          marginBottom: 4,
                        }}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: 6,
                          }}
                        >
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 8,
                            }}
                          >
                            <View
                              style={{
                                backgroundColor: "#fff",
                                paddingHorizontal: 8,
                                paddingVertical: 4,
                                borderRadius: 6,
                                shadowColor: color,
                                shadowOpacity: 0.1,
                                shadowOffset: { width: 0, height: 1 },
                                elevation: 1,
                              }}
                            >
                              <Text
                                style={{
                                  color: color,
                                  fontSize: 11,
                                  fontWeight: "900",
                                  letterSpacing: 0.5,
                                }}
                              >
                                {label}
                              </Text>
                            </View>
                            <Text
                              style={{
                                fontWeight: "700",
                                color: "#1e293b",
                                fontSize: 15,
                              }}
                            >
                              {set.series} x {set.reps}
                            </Text>
                          </View>
                          {set.load && (
                            <Text
                              style={{
                                fontSize: 13,
                                color: "#475569",
                                fontWeight: "700",
                                textTransform: "uppercase",
                              }}
                            >
                              {set.load}
                            </Text>
                          )}
                        </View>

                        {set.rest && (
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <Clock size={14} color="#94a3b8" />
                            <Text
                              style={{
                                fontSize: 13,
                                color: "#64748b",
                                fontWeight: "500",
                              }}
                            >
                              {set.rest}
                            </Text>
                          </View>
                        )}
                      </View>
                    );
                  });
                })()}
              </View>

              {ex.notes && (
                <View style={styles.noteBox}>
                  <MessageSquare
                    size={16}
                    color="#f97316"
                    style={{ marginTop: 2 }}
                  />
                  <Text style={styles.noteText}>{ex.notes}</Text>
                </View>
              )}

              {video && (
                <TouchableOpacity
                  style={styles.thumbBox}
                  onPress={() => {
                    setVideoUrl(video);
                    setVideoLoading(true);
                  }}
                >
                  {thumb ? (
                    <Image source={{ uri: thumb }} style={styles.thumb} />
                  ) : (
                    <ActivityIndicator color="#fff" />
                  )}

                  <View style={styles.playOverlay}>
                    <Play size={40} color="#fff" />
                  </View>
                </TouchableOpacity>
              )}
            </View>
          );
        }}
      />

      {/* Modal de Finalização */}
      <Modal visible={showFinishModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Treino Finalizado?</Text>
            <Text style={styles.modalSubtitle}>
              Registre como você se sentiu para seu personal acompanhar sua
              evolução.
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Ex: Aumentei carga no supino, senti o ombro..."
              multiline
              numberOfLines={4}
              value={sessionNotes}
              onChangeText={setSessionNotes}
              textAlignVertical="top"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.confirmButton,
                  isFinishing && { opacity: 0.7 },
                ]}
                onPress={handleFinish}
                disabled={isFinishing}
              >
                {isFinishing ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <CheckCircle
                      size={20}
                      color="#fff"
                      style={{ marginRight: 8 }}
                    />
                    <Text style={styles.confirmButtonText}>
                      Finalizar Treino
                    </Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowFinishModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de Sucesso */}
      <Modal visible={showSuccessModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={{ alignItems: "center", marginBottom: 16 }}>
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  backgroundColor: "#dcfce7",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 16,
                }}
              >
                <Text style={{ fontSize: 32 }}>🎉</Text>
              </View>
              <Text style={[styles.modalTitle, { textAlign: "center" }]}>
                Treino Concluído!
              </Text>
              <Text style={[styles.modalSubtitle, { textAlign: "center" }]}>
                Parabéns! Mais um passo em direção ao seu objetivo. Continue
                assim! 💪
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.modalButton, styles.confirmButton]}
              onPress={() => {
                setShowSuccessModal(false);
                router.replace("/(tabs)/dashboard");
              }}
            >
              <Text style={styles.confirmButtonText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal de Vídeo */}
      <Modal
        visible={!!videoUrl}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modal}>
          <View style={styles.videoHeader}>
            <Text style={styles.videoHeaderTitle}>Visualizar Exercício</Text>
            <TouchableOpacity
              style={styles.closeVideoButton}
              onPress={() => setVideoUrl(null)}
            >
              <X color="#fff" size={24} />
            </TouchableOpacity>
          </View>

          {videoLoading && <ActivityIndicator size="large" color="#fff" />}

          {videoUrl && isMp4(videoUrl) && (
            <>
              {isWeb ? (
                <video
                  src={videoUrl}
                  style={{ width: "100%", height: 300 }}
                  controls
                  autoPlay
                  onCanPlay={() => setVideoLoading(false)}
                  onWaiting={() => setVideoLoading(true)}
                />
              ) : (
                <VideoView
                  style={styles.video}
                  player={player}
                  fullscreenOptions={{ enable: true }}
                />
              )}
            </>
          )}

          {youtubeId && (
            <>
              {isWeb && youtubeEmbedUrl ? (
                <iframe
                  src={youtubeEmbedUrl}
                  style={{ width: "100%", height: 300, border: "none" }}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  onLoad={() => setVideoLoading(false)}
                />
              ) : (
                <YoutubePlayer
                  height={300}
                  play
                  videoId={youtubeId}
                  onReady={() => setVideoLoading(false)}
                />
              )}
            </>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },

  // Header
  header: {
    padding: 24,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    alignItems: "center",
    paddingBottom: 32,
  },
  headerTop: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  badge: {
    backgroundColor: "#dcfce7",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  badgeText: {
    color: "#166534",
    fontWeight: "800",
    fontSize: 10,
    letterSpacing: 0.5,
  },
  finishButton: {
    backgroundColor: "#ef4444",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    shadowColor: "#ef4444",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  finishButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 12,
    letterSpacing: 0.5,
  },
  workoutTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#0f172a",
    marginBottom: 8,
    textAlign: "center",
  },
  timerText: {
    fontSize: 56,
    fontWeight: "800",
    color: "#3b82f6",
    fontFamily: "monospace", // No iOS 'Courier' ou similar seria melhor, mas monospace funciona
    letterSpacing: -2,
    lineHeight: 56,
  },

  // Notas Gerais
  generalNotesBox: {
    backgroundColor: "#fff7ed",
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#ffedd5",
  },
  generalNotesTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#ea580c",
    letterSpacing: 0.5,
  },
  generalNotesText: {
    fontSize: 14,
    color: "#c2410c",
    lineHeight: 22,
    marginTop: 4,
  },

  // Conteúdo
  content: { padding: 20, paddingBottom: 100 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 10,
    elevation: 1,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  indexBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  indexText: { fontSize: 14, fontWeight: "800", color: "#94a3b8" },
  exerciseName: { fontSize: 18, fontWeight: "bold", color: "#0f172a", flex: 1 },

  // Sets
  setsContainer: { gap: 10 },
  setRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  setInfo: { gap: 4 },
  setLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  setDetails: { fontSize: 15, fontWeight: "600", color: "#334155" },
  restBadge: { flexDirection: "row", alignItems: "center", gap: 4 },
  restText: { fontSize: 12, color: "#64748b" },

  // Notas
  noteBox: {
    marginTop: 16,
    padding: 12,
    backgroundColor: "#fff7ed",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ffedd5",
    flexDirection: "row",
    gap: 8,
  },
  noteText: { fontSize: 13, color: "#c2410c", flex: 1, lineHeight: 18 },

  // Thumb Video
  thumbBox: {
    width: "100%",
    height: 200,
    borderRadius: 12,
    overflow: "hidden",
    marginTop: 16,
    backgroundColor: "#000",
    position: "relative",
  },

  // Modal Finish
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
    padding: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#0f172a",
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 15,
    color: "#64748b",
    marginBottom: 24,
    lineHeight: 22,
  },
  input: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 16,
    padding: 16,
    minHeight: 120,
    marginBottom: 24,
    fontSize: 16,
    color: "#334155",
  },
  modalButtons: { flexDirection: "column", gap: 12, marginTop: 12 },
  modalButton: {
    width: "100%",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  cancelButton: { backgroundColor: "transparent", paddingVertical: 12 },
  confirmButton: {
    backgroundColor: "#10b981",
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  cancelButtonText: { fontWeight: "600", color: "#64748b", fontSize: 16 },
  confirmButtonText: { fontWeight: "800", color: "#fff", fontSize: 18 },

  // Video Modal
  videoHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#000",
  },
  closeVideoButton: { padding: 8 },

  title: { fontSize: 20, fontWeight: "bold" },
  timer: { fontSize: 32, color: "#3b82f6", marginTop: 8 },

  exercise: { fontSize: 16, fontWeight: "bold" },

  thumb: { width: "100%", height: "100%" },

  playOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    pointerEvents: "none",
  },

  modal: { flex: 1, backgroundColor: "#000" },
  video: { width: "100%", height: 300 },

  videoHeaderTitle: { color: "#fff", fontWeight: "bold" },
});
