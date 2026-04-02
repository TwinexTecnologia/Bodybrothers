import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { CheckCircle, Clock, Pause, StopCircle, XCircle } from "lucide-react-native";
import { cancelSession, finishSession } from "../lib/history";

type ActiveTrainingSession = {
  id: string;
  studentId: string;
  workoutId: string;
  workoutTitle: string;
  startedAt: string;
  notificationId?: string;
};

function formatElapsedTime(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0
    ? `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
    : `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export default function ActiveWorkoutHeroActions({
  session,
  elapsedSeconds,
  onFinished,
  onRequestRefreshDays,
  onPause,
  onCloseParentModal,
}: {
  session: ActiveTrainingSession;
  elapsedSeconds: number;
  onFinished: () => Promise<void>;
  onRequestRefreshDays: () => Promise<void>;
  onPause: () => void;
  onCloseParentModal: () => void;
}) {
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [sessionNotes, setSessionNotes] = useState("");
  const [isFinishing, setIsFinishing] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);

  const handleFinish = useCallback(async () => {
    setIsFinishing(true);
    try {
      await finishSession(session.id, elapsedSeconds, sessionNotes);
      setShowFinishModal(false);
      setIsFinishing(false);
      await onFinished();
      await onRequestRefreshDays();
      setTimeout(() => setShowSuccessModal(true), 250);
    } catch {
      setShowFinishModal(false);
      setIsFinishing(false);
      Alert.alert(
        "Erro",
        "Não foi possível finalizar o treino, mas tentamos salvar.",
      );
      await onFinished();
    }
  }, [elapsedSeconds, onFinished, onRequestRefreshDays, session.id, sessionNotes]);

  const handleCancel = useCallback(() => {
    Alert.alert(
      "Cancelar treino",
      "Tem certeza que deseja cancelar este treino? Isso vai remover a sessão ativa.",
      [
        { text: "Voltar", style: "cancel" },
        {
          text: "Cancelar treino",
          style: "destructive",
          onPress: async () => {
            setIsCanceling(true);
            try {
              await cancelSession(session.id);
              await onFinished();
              await onRequestRefreshDays();
              onCloseParentModal();
            } catch {
              Alert.alert("Erro", "Não foi possível cancelar o treino.");
            } finally {
              setIsCanceling(false);
            }
          },
        },
      ],
    );
  }, [onCloseParentModal, onFinished, onRequestRefreshDays, session.id]);

  return (
    <View style={styles.activeHeroBox} testID="active-hero-actions">
      <View style={styles.activeHeroTimerBox}>
        <Clock size={18} color="#fff" />
        <Text style={styles.activeHeroTimerLabel}>TEMPO</Text>
        <Text style={styles.activeHeroTimerValue} testID="active-hero-timer">
          {formatElapsedTime(elapsedSeconds)}
        </Text>
      </View>

      <View style={styles.activeHeroActionsRow}>
        <TouchableOpacity
          style={[styles.activeHeroActionButton, styles.activeHeroFinishButton]}
          onPress={() => setShowFinishModal(true)}
          disabled={isFinishing || isCanceling}
          testID="active-hero-finish"
        >
          <StopCircle color="#fff" size={18} />
          <Text style={styles.activeHeroActionText}>Finalizar</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.activeHeroActionButton, styles.activeHeroPauseButton]}
          onPress={onPause}
          disabled={isFinishing || isCanceling}
          testID="active-hero-pause"
        >
          <Pause color="#0f172a" size={18} />
          <Text style={[styles.activeHeroActionText, styles.activeHeroPauseText]}>
            Pausar
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.activeHeroActionButton, styles.activeHeroCancelButton]}
          onPress={handleCancel}
          disabled={isFinishing || isCanceling}
          testID="active-hero-cancel"
        >
          {isCanceling ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <XCircle color="#fff" size={18} />
              <Text style={styles.activeHeroActionText}>Cancelar</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <Modal visible={showFinishModal} transparent animationType="fade">
        <View style={styles.finishModalOverlay}>
          <View style={styles.finishModalContent}>
            <Text style={styles.finishModalTitle}>Finalizar treino</Text>
            <Text style={styles.finishModalSubtitle}>
              Quer deixar um feedback para seu personal? (opcional)
            </Text>

            <TextInput
              style={styles.finishModalInput}
              value={sessionNotes}
              onChangeText={setSessionNotes}
              placeholder="Escreva aqui..."
              placeholderTextColor="#94a3b8"
              multiline
              textAlignVertical="top"
            />

            <View style={styles.finishModalButtons}>
              <TouchableOpacity
                style={[styles.finishModalButton, styles.finishModalCancelButton]}
                onPress={() => setShowFinishModal(false)}
                disabled={isFinishing}
                testID="finish-modal-cancel"
              >
                <Text style={styles.finishModalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.finishModalButton, styles.finishModalConfirmButton]}
                onPress={handleFinish}
                disabled={isFinishing}
                testID="finish-modal-confirm"
              >
                {isFinishing ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.finishModalConfirmText}>Finalizar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showSuccessModal} transparent animationType="fade">
        <View style={styles.finishModalOverlay}>
          <View style={styles.finishSuccessBox}>
            <View style={styles.finishSuccessIcon}>
              <CheckCircle size={44} color="#16a34a" />
            </View>
            <Text style={styles.finishSuccessTitle}>Treino finalizado!</Text>
            <Text style={styles.finishSuccessSubtitle}>
              Bom trabalho. Você mandou bem hoje.
            </Text>
            <TouchableOpacity
              style={styles.finishSuccessButton}
              onPress={() => {
                setShowSuccessModal(false);
                onCloseParentModal();
              }}
              testID="finish-success-back"
            >
              <Text style={styles.finishSuccessButtonText}>Voltar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  activeHeroBox: { alignItems: "center", gap: 14, width: "100%" },
  activeHeroTimerBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  activeHeroTimerLabel: {
    color: "rgba(255,255,255,0.88)",
    fontWeight: "900",
    fontSize: 12,
    letterSpacing: 1,
  },
  activeHeroTimerValue: { color: "#fff", fontWeight: "900", fontSize: 18 },
  activeHeroActionsRow: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "center",
    flexWrap: "wrap",
  },
  activeHeroActionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
  },
  activeHeroActionText: { color: "#fff", fontWeight: "900", fontSize: 13 },
  activeHeroFinishButton: {
    backgroundColor: "rgba(239,68,68,0.95)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  activeHeroPauseButton: {
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.2)",
  },
  activeHeroPauseText: { color: "#0f172a" },
  activeHeroCancelButton: {
    backgroundColor: "rgba(2,132,199,0.95)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },

  finishModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },
  finishModalContent: {
    width: "100%",
    maxWidth: 520,
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 18,
  },
  finishModalTitle: { fontSize: 18, fontWeight: "900", color: "#0f172a" },
  finishModalSubtitle: {
    marginTop: 8,
    color: "#64748b",
    fontSize: 13,
    lineHeight: 18,
  },
  finishModalInput: {
    marginTop: 14,
    minHeight: 96,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 12,
    color: "#0f172a",
    backgroundColor: "#f8fafc",
  },
  finishModalButtons: { flexDirection: "row", gap: 10, marginTop: 14 },
  finishModalButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  finishModalCancelButton: { backgroundColor: "#f1f5f9" },
  finishModalCancelText: { color: "#0f172a", fontWeight: "900" },
  finishModalConfirmButton: { backgroundColor: "#ef4444" },
  finishModalConfirmText: { color: "#fff", fontWeight: "900" },

  finishSuccessBox: {
    width: "100%",
    maxWidth: 520,
    backgroundColor: "#fff",
    borderRadius: 22,
    padding: 20,
    alignItems: "center",
  },
  finishSuccessIcon: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: "#f0fdf4",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#dcfce7",
    marginBottom: 10,
  },
  finishSuccessTitle: { fontSize: 18, fontWeight: "900", color: "#0f172a" },
  finishSuccessSubtitle: {
    marginTop: 6,
    textAlign: "center",
    color: "#64748b",
    lineHeight: 18,
  },
  finishSuccessButton: {
    marginTop: 14,
    backgroundColor: "#3b82f6",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
  },
  finishSuccessButtonText: { color: "#fff", fontWeight: "900" },
});

