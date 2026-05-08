import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

type ProfileRow = {
  id: string;
  plan_id: string | null;
  due_day: number | null;
  data: {
    planId?: string;
    dueDay?: number;
    planStartDate?: string;
  } | null;
};

type PlanRow = {
  id: string;
  title: string;
  price: number;
  due_day: number | null;
  frequency?: string | null;
};

type DebitRow = {
  id: string;
  amount: number | string;
  due_date: string;
  paid_at?: string | null;
  status: string;
  saas_ref_month?: string | null;
};

type ProtocolRow = {
  id: string;
  ends_at?: string | null;
  data?: Record<string, unknown> | null;
};

type Charge = {
  id: string;
  date: Date;
  amount: number;
  status: string;
};

type StudentBellNotification = {
  id: string;
  source: "student_bell";
  type: "financial" | "anamnesis";
  title: string;
  message: string;
  route: "/financial" | "/anamnesis";
  daysRemaining: number;
  date: string;
  dedupeKey: string;
  entityId?: string;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body =
      req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const userIdFilter =
      typeof body?.userId === "string" ? body.userId : undefined;

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausente.");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let tokensQuery = supabase
      .from("user_push_tokens")
      .select("user_id, token")
      .eq("app_source", "student_mobile")
      .is("disabled_at", null);

    if (userIdFilter) {
      tokensQuery = tokensQuery.eq("user_id", userIdFilter);
    }

    const { data: tokenRows, error: tokenError } = await tokensQuery;
    if (tokenError) throw tokenError;

    const tokensByUser = new Map<string, string[]>();
    for (const row of tokenRows ?? []) {
      const userTokens = tokensByUser.get(row.user_id) ?? [];
      userTokens.push(row.token);
      tokensByUser.set(row.user_id, userTokens);
    }

    const summary = {
      users: tokensByUser.size,
      notificationsEvaluated: 0,
      notificationsSent: 0,
      notificationsSkipped: 0,
      tokenDeliveries: 0,
      errors: [] as string[],
    };

    for (const [userId, tokens] of tokensByUser.entries()) {
      if (tokens.length === 0) continue;

      const notifications = await buildNotificationsForUser(supabase, userId);
      summary.notificationsEvaluated += notifications.length;

      for (const notification of notifications) {
        const dispatchId = await reserveDispatch(supabase, userId, notification);
        if (!dispatchId) {
          summary.notificationsSkipped += 1;
          continue;
        }

        try {
          const { tickets, invalidTokens } = await sendExpoPushMessages(
            tokens,
            notification,
          );

          if (invalidTokens.length > 0) {
            await disableTokens(supabase, invalidTokens);
          }

          const anySuccess = tickets.some((ticket) => ticket.status === "ok");
          const anyError = tickets.some((ticket) => ticket.status === "error");

          await supabase
            .from("push_notification_dispatches")
            .update({
              status: anySuccess || !anyError ? "sent" : "error",
              token_count: tokens.length,
              expo_ticket_ids: tickets,
              error_message: anyError && !anySuccess ? "Expo push error" : null,
              sent_at: new Date().toISOString(),
            })
            .eq("id", dispatchId);

          summary.notificationsSent += 1;
          summary.tokenDeliveries += tokens.length;
        } catch (error) {
          await supabase
            .from("push_notification_dispatches")
            .update({
              status: "error",
              token_count: tokens.length,
              error_message:
                error instanceof Error ? error.message : "Unknown error",
              sent_at: new Date().toISOString(),
            })
            .eq("id", dispatchId);

          summary.errors.push(
            `Falha ao enviar push para ${userId}: ${
              error instanceof Error ? error.message : "Unknown error"
            }`,
          );
        }
      }
    }

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

async function buildNotificationsForUser(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<StudentBellNotification[]> {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, plan_id, due_day, data")
    .eq("id", userId)
    .single<ProfileRow>();

  if (profileError || !profile) {
    throw profileError ?? new Error(`Perfil ${userId} não encontrado.`);
  }

  const financialInfo = {
    planId: profile.plan_id ?? profile.data?.planId ?? null,
    dueDay: profile.due_day ?? profile.data?.dueDay ?? null,
    planStartDate: profile.data?.planStartDate ?? null,
  };

  const [
    planResult,
    paidDebitsResult,
    anamnesisModelsResult,
    anamnesisResponsesResult,
  ] = await Promise.all([
    financialInfo.planId
      ? supabase
          .from("plans")
          .select("id, title, price, due_day, frequency")
          .eq("id", financialInfo.planId)
          .single<PlanRow>()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from("debits")
      .select("id, amount, due_date, paid_at, status, saas_ref_month")
      .eq("payer_id", userId)
      .eq("status", "paid"),
    supabase
      .from("protocols")
      .select("id, ends_at")
      .eq("student_id", userId)
      .eq("type", "anamnesis_model"),
    supabase
      .from("protocols")
      .select("id, data")
      .eq("student_id", userId)
      .eq("type", "anamnesis"),
  ]);

  if (planResult.error) throw planResult.error;
  if (paidDebitsResult.error) throw paidDebitsResult.error;
  if (anamnesisModelsResult.error) throw anamnesisModelsResult.error;
  if (anamnesisResponsesResult.error) throw anamnesisResponsesResult.error;

  const chargesList = buildCharges(
    financialInfo,
    planResult.data ?? null,
    (paidDebitsResult.data ?? []) as DebitRow[],
  );

  const models = (anamnesisModelsResult.data ?? []) as ProtocolRow[];
  const responses = (anamnesisResponsesResult.data ?? []) as ProtocolRow[];

  const expiredCount = models.filter((model) => {
    const hasResponse = responses.some(
      (response) => response.data?.modelId === model.id,
    );
    if (hasResponse || !model.ends_at) return false;
    return model.ends_at < toDateKey(new Date());
  }).length;

  const pendingModels = models.filter((model) => {
    const hasResponse = responses.some(
      (response) => response.data?.modelId === model.id,
    );
    return !hasResponse && typeof model.ends_at === "string";
  });

  return buildStudentBellNotifications({
    chargesList,
    expiringModels: pendingModels
      .filter((model) => Boolean(model.ends_at))
      .map((model) => ({
        id: model.id,
        ends_at: model.ends_at as string,
      })),
    anamnesisStatus: expiredCount > 0 ? "expired" : pendingModels.length > 0 ? "pending" : "regular",
    expiredCount,
  });
}

function buildCharges(
  info: {
    planId: string | null;
    dueDay: number | null;
    planStartDate: string | null;
  },
  plan: PlanRow | null,
  paidDebits: DebitRow[],
): Charge[] {
  if (!info.planStartDate || !plan) return [];

  let dateValue = info.planStartDate;
  if (dateValue.includes("T")) {
    dateValue = dateValue.split("T")[0];
  }

  const start = parseLocalDateString(dateValue);
  if (Number.isNaN(start.getTime())) return [];

  const today = new Date();
  const limit = new Date(today);
  limit.setMonth(limit.getMonth() + 6);

  const dueDay = info.dueDay ?? plan.due_day ?? 10;
  const generated: Charge[] = [];
  const current = new Date(start);

  if (plan.frequency !== "weekly") {
    current.setDate(dueDay);
  }

  let loopCount = 0;
  while (current <= limit && loopCount < 1000) {
    loopCount += 1;
    let chargeDate: Date | null = null;

    if (plan.frequency !== "weekly") {
      const diffMonths =
        (current.getFullYear() - start.getFullYear()) * 12 +
        (current.getMonth() - start.getMonth());
      const interval = getFrequencyInterval(plan.frequency ?? "monthly");

      if (diffMonths >= 0 && diffMonths % interval === 0) {
        chargeDate = new Date(current.getFullYear(), current.getMonth(), dueDay);
      }

      current.setMonth(current.getMonth() + 1);
    } else {
      chargeDate = new Date(current);
      current.setDate(current.getDate() + 7);
    }

    if (!chargeDate) continue;

    const dueDateKey = toDateKey(chargeDate);
    const payment = paidDebits.find((debit) => {
      if (debit.due_date === dueDateKey) return true;
      if (plan.frequency !== "weekly" && debit.saas_ref_month) {
        const refDate = new Date(debit.saas_ref_month);
        return (
          refDate.getMonth() === chargeDate!.getMonth() &&
          refDate.getFullYear() === chargeDate!.getFullYear()
        );
      }
      return false;
    });

    let status = "pending";
    if (payment) {
      status = "paid";
    } else if (
      chargeDate < new Date() &&
      chargeDate.getDate() !== new Date().getDate()
    ) {
      status = "overdue";
    }

    generated.push({
      id: payment?.id ?? dueDateKey,
      date: chargeDate,
      amount: Number(plan.price),
      status,
    });
  }

  return generated.sort((left, right) => left.date.getTime() - right.date.getTime());
}

function buildStudentBellNotifications({
  chargesList,
  expiringModels,
  anamnesisStatus,
  expiredCount,
}: {
  chargesList: Charge[];
  expiringModels: Array<{ id: string; ends_at: string }>;
  anamnesisStatus: "regular" | "pending" | "expired";
  expiredCount: number;
}): StudentBellNotification[] {
  const today = startOfDay(new Date());
  const notifications: StudentBellNotification[] = [];

  chargesList.forEach((charge, index) => {
    const dueDate = startOfDay(charge.date);
    const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / DAY_IN_MS);
    const dateKey = toDateKey(dueDate);
    const baseId = charge.id || `${dateKey}-${index}`;

    if (charge.status === "pending" && diffDays >= 0 && diffDays <= 5) {
      notifications.push({
        id: `fin-${baseId}`,
        source: "student_bell",
        type: "financial",
        title: "Financeiro",
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
      notifications.push({
        id: `fin-overdue-${baseId}`,
        source: "student_bell",
        type: "financial",
        title: "Financeiro",
        message: "Você possui uma fatura vencida!",
        route: "/financial",
        daysRemaining: -1,
        date: dateKey,
        dedupeKey: `student-bell:financial-overdue:${dateKey}:${baseId}`,
      });
    }
  });

  if (anamnesisStatus === "expired") {
    notifications.push({
      id: "anam-expired",
      source: "student_bell",
      type: "anamnesis",
      title: "Anamnese",
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
    if (diffDays < 0 || diffDays > 3) return;

    const dateKey = toDateKey(dueDate);
    notifications.push({
      id: `anam-${model.id}`,
      source: "student_bell",
      type: "anamnesis",
      title: "Anamnese",
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
  });

  return notifications.sort(
    (left, right) => left.daysRemaining - right.daysRemaining,
  );
}

async function reserveDispatch(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  notification: StudentBellNotification,
): Promise<string | null> {
  const today = toDateKey(new Date());
  const { data, error } = await supabase
    .from("push_notification_dispatches")
    .insert({
      user_id: userId,
      notification_key: notification.dedupeKey,
      delivery_date: today,
      channel: "student_bell",
      payload: notification,
      status: "reserved",
    })
    .select("id")
    .single<{ id: string }>();

  if (error) {
    if (error.code === "23505") {
      return null;
    }
    throw error;
  }

  return data.id;
}

async function sendExpoPushMessages(
  tokens: string[],
  notification: StudentBellNotification,
): Promise<{
  tickets: Array<Record<string, unknown>>;
  invalidTokens: string[];
}> {
  const messages = tokens.map((token) => ({
    to: token,
    title: notification.title,
    body: notification.message,
    sound: "default",
    priority: "high",
    channelId: "student_bell",
    data: {
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
    },
  }));

  const response = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Accept-encoding": "gzip, deflate",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(messages),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const payload = await response.json();
  const tickets = Array.isArray(payload.data) ? payload.data : [];
  const invalidTokens = tickets.flatMap(
    (ticket: Record<string, unknown>, index: number) => {
      const details =
        typeof ticket.details === "object" && ticket.details != null
          ? (ticket.details as Record<string, unknown>)
          : null;

      if (details?.error === "DeviceNotRegistered") {
        return [tokens[index]];
      }

      return [];
    },
  );

  return { tickets, invalidTokens };
}

async function disableTokens(
  supabase: ReturnType<typeof createClient>,
  tokens: string[],
): Promise<void> {
  if (tokens.length === 0) return;

  await supabase
    .from("user_push_tokens")
    .update({ disabled_at: new Date().toISOString() })
    .in("token", tokens);
}

function getFrequencyInterval(frequency: string): number {
  if (frequency === "bimonthly") return 2;
  if (frequency === "quarterly") return 3;
  if (frequency === "semiannual") return 6;
  if (frequency === "annual") return 12;
  return 1;
}

function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
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
