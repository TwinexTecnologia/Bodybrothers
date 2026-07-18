import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, asaas-access-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type SubscriptionRow = {
  id: string;
  personal_id: string;
  plan_slug: string | null;
  billing_cycle: string | null;
  status: string | null;
  student_limit: number | null;
  amount: number | null;
  currency: string | null;
  started_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  next_billing_at: string | null;
  blocked_at: string | null;
  grace_until: string | null;
  last_payment_id: string | null;
  last_payment_status: string | null;
  payment_provider: string | null;
  provider_subscription_id: string | null;
};

type SubscriptionPaymentRow = {
  id: string;
  personal_id: string;
  subscription_id: string;
  plan_slug: string;
  billing_cycle: string;
  amount: number;
  currency: string;
  status: "pending" | "approved" | "failed" | "canceled" | "refunded";
  provider: string | null;
  provider_payment_id: string | null;
  provider_reference: string | null;
  description: string | null;
  due_at: string | null;
  paid_at: string | null;
  raw_payload: Record<string, unknown>;
  created_at: string;
};

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return jsonResponse(405, { error: "Método não suportado." });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim() || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() || "";
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Secrets do webhook não configurados corretamente.");
    }

    authorizeAsaasWebhook(req);

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const body = await req.json().catch(() => ({}));
    if (!isRecord(body)) {
      return jsonResponse(200, {
        success: true,
        ignored: true,
        reason: "invalid_payload",
      });
    }

    const eventName = getString(body, ["event"]);
    if (!eventName) {
      return jsonResponse(200, {
        success: true,
        ignored: true,
        reason: "missing_event",
      });
    }

    if (eventName.startsWith("SUBSCRIPTION_")) {
      const handled = await handleSubscriptionEvent({ supabase, body, eventName });
      return jsonResponse(200, handled);
    }

    if (!eventName.startsWith("PAYMENT_")) {
      return jsonResponse(200, {
        success: true,
        ignored: true,
        reason: "unsupported_event",
        event: eventName,
      });
    }

    const gatewayPayment = await resolveGatewayPayment(body);
    const paymentContext = await resolvePaymentContext({
      supabase,
      gatewayPayment,
    });

    if (!paymentContext) {
      return jsonResponse(200, {
        success: true,
        ignored: true,
        reason: "payment_not_tracked",
        event: eventName,
        paymentId: getString(gatewayPayment, ["id"]),
      });
    }

    const normalizedStatus = normalizeAsaasPaymentStatus(
      getString(gatewayPayment, ["status"]),
      eventName,
    );
    const providerPaymentId = getString(gatewayPayment, ["id"]) || paymentContext.payment.provider_payment_id;
    const providerReference = resolveProviderReference(gatewayPayment) ||
      paymentContext.payment.provider_reference;
    const dueAt = resolveDueAt(gatewayPayment) || paymentContext.payment.due_at;
    const paidAt = normalizedStatus === "approved"
      ? resolvePaidAt(gatewayPayment) || paymentContext.payment.paid_at || new Date().toISOString()
      : null;

    const { data: updatedPayment, error: paymentUpdateError } = await supabase
      .from("subscription_payments")
      .update({
        status: normalizedStatus,
        provider: "asaas",
        provider_payment_id: providerPaymentId || null,
        provider_reference: providerReference || null,
        due_at: dueAt || null,
        paid_at: paidAt,
        raw_payload: body,
      })
      .eq("id", paymentContext.payment.id)
      .select("*")
      .single<SubscriptionPaymentRow>();

    if (paymentUpdateError || !updatedPayment) {
      throw paymentUpdateError ?? new Error("Não foi possível atualizar a cobrança do webhook Asaas.");
    }

    await syncSubscriptionWithPayment({
      supabase,
      subscription: paymentContext.subscription,
      payment: updatedPayment,
    });

    return jsonResponse(200, {
      success: true,
      event: eventName,
      paymentId: providerPaymentId,
      status: updatedPayment.status,
      approved: updatedPayment.status === "approved",
    });
  } catch (error) {
    return jsonResponse(error instanceof HttpError ? error.status : 500, {
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

function authorizeAsaasWebhook(req: Request) {
  const configuredToken = Deno.env.get("ASAAS_WEBHOOK_TOKEN")?.trim() || "";
  if (!configuredToken) return;

  const receivedToken = req.headers.get("asaas-access-token")?.trim() || "";
  if (!receivedToken || receivedToken !== configuredToken) {
    throw new HttpError(401, "Webhook Asaas não autorizado.");
  }
}

async function handleSubscriptionEvent({
  supabase,
  body,
  eventName,
}: {
  supabase: ReturnType<typeof createClient>;
  body: Record<string, unknown>;
  eventName: string;
}) {
  const subscriptionPayload = getRecord(body, ["subscription"]);
  const providerSubscriptionId = getString(subscriptionPayload, ["id"]);

  if (!providerSubscriptionId) {
    return {
      success: true,
      ignored: true,
      reason: "subscription_without_id",
      event: eventName,
    };
  }

  const { data: subscription, error } = await supabase
    .from("personal_subscriptions")
    .select("id, personal_id, plan_slug, billing_cycle, status, student_limit, amount, currency, started_at, current_period_start, current_period_end, next_billing_at, blocked_at, grace_until, last_payment_id, last_payment_status, payment_provider, provider_subscription_id")
    .eq("provider_subscription_id", providerSubscriptionId)
    .maybeSingle<SubscriptionRow>();

  if (error) throw error;
  if (!subscription) {
    return {
      success: true,
      ignored: true,
      reason: "subscription_not_tracked",
      event: eventName,
      providerSubscriptionId,
    };
  }

  const nextBillingAt = getString(subscriptionPayload, ["nextDueDate"]) || subscription.next_billing_at;
  const updatedAt = new Date().toISOString();

  if (eventName === "SUBSCRIPTION_DELETED") {
    const { error: updateError } = await supabase
      .from("personal_subscriptions")
      .update({
        status: "canceled",
        next_billing_at: nextBillingAt || null,
        updated_at: updatedAt,
      })
      .eq("id", subscription.id);

    if (updateError) throw updateError;
  }

  if (eventName === "SUBSCRIPTION_UPDATED" || eventName === "SUBSCRIPTION_CREATED") {
    const { error: updateError } = await supabase
      .from("personal_subscriptions")
      .update({
        payment_provider: "asaas",
        next_billing_at: nextBillingAt || null,
        updated_at: updatedAt,
      })
      .eq("id", subscription.id);

    if (updateError) throw updateError;
  }

  return {
    success: true,
    event: eventName,
    providerSubscriptionId,
  };
}

async function resolveGatewayPayment(body: Record<string, unknown>) {
  const payment = getRecord(body, ["payment"]);
  return payment;
}

async function resolvePaymentContext({
  supabase,
  gatewayPayment,
}: {
  supabase: ReturnType<typeof createClient>;
  gatewayPayment: Record<string, unknown>;
}) {
  const providerPaymentId = getString(gatewayPayment, ["id"]);
  const providerReference = resolveProviderReference(gatewayPayment);
  const providerSubscriptionId = resolveProviderSubscriptionId(gatewayPayment);

  let payment = await findPaymentByProviderPaymentId({
    supabase,
    providerPaymentId,
  });

  if (!payment && providerReference) {
    payment = await findPaymentByProviderReference({
      supabase,
      providerReference,
    });
  }

  let subscription: SubscriptionRow | null = null;

  if (payment) {
    subscription = await getSubscriptionById({
      supabase,
      subscriptionId: payment.subscription_id,
    });
  }

  if (!subscription && providerSubscriptionId) {
    subscription = await getSubscriptionByProviderSubscriptionId({
      supabase,
      providerSubscriptionId,
    });
  }

  if (!payment && subscription) {
    const gatewayAmount = getNumber(gatewayPayment, ["value"]);
    const { data: insertedPayment, error } = await supabase
      .from("subscription_payments")
      .insert({
        personal_id: subscription.personal_id,
        subscription_id: subscription.id,
        plan_slug: normalizePlan(subscription.plan_slug || "premium"),
        billing_cycle: subscription.billing_cycle || "monthly",
        amount: gatewayAmount ?? (
          typeof subscription.amount === "number" ? Number(subscription.amount) : 0
        ),
        currency: "BRL",
        status: normalizeAsaasPaymentStatus(getString(gatewayPayment, ["status"])),
        provider: "asaas",
        provider_payment_id: providerPaymentId || null,
        provider_reference: providerReference || null,
        description: getString(gatewayPayment, ["description"]) || "Cobrança da assinatura",
        due_at: resolveDueAt(gatewayPayment) || null,
        paid_at: resolvePaidAt(gatewayPayment) || null,
        raw_payload: gatewayPayment,
      })
      .select("*")
      .single<SubscriptionPaymentRow>();

    if (error || !insertedPayment) {
      throw error ?? new Error("Não foi possível criar a cobrança via webhook Asaas.");
    }

    payment = insertedPayment;
  }

  if (!payment || !subscription) {
    return null;
  }

  return { payment, subscription };
}

async function findPaymentByProviderPaymentId({
  supabase,
  providerPaymentId,
}: {
  supabase: ReturnType<typeof createClient>;
  providerPaymentId: string;
}) {
  if (!providerPaymentId) return null;

  const { data } = await supabase
    .from("subscription_payments")
    .select("*")
    .eq("provider_payment_id", providerPaymentId)
    .order("created_at", { ascending: false })
    .maybeSingle<SubscriptionPaymentRow>();

  return data ?? null;
}

async function findPaymentByProviderReference({
  supabase,
  providerReference,
}: {
  supabase: ReturnType<typeof createClient>;
  providerReference: string;
}) {
  const { data } = await supabase
    .from("subscription_payments")
    .select("*")
    .eq("provider_reference", providerReference)
    .order("created_at", { ascending: false })
    .maybeSingle<SubscriptionPaymentRow>();

  return data ?? null;
}

async function getSubscriptionById({
  supabase,
  subscriptionId,
}: {
  supabase: ReturnType<typeof createClient>;
  subscriptionId: string;
}) {
  const { data, error } = await supabase
    .from("personal_subscriptions")
    .select("id, personal_id, plan_slug, billing_cycle, status, student_limit, amount, currency, started_at, current_period_start, current_period_end, next_billing_at, blocked_at, grace_until, last_payment_id, last_payment_status, payment_provider, provider_subscription_id")
    .eq("id", subscriptionId)
    .maybeSingle<SubscriptionRow>();

  if (error) throw error;
  return data ?? null;
}

async function getSubscriptionByProviderSubscriptionId({
  supabase,
  providerSubscriptionId,
}: {
  supabase: ReturnType<typeof createClient>;
  providerSubscriptionId: string;
}) {
  const { data, error } = await supabase
    .from("personal_subscriptions")
    .select("id, personal_id, plan_slug, billing_cycle, status, student_limit, amount, currency, started_at, current_period_start, current_period_end, next_billing_at, blocked_at, grace_until, last_payment_id, last_payment_status, payment_provider, provider_subscription_id")
    .eq("provider_subscription_id", providerSubscriptionId)
    .maybeSingle<SubscriptionRow>();

  if (error) throw error;
  return data ?? null;
}

async function syncSubscriptionWithPayment({
  supabase,
  subscription,
  payment,
}: {
  supabase: ReturnType<typeof createClient>;
  subscription: SubscriptionRow;
  payment: SubscriptionPaymentRow;
}) {
  const nowIso = new Date().toISOString();

  if (payment.status === "approved") {
    const currentPeriodStart = nowIso;
    const currentPeriodEnd = calculateNextBillingAt(
      currentPeriodStart,
      subscription.billing_cycle || "monthly",
    );

    const { error } = await supabase
      .from("personal_subscriptions")
      .update({
        status: "active",
        amount: payment.amount,
        currency: payment.currency || "BRL",
        payment_provider: "asaas",
        last_payment_id: payment.provider_payment_id,
        last_payment_status: payment.status,
        started_at: subscription.started_at || currentPeriodStart,
        current_period_start: currentPeriodStart,
        current_period_end: currentPeriodEnd,
        next_billing_at: currentPeriodEnd,
        grace_until: null,
        blocked_at: null,
        updated_at: nowIso,
      })
      .eq("id", subscription.id);

    if (error) throw error;
    return;
  }

  const statusUpdate = payment.status === "canceled" || payment.status === "failed"
    ? { status: "past_due", blocked_at: subscription.blocked_at }
    : {};

  const { error } = await supabase
    .from("personal_subscriptions")
    .update({
      ...statusUpdate,
      last_payment_id: payment.provider_payment_id,
      last_payment_status: payment.status,
      payment_provider: "asaas",
      updated_at: nowIso,
    })
    .eq("id", subscription.id);

  if (error) throw error;
}

function resolveProviderReference(gatewayPayment: Record<string, unknown>) {
  return getString(gatewayPayment, ["externalReference"]);
}

function resolveProviderSubscriptionId(gatewayPayment: Record<string, unknown>) {
  const subscription = getRecord(gatewayPayment, ["subscription"]);
  return getString(subscription, ["id"]) ||
    getString(gatewayPayment, ["subscription"]) ||
    "";
}

function resolveDueAt(gatewayPayment: Record<string, unknown>) {
  return getString(gatewayPayment, ["dueDate", "originalDueDate", "clientPaymentDate"]);
}

function resolvePaidAt(gatewayPayment: Record<string, unknown>) {
  return getString(gatewayPayment, [
    "paymentDate",
    "clientPaymentDate",
    "confirmedDate",
    "creditDate",
    "dateCreated",
  ]);
}

function getRecord(
  body: Record<string, unknown>,
  keys: string[],
): Record<string, unknown> {
  for (const key of keys) {
    const value = body[key];
    if (isRecord(value)) return value;
  }

  return {};
}

function getString(body: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = body[key];
    if (typeof value === "string") {
      return value.trim();
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return "";
}

function getNumber(body: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = body[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value.replace(",", "."));
      if (Number.isFinite(parsed)) return parsed;
    }
  }

  return null;
}

function normalizePlan(value: string) {
  return value.trim().toLowerCase();
}

function normalizeAsaasPaymentStatus(
  paymentStatus: string,
  eventName = "",
): SubscriptionPaymentRow["status"] {
  const normalizedStatus = paymentStatus.trim().toLowerCase();
  const normalizedEvent = eventName.trim().toUpperCase();

  if (["received", "confirmed", "received_in_cash"].includes(normalizedStatus)) {
    return "approved";
  }

  if (
    [
      "pending",
      "awaiting_risk_analysis",
      "authorized",
    ].includes(normalizedStatus)
  ) {
    return "pending";
  }

  if (["overdue", "deleted"].includes(normalizedStatus)) {
    return "canceled";
  }

  if (["refunded", "partially_refunded"].includes(normalizedStatus)) {
    return "refunded";
  }

  if (
    [
      "refund_requested",
      "refund_in_progress",
      "chargeback_requested",
      "chargeback_dispute",
      "awaiting_chargeback_reversal",
    ].includes(normalizedStatus)
  ) {
    return "failed";
  }

  if (normalizedEvent === "PAYMENT_RECEIVED" || normalizedEvent === "PAYMENT_CONFIRMED") {
    return "approved";
  }
  if (normalizedEvent === "PAYMENT_OVERDUE" || normalizedEvent === "PAYMENT_DELETED") {
    return "canceled";
  }
  if (
    [
      "PAYMENT_REFUNDED",
      "PAYMENT_PARTIALLY_REFUNDED",
    ].includes(normalizedEvent)
  ) {
    return "refunded";
  }
  if (
    [
      "PAYMENT_CREDIT_CARD_CAPTURE_REFUSED",
      "PAYMENT_REPROVED_BY_RISK_ANALYSIS",
      "PAYMENT_CHARGEBACK_REQUESTED",
      "PAYMENT_CHARGEBACK_DISPUTE",
      "PAYMENT_AWAITING_CHARGEBACK_REVERSAL",
    ].includes(normalizedEvent)
  ) {
    return "failed";
  }

  return "pending";
}

function calculateNextBillingAt(startedAtIso: string, billingCycle: string) {
  const date = new Date(startedAtIso);

  if (billingCycle === "quarterly") {
    date.setMonth(date.getMonth() + 3);
  } else if (billingCycle === "yearly") {
    date.setFullYear(date.getFullYear() + 1);
  } else {
    date.setMonth(date.getMonth() + 1);
  }

  return date.toISOString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function jsonResponse(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}
