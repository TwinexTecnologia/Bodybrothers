import {
  computeElapsedSeconds,
  formatElapsedTime,
  isInactiveBeyondThreshold,
  TRAINING_INACTIVITY_THRESHOLD_MS,
} from "../lib/trainingSessionTypes";

describe("trainingSessionTypes", () => {
  it("computeElapsedSeconds subtrai pausas acumuladas", () => {
    const startedAt = "2026-03-31T12:00:00.000Z";
    const now = new Date("2026-03-31T12:05:00.000Z").getTime();
    expect(
      computeElapsedSeconds(
        {
          startedAt,
          totalPausedSeconds: 60,
          pauseStartedAt: null,
        },
        now,
      ),
    ).toBe(240);
  });

  it("computeElapsedSeconds congela no instante da pausa", () => {
    const startedAt = "2026-03-31T12:00:00.000Z";
    const pauseStartedAt = "2026-03-31T12:03:00.000Z";
    const now = new Date("2026-03-31T12:10:00.000Z").getTime();
    expect(
      computeElapsedSeconds(
        {
          startedAt,
          totalPausedSeconds: 0,
          pauseStartedAt,
        },
        now,
      ),
    ).toBe(180);
  });

  it("formatElapsedTime formata mm:ss e h:mm:ss", () => {
    expect(formatElapsedTime(90)).toBe("01:30");
    expect(formatElapsedTime(3665)).toBe("1:01:05");
  });

  it("TRAINING_INACTIVITY_THRESHOLD_MS é 4 horas", () => {
    expect(TRAINING_INACTIVITY_THRESHOLD_MS).toBe(4 * 60 * 60 * 1000);
  });

  it("isInactiveBeyondThreshold false antes de 4h desde lastInteractionAt", () => {
    const lastInteractionAt = "2026-03-31T08:00:00.000Z";
    const now = new Date("2026-03-31T11:59:59.999Z").getTime();
    expect(isInactiveBeyondThreshold({ lastInteractionAt }, now)).toBe(false);
  });

  it("isInactiveBeyondThreshold true a partir de 4h desde lastInteractionAt", () => {
    const lastInteractionAt = "2026-03-31T08:00:00.000Z";
    const now = new Date("2026-03-31T12:00:00.000Z").getTime();
    expect(isInactiveBeyondThreshold({ lastInteractionAt }, now)).toBe(true);
  });

  it("isInactiveBeyondThreshold false com lastInteractionAt inválido", () => {
    expect(
      isInactiveBeyondThreshold({ lastInteractionAt: "invalid" }, Date.now()),
    ).toBe(false);
  });
});
