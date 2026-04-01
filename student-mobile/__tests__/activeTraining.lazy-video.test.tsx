import React from "react";
import { render, waitFor, fireEvent } from "@testing-library/react-native";

jest.mock("../lib/supabase", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: {
              id: "workout-1",
              title: "Treino A",
              data: {
                notes: "Observações",
                exercises: [
                  {
                    name: "Supino",
                    series: "3",
                    reps: "10",
                    load: "",
                    rest: "60s",
                    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                  },
                ],
              },
            },
            error: null,
          }),
        }),
      }),
    }),
  },
}));

jest.mock("../lib/history", () => ({
  finishSession: jest.fn(async () => ({})),
}));

import ActiveTrainingModal from "../components/ActiveTrainingModal";

describe("ActiveTrainingModal", () => {
  it("renderiza thumbnail e só cria player inline após interação (lazy)", async () => {
    const { queryByTestId, getByTestId, getByText } = render(
      <ActiveTrainingModal
        visible
        session={{
          id: "session-1",
          studentId: "student-1",
          workoutId: "workout-1",
          workoutTitle: "Treino A",
          startedAt: new Date().toISOString(),
        }}
        elapsedSeconds={10}
        onClose={jest.fn()}
        onFinished={jest.fn(async () => {})}
        onRequestRefreshDays={jest.fn(async () => {})}
      />,
    );

    await waitFor(() => {
      expect(getByText("Supino")).toBeTruthy();
    });

    expect(queryByTestId("exercise-video-inline-0")).toBeNull();

    fireEvent.press(getByTestId("exercise-video-thumb-0"));

    await waitFor(() => {
      expect(getByTestId("exercise-video-inline-0")).toBeTruthy();
    });
  });
});

