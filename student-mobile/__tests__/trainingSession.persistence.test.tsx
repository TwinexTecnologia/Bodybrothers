import React from "react";
import { AppState, Text } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { render, waitFor } from "@testing-library/react-native";

let appStateSpy: jest.SpyInstance;

jest.mock("../lib/auth", () => ({
  useAuth: () => ({ user: null }),
}));

jest.mock("../lib/history", () => ({
  getActiveSession: jest.fn(async () => null),
}));

import { TrainingSessionProvider, useTrainingSession } from "../lib/trainingSession";

function Consumer() {
  const { loading, activeSession, elapsedSeconds } = useTrainingSession();
  return (
    <Text testID="state">
      {loading ? "loading" : `${activeSession?.id ?? "none"}|${elapsedSeconds}`}
    </Text>
  );
}

describe("TrainingSessionProvider", () => {
  beforeEach(async () => {
    (AppState as any).currentState = "background";
    appStateSpy = jest
      .spyOn(AppState, "addEventListener")
      .mockReturnValue({ remove: jest.fn() } as any);
    jest.spyOn(Date, "now").mockReturnValue(new Date("2026-03-31T12:00:00.000Z").getTime());
    await AsyncStorage.clear();
  });

  afterEach(() => {
    appStateSpy?.mockRestore?.();
    (Date.now as any).mockRestore?.();
  });

  it("persiste sessão ativa e recalcula elapsed pelo startedAt", async () => {
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
});
