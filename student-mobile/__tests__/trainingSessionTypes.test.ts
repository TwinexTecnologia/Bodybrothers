import {
  computeElapsedSeconds,
  formatElapsedTime,
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
});
