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
import { finishSession, getSessionById } from "../lib/history";
import { useTrainingSession } from "../lib/trainingSession";
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

export default function SessionRedirect() {
  const { sessionId } = useLocalSearchParams<{ sessionId?: string }>();
  const { setActiveSessionFromDbSession } = useTrainingSession();

  useEffect(() => {
    (async () => {
      try {
        if (!sessionId) {
          router.replace("/(tabs)/workouts");
          return;
        }
        const session = await getSessionById(sessionId);
        await setActiveSessionFromDbSession(session);
        router.replace({ pathname: "/(tabs)/workouts", params: { openActive: "1" } });
      } catch {
        Alert.alert("Erro", "Não foi possível abrir o treino. Tente novamente.");
        router.replace("/(tabs)/workouts");
      }
    })();
  }, [sessionId, setActiveSessionFromDbSession]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
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
