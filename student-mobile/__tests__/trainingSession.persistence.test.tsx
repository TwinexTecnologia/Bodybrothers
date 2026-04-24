import React from "react";
import { AppState, type AppStateStatus, Text } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { act, render, waitFor } from "@testing-library/react-native";

const mockUseAuth = jest.fn();
const mockGetActiveSession = jest.fn<Promise<any>, [string]>(async () => null);
const mockFinishSession = jest.fn<Promise<any>, [string, number, string]>(
  async () => null,
);

let appStateSpy: jest.SpyInstance;
let appStateListener:
  | ((state: AppStateStatus) => void | Promise<void>)
  | undefined;
let latestContext: ReturnType<typeof useTrainingSession> | null = null;

jest.mock("../lib/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock("../lib/history", () => ({
  getActiveSession: (studentId: string) => mockGetActiveSession(studentId),
  finishSession: (sessionId: string, elapsed: number, notes: string) =>
    mockFinishSession(sessionId, elapsed, notes),
}));

import { loadActiveSession } from "../lib/trainingSessionStorage";
import { TrainingSessionProvider, useTrainingSession } from "../lib/trainingSession";

function Consumer() {
  latestContext = useTrainingSession();
  const { loading, activeSession, elapsedSeconds } = latestContext;
  return (
    <Text testID="state">
      {loading ? "loading" : `${activeSession?.id ?? "none"}|${elapsedSeconds}`}
    </Text>
  );
}

describe("TrainingSessionProvider", () => {
  beforeEach(async () => {
    latestContext = null;
    appStateListener = undefined;
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { id: "student-1" } });
    mockGetActiveSession.mockResolvedValue(null);
    mockFinishSession.mockResolvedValue(null);
    (AppState as any).currentState = "active";
    appStateSpy = jest
      .spyOn(AppState, "addEventListener")
      .mockImplementation((_event, listener) => {
        appStateListener = listener;
        return { remove: jest.fn() } as any;
      });
    jest
      .spyOn(Date, "now")
      .mockReturnValue(new Date("2026-03-31T12:00:00.000Z").getTime());
    await AsyncStorage.clear();
  });

  afterEach(() => {
    appStateSpy?.mockRestore?.();
    (Date.now as jest.Mock).mockRestore?.();
  });

  it("persiste sessão ativa e recalcula elapsed pelo startedAt", async () => {
    mockUseAuth.mockReturnValue({ user: null });
    const key = "@fitbody:active_training_session_v1";
    const startedAt = new Date("2026-03-31T11:58:30.000Z").toISOString();
    await AsyncStorage.setItem(
      key,
      JSON.stringify({
        id: "session-1",
        studentId: "student-1",
        workoutId: "workout-1",
        workoutTitle: "Treino A",
        startedAt,
      }),
    );

    const { getByTestId, unmount } = render(
      <TrainingSessionProvider>
        <Consumer />
      </TrainingSessionProvider>,
    );

    await waitFor(() => {
      expect(getByTestId("state")).toHaveTextContent("session-1|90");
    });

    unmount();

    const { getByTestId: getByTestId2 } = render(
      <TrainingSessionProvider>
        <Consumer />
      </TrainingSessionProvider>,
    );

    await waitFor(() => {
      expect(getByTestId2("state")).toHaveTextContent("session-1|90");
    });
  });

  it("reagenda o auto-close ao registrar nova interação", async () => {
    mockUseAuth.mockReturnValue({ user: { id: "student-1" } });
    const startedAt = "2026-03-31T10:00:00.000Z";
    const lastInteractionAt = "2026-03-31T11:00:00.000Z";
    mockGetActiveSession.mockResolvedValue({
      id: "session-1",
      studentId: "student-1",
      workoutId: "workout-1",
      workoutTitle: "Treino A",
      startedAt,
    });
    await AsyncStorage.setItem(
      "@fitbody:active_training_session_v2",
      JSON.stringify({
        id: "session-1",
        studentId: "student-1",
        workoutId: "workout-1",
        workoutTitle: "Treino A",
        startedAt,
        lastInteractionAt,
        totalPausedSeconds: 0,
        pauseStartedAt: null,
      }),
    );

    const scheduleNotificationAsync =
      Notifications.scheduleNotificationAsync as jest.Mock;

    const { getByTestId } = render(
      <TrainingSessionProvider>
        <Consumer />
      </TrainingSessionProvider>,
    );

    await waitFor(() => {
      expect(getByTestId("state")).toHaveTextContent("session-1|7200");
    });

    scheduleNotificationAsync.mockClear();

    await act(async () => {
      await latestContext?.pauseTraining();
    });

    const stored = await loadActiveSession();
    expect(stored?.pauseStartedAt).toBe(stored?.lastInteractionAt);
    expect(stored?.inactiveAutoCloseAt).toBe(
      new Date(
        new Date(stored?.lastInteractionAt ?? "").getTime() + 4 * 60 * 60 * 1000,
      ).toISOString(),
    );
    expect(stored?.inactiveAutoCloseNotificationId).toBe("notif://id");
    expect(scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        identifier: "fitbody_inactive_auto_close_session_1",
        trigger: {
          type: "date",
          date: new Date(stored?.inactiveAutoCloseAt ?? ""),
        },
      }),
    );
  });

  it("finaliza a sessão vencida na reconciliação e limpa o agendamento", async () => {
    mockUseAuth.mockReturnValue({ user: { id: "student-1" } });
    (AppState as any).currentState = "active";
    (Date.now as jest.Mock).mockReturnValue(
      new Date("2026-03-31T12:01:00.000Z").getTime(),
    );
    mockGetActiveSession.mockResolvedValue(null);

    await AsyncStorage.setItem(
      "@fitbody:active_training_session_v2",
      JSON.stringify({
        id: "session-1",
        studentId: "student-1",
        workoutId: "workout-1",
        workoutTitle: "Treino A",
        startedAt: "2026-03-31T07:30:00.000Z",
        lastInteractionAt: "2026-03-31T08:00:00.000Z",
        inactiveAutoCloseAt: "2026-03-31T12:00:00.000Z",
        inactiveAutoCloseNotificationId: "notif-123",
        totalPausedSeconds: 0,
        pauseStartedAt: null,
      }),
    );

    const cancelScheduledNotificationAsync =
      Notifications.cancelScheduledNotificationAsync as jest.Mock;

    const { getByTestId } = render(
      <TrainingSessionProvider>
        <Consumer />
      </TrainingSessionProvider>,
    );

    await waitFor(() => {
      expect(getByTestId("state")).toHaveTextContent("none|0");
    });

    expect(mockFinishSession).toHaveBeenCalledWith(
      "session-1",
      expect.any(Number),
      "",
    );
    expect(cancelScheduledNotificationAsync).toHaveBeenCalledWith("notif-123");
    expect(await loadActiveSession()).toBeNull();
  });
});
