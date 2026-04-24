import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  ACTIVE_SESSION_STORAGE_KEY,
  loadActiveSession,
} from "../lib/trainingSessionStorage";
import { getNextAutoCloseDeadlineIso } from "../lib/trainingSessionTypes";

describe("trainingSessionStorage parse", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("preenche lastInteractionAt com startedAt quando ausente no JSON v2", async () => {
    const nowSpy = jest
      .spyOn(Date, "now")
      .mockReturnValue(new Date("2026-03-31T14:00:00.000Z").getTime());
    const startedAt = "2026-03-31T12:00:00.000Z";
    await AsyncStorage.setItem(
      ACTIVE_SESSION_STORAGE_KEY,
      JSON.stringify({
        id: "s1",
        studentId: "st1",
        workoutId: "w1",
        workoutTitle: "Teste",
        startedAt,
        totalPausedSeconds: 0,
        pauseStartedAt: null,
      }),
    );
    const s = await loadActiveSession();
    expect(s?.lastInteractionAt).toBe(startedAt);
    expect(s).not.toBeNull();
    expect(s?.inactiveAutoCloseAt).toBe(
      getNextAutoCloseDeadlineIso(s!, Date.now()),
    );
    expect(s?.inactiveAutoCloseNotificationId).toBeUndefined();
    nowSpy.mockRestore();
  });

  it("preserva lastInteractionAt quando presente no JSON v2", async () => {
    const startedAt = "2026-03-31T10:00:00.000Z";
    const lastInteractionAt = "2026-03-31T11:30:00.000Z";
    await AsyncStorage.setItem(
      ACTIVE_SESSION_STORAGE_KEY,
      JSON.stringify({
        id: "s1",
        studentId: "st1",
        workoutId: "w1",
        workoutTitle: "Teste",
        startedAt,
        lastInteractionAt,
        inactiveAutoCloseAt: "2026-03-31T15:30:00.000Z",
        inactiveAutoCloseNotificationId: "notif-123",
        totalPausedSeconds: 0,
        pauseStartedAt: null,
      }),
    );
    const s = await loadActiveSession();
    expect(s?.lastInteractionAt).toBe(lastInteractionAt);
    expect(s?.inactiveAutoCloseAt).toBe("2026-03-31T15:30:00.000Z");
    expect(s?.inactiveAutoCloseNotificationId).toBe("notif-123");
  });
});
