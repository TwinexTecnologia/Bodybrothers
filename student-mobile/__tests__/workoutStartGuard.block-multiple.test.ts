import { getStartWorkoutBlockReason } from "../lib/workoutStartGuard";

describe("getStartWorkoutBlockReason", () => {
  it("bloqueia quando já existe sessão ativa", () => {
    const reason = getStartWorkoutBlockReason({
      activeDays: [],
      todayIndex: 2,
      hasActiveSession: true,
    });
    expect(reason).toBe("active_session");
  });

  it("bloqueia quando já treinou hoje", () => {
    const reason = getStartWorkoutBlockReason({
      activeDays: [2],
      todayIndex: 2,
      hasActiveSession: false,
    });
    expect(reason).toBe("already_trained_today");
  });

  it("permite quando não há bloqueios", () => {
    const reason = getStartWorkoutBlockReason({
      activeDays: [],
      todayIndex: 2,
      hasActiveSession: false,
    });
    expect(reason).toBeNull();
  });
});

