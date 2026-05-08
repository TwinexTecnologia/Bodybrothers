const DAY_IN_MS = 24 * 60 * 60 * 1000;

export type StudentBellNotificationType = "financial" | "anamnesis";
export type StudentBellNotificationRoute = "/financial" | "/anamnesis";

export type StudentBellNotification = {
  id: string;
  source: "student_bell";
  type: StudentBellNotificationType;
  title: string;
  message: string;
  route: StudentBellNotificationRoute;
  daysRemaining: number;
  date: string;
  dedupeKey: string;
  entityId?: string;
};

type ChargeLike = {
  id?: string;
  date: Date | string;
  status: string;
};

type ExpiringModelLike = {
  id: string;
  ends_at: string;
};

type BuildStudentBellNotificationsArgs = {
  chargesList: ChargeLike[];
  expiringModels: ExpiringModelLike[];
  anamnesisStatus: "regular" | "pending" | "expired";
  expiredCount: number;
  referenceDate?: Date;
};

export type StudentBellPushData = {
  notificationKind: "student_bell";
  id: string;
  source: "student_bell";
  type: StudentBellNotificationType;
  title: string;
  message: string;
  route: StudentBellNotificationRoute;
  date: string;
  daysRemaining: number;
  dedupeKey: string;
  entityId?: string;
};

export function buildStudentBellNotifications({
  chargesList,
  expiringModels,
  anamnesisStatus,
  expiredCount,
  referenceDate = new Date(),
}: BuildStudentBellNotificationsArgs): {
  notifications: StudentBellNotification[];
  hasCritical: boolean;
} {
  const notifications: StudentBellNotification[] = [];
  const today = startOfDay(referenceDate);
  let hasCritical = false;

  chargesList.forEach((charge, index) => {
    const chargeDate = normalizeDate(charge.date);
    const dueDate = startOfDay(chargeDate);
    const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / DAY_IN_MS);
    const dateKey = toDateKey(dueDate);
    const baseId = charge.id ?? `${dateKey}-${index}`;

    if (charge.status === "pending" && diffDays >= 0 && diffDays <= 5) {
      notifications.push({
        id: `fin-${baseId}`,
        source: "student_bell",
        type: "financial",
        title: getStudentBellNotificationTitle("financial"),
        message:
          diffDays === 0
            ? "Sua fatura vence hoje!"
            : `Sua fatura vence em ${diffDays} dia${diffDays > 1 ? "s" : ""}.`,
        route: "/financial",
        daysRemaining: diffDays,
        date: dateKey,
        dedupeKey: `student-bell:financial:${dateKey}:${baseId}`,
      });
      return;
    }

    if (charge.status === "overdue") {
      hasCritical = true;
      notifications.push({
        id: `fin-overdue-${baseId}`,
        source: "student_bell",
        type: "financial",
        title: getStudentBellNotificationTitle("financial"),
        message: "Você possui uma fatura vencida!",
        route: "/financial",
        daysRemaining: -1,
        date: dateKey,
        dedupeKey: `student-bell:financial-overdue:${dateKey}:${baseId}`,
      });
    }
  });

  if (anamnesisStatus === "expired") {
    hasCritical = true;
    notifications.push({
      id: "anam-expired",
      source: "student_bell",
      type: "anamnesis",
      title: getStudentBellNotificationTitle("anamnesis"),
      message: `Você tem ${expiredCount} anamnese(s) vencida(s). Responda agora!`,
      route: "/anamnesis",
      daysRemaining: -1,
      date: toDateKey(today),
      dedupeKey: `student-bell:anamnesis-expired:${toDateKey(today)}:${expiredCount}`,
    });
  }

  expiringModels.forEach((model) => {
    const dueDate = parseLocalDateString(model.ends_at);
    const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / DAY_IN_MS);

    if (diffDays >= 0 && diffDays <= 3) {
      const dateKey = toDateKey(dueDate);
      notifications.push({
        id: `anam-${model.id}`,
        source: "student_bell",
        type: "anamnesis",
        title: getStudentBellNotificationTitle("anamnesis"),
        message:
          diffDays === 0
            ? "Sua anamnese vence hoje!"
            : `Atualize sua anamnese em ${diffDays} dia${diffDays > 1 ? "s" : ""}.`,
        route: "/anamnesis",
        daysRemaining: diffDays,
        date: dateKey,
        dedupeKey: `student-bell:anamnesis:${dateKey}:${model.id}`,
        entityId: model.id,
      });
    }
  });

  notifications.sort((left, right) => left.daysRemaining - right.daysRemaining);

  return { notifications, hasCritical };
}

export function getStudentBellNotificationTitle(
  type: StudentBellNotificationType,
): string {
  return type === "anamnesis" ? "Anamnese" : "Financeiro";
}

export function serializeStudentBellPushData(
  notification: StudentBellNotification,
): StudentBellPushData {
  return {
    notificationKind: "student_bell",
    id: notification.id,
    source: notification.source,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    route: notification.route,
    date: notification.date,
    daysRemaining: notification.daysRemaining,
    dedupeKey: notification.dedupeKey,
    entityId: notification.entityId,
  };
}

export function isStudentBellPushData(
  data: unknown,
): data is StudentBellPushData {
  if (typeof data !== "object" || data == null) return false;

  const candidate = data as Record<string, unknown>;
  return (
    candidate.notificationKind === "student_bell" &&
    candidate.source === "student_bell" &&
    (candidate.type === "financial" || candidate.type === "anamnesis") &&
    (candidate.route === "/financial" || candidate.route === "/anamnesis") &&
    typeof candidate.message === "string" &&
    typeof candidate.title === "string"
  );
}

function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function normalizeDate(input: Date | string): Date {
  if (input instanceof Date) return input;
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    return parseLocalDateString(input);
  }

  return new Date(input);
}

function parseLocalDateString(value: string): Date {
  const parts = value.split("-").map(Number);
  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) {
    return new Date(value);
  }

  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}
