import React from "react";
import { Alert } from "react-native";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";

jest.mock("../lib/history", () => ({
  startSession: jest.fn(async () => ({})),
  getWeeklyActivity: jest.fn(async () => []),
  finishSession: jest.fn(async () => ({})),
  cancelSession: jest.fn(async () => {}),
}));

import { finishSession, cancelSession } from "../lib/history";
import ActiveWorkoutHeroActions from "../components/ActiveWorkoutHeroActions";

describe("ActiveWorkoutHeroActions", () => {
  beforeEach(() => {
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
  });

  afterEach(() => {
    (Alert.alert as any).mockRestore?.();
    jest.clearAllMocks();
  });

  it("renderiza timer e ações; finaliza sessão com feedback (opcional)", async () => {
    const onFinished = jest.fn(async () => {});
    const onRequestRefreshDays = jest.fn(async () => {});
    const onPause = jest.fn();
    const onCloseParentModal = jest.fn();

    const session = {
      id: "session-1",
      studentId: "student-1",
      workoutId: "workout-1",
      workoutTitle: "Treino A",
      startedAt: new Date("2026-03-31T12:00:00.000Z").toISOString(),
    };

    const { getByTestId, getByText, queryByText, getByPlaceholderText } = render(
      <ActiveWorkoutHeroActions
        session={session as any}
        elapsedSeconds={90}
        onFinished={onFinished}
        onRequestRefreshDays={onRequestRefreshDays}
        onPause={onPause}
        onCloseParentModal={onCloseParentModal}
      />,
    );

    expect(getByTestId("active-hero-timer")).toHaveTextContent("01:30");
    expect(getByText("Finalizar")).toBeTruthy();
    expect(getByText("Pausar")).toBeTruthy();
    expect(getByText("Cancelar")).toBeTruthy();

    fireEvent.press(getByTestId("active-hero-finish"));
    expect(getByText("Finalizar treino")).toBeTruthy();

    fireEvent.changeText(getByPlaceholderText("Escreva aqui..."), "curti muito");
    fireEvent.press(getByTestId("finish-modal-confirm"));

    await waitFor(() => {
      expect(finishSession).toHaveBeenCalledWith("session-1", 90, "curti muito");
    });

    await waitFor(() => {
      expect(onFinished).toHaveBeenCalled();
      expect(onRequestRefreshDays).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(queryByText("Treino finalizado!")).toBeTruthy();
    });

    fireEvent.press(getByTestId("finish-success-back"));
    expect(onCloseParentModal).toHaveBeenCalled();
  });

  it("pausa apenas minimizando (sem encerrar sessão)", () => {
    const onPause = jest.fn();
    const { getByTestId } = render(
      <ActiveWorkoutHeroActions
        session={
          {
            id: "session-1",
            studentId: "student-1",
            workoutId: "workout-1",
            workoutTitle: "Treino A",
            startedAt: new Date().toISOString(),
          } as any
        }
        elapsedSeconds={10}
        onFinished={async () => {}}
        onRequestRefreshDays={async () => {}}
        onPause={onPause}
        onCloseParentModal={() => {}}
      />,
    );

    fireEvent.press(getByTestId("active-hero-pause"));
    expect(onPause).toHaveBeenCalled();
  });

  it("confirma cancelamento e remove sessão ativa", async () => {
    const onFinished = jest.fn(async () => {});
    const onRequestRefreshDays = jest.fn(async () => {});
    const onCloseParentModal = jest.fn();

    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});

    const { getByTestId } = render(
      <ActiveWorkoutHeroActions
        session={
          {
            id: "session-1",
            studentId: "student-1",
            workoutId: "workout-1",
            workoutTitle: "Treino A",
            startedAt: new Date().toISOString(),
          } as any
        }
        elapsedSeconds={10}
        onFinished={onFinished}
        onRequestRefreshDays={onRequestRefreshDays}
        onPause={() => {}}
        onCloseParentModal={onCloseParentModal}
      />,
    );

    fireEvent.press(getByTestId("active-hero-cancel"));

    expect(alertSpy).toHaveBeenCalled();
    const [, , buttons] = alertSpy.mock.calls[0] as any;
    const destructive = buttons.find((b: any) => b.style === "destructive");

    await act(async () => {
      await destructive.onPress();
    });

    await waitFor(() => {
      expect(cancelSession).toHaveBeenCalledWith("session-1");
      expect(onFinished).toHaveBeenCalled();
      expect(onRequestRefreshDays).toHaveBeenCalled();
      expect(onCloseParentModal).toHaveBeenCalled();
    });
  });
});
