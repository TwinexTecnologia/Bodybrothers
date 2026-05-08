import {
  buildStudentBellNotifications,
  isStudentBellPushData,
  serializeStudentBellPushData,
} from "../lib/studentBellNotifications";

describe("studentBellNotifications", () => {
  it("builds the same finance and anamnesis messages used by the bell", () => {
    const referenceDate = new Date(2026, 4, 6);
    const { notifications, hasCritical } = buildStudentBellNotifications({
      referenceDate,
      chargesList: [
        { id: "charge-today", date: new Date(2026, 4, 6), status: "pending" },
        { id: "charge-overdue", date: new Date(2026, 4, 2), status: "overdue" },
      ],
      expiringModels: [{ id: "model-1", ends_at: "2026-05-07" }],
      anamnesisStatus: "expired",
      expiredCount: 2,
    });

    expect(hasCritical).toBe(true);
    expect(notifications.map((item) => item.message)).toEqual([
      "Você possui uma fatura vencida!",
      "Você tem 2 anamnese(s) vencida(s). Responda agora!",
      "Sua fatura vence hoje!",
      "Atualize sua anamnese em 1 dia.",
    ]);
    expect(notifications.map((item) => item.route)).toEqual([
      "/financial",
      "/anamnesis",
      "/financial",
      "/anamnesis",
    ]);
  });

  it("serializes push payloads with a stable student bell contract", () => {
    const { notifications } = buildStudentBellNotifications({
      referenceDate: new Date(2026, 4, 6),
      chargesList: [
        { id: "charge-1", date: new Date(2026, 4, 8), status: "pending" },
      ],
      expiringModels: [],
      anamnesisStatus: "regular",
      expiredCount: 0,
    });

    const payload = serializeStudentBellPushData(notifications[0]);

    expect(isStudentBellPushData(payload)).toBe(true);
    expect(payload).toMatchObject({
      notificationKind: "student_bell",
      source: "student_bell",
      route: "/financial",
      message: "Sua fatura vence em 2 dias.",
    });
  });
});
