import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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
    const mercadoPagoAccessToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN")?.trim() || "";

    if (!supabaseUrl || !serviceRoleKey || !mercadoPagoAccessToken) {
      throw new Error("Secrets do webhook não configurados corretamente.");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const body = await req.json().catch(() => ({}));
    const url = new URL(req.url);
    const eventType = resolveEventType(body, url);
    const paymentId = resolvePaymentId(body, url);

    if (eventType !== "payment" || !paymentId) {
      return jsonResponse(200, {
        success: true,
        ignored: true,
        reason: "unsupported_event",
      });
    }

    const gatewayPayment = await mercadoPagoRequest(`/v1/payments/${paymentId}`, {
      accessToken: mercadoPagoAccessToken,
    });

    const paymentContext = await resolvePaymentContext({
      supabase,
      gatewayPayment,
    });

    if (!paymentContext) {
      return jsonResponse(200, {
        success: true,
        ignored: true,
        reason: "payment_not_tracked",
        paymentId,
      });
    }

    const normalizedStatus = normalizePaymentStatus(
      getString(gatewayPayment, ["status"]) || paymentContext.payment.status,
    );
    const dueAt = getString(gatewayPayment, ["date_of_expiration", "expiration_date"]) || paymentContext.payment.due_at;
    const paidAt = getString(gatewayPayment, ["date_approved"]) || null;

    const { data: updatedPayment, error: paymentUpdateError } = await supabase
      .from("subscription_payments")
      .update({
        status: normalizedStatus,
        provider: "mercadopago",
        provider_payment_id: paymentId,
        provider_reference: resolveProviderReference(gatewayPayment) || paymentContext.payment.provider_reference,
        due_at: dueAt || null,
        paid_at: normalizedStatus === "approved" ? paidAt || new Date().toISOString() : null,
        raw_payload: gatewayPayment,
      })
      .eq("id", paymentContext.payment.id)
      .select("*")
      .single<SubscriptionPaymentRow>();

    if (paymentUpdateError || !updatedPayment) {
      throw paymentUpdateError ?? new Error("Não foi possível atualizar a cobrança do webhook.");
    }

    await syncSubscriptionWithPayment({
      supabase,
      subscription: paymentContext.subscription,
      payment: updatedPayment,
    });

    return jsonResponse(200, {
      success: true,
      paymentId,
      status: updatedPayment.status,
      approved: updatedPayment.status === "approved",
    });
  } catch (error) {
    return jsonResponse(500, {
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

async function resolvePaymentContext({
  supabase,
  gatewayPayment,
}: {
  supabase: ReturnType<typeof createClient>;
  gatewayPayment: Record<string, unknown>;
}) {
  const providerPaymentId = getScalarAsString(gatewayPayment.id);
  const providerReference = resolveProviderReference(gatewayPayment);
  const metadata = getRecord(gatewayPayment, ["metadata"]);
  const subscriptionId = getString(metadata, ["subscriptionId", "subscription_id"]);
  const personalId = getString(metadata, ["personalId", "personal_id"]);

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

  if (!payment && subscriptionId && personalId) {
    subscription = await getSubscriptionById({
      supabase,
      subscriptionId,
    });

    if (subscription && subscription.personal_id === personalId) {
      const { data: insertedPayment, error } = await supabase
        .from("subscription_payments")
        .insert({
          personal_id: personalId,
          subscription_id: subscription.id,
          plan_slug: normalizePlan(subscription.plan_slug || "premium"),
          billing_cycle: subscription.billing_cycle || "monthly",
          amount: typeof subscription.amount === "number" ? Number(subscription.amount) : 0,
          currency: subscription.currency || "BRL",
          status: normalizePaymentStatus(getString(gatewayPayment, ["status"]) || "pending"),
          provider: "mercadopago",
          provider_payment_id: providerPaymentId || null,
          provider_reference: providerReference || null,
          description: getString(gatewayPayment, ["description"]) || "Regularização da assinatura",
          due_at: getString(gatewayPayment, ["date_of_expiration", "expiration_date"]) || null,
          paid_at: getString(gatewayPayment, ["date_approved"]) || null,
          raw_payload: gatewayPayment,
        })
        .select("*")
        .single<SubscriptionPaymentRow>();

      if (error || !insertedPayment) {
        throw error ?? new Error("Não foi possível criar a cobrança via webhook.");
      }

      payment = insertedPayment;
    }
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
    .select("id, personal_id, plan_slug, billing_cycle, status, student_limit, amount, currency, started_at, current_period_start, current_period_end, next_billing_at, blocked_at, grace_until, last_payment_id, last_payment_status, payment_provider")
    .eq("id", subscriptionId)
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
        payment_provider: payment.provider || "mercadopago",
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

  const { error } = await supabase
    .from("personal_subscriptions")
    .update({
      last_payment_id: payment.provider_payment_id,
      last_payment_status: payment.status,
      payment_provider: payment.provider || subscription.payment_provider || "mercadopago",
      updated_at: nowIso,
    })
    .eq("id", subscription.id);

  if (error) throw error;
}

async function mercadoPagoRequest(
  path: string,
  config: { accessToken: string },
) {
  const response = await fetch(`https://api.mercadopago.com${path}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.accessToken}`,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      typeof data?.message === "string" ? data.message : "Erro ao consultar o Mercado Pago.",
    );
  }

  return isRecord(data) ? data : {};
}

function resolveEventType(body: unknown, url: URL) {
  const bodyRecord = isRecord(body) ? body : {};
  return getString(bodyRecord, ["type", "topic"]) ||
    url.searchParams.get("type") ||
    url.searchParams.get("topic") ||
    "";
}

function resolvePaymentId(body: unknown, url: URL) {
  const bodyRecord = isRecord(body) ? body : {};
  const dataRecord = getRecord(bodyRecord, ["data"]);

  return getString(dataRecord, ["id"]) ||
    getString(bodyRecord, ["id"]) ||
    url.searchParams.get("data.id") ||
    url.searchParams.get("id") ||
    "";
}

function resolveProviderReference(gatewayPayment: Record<string, unknown>) {
  const metadata = getRecord(gatewayPayment, ["metadata"]);
  return getString(gatewayPayment, ["external_reference"]) ||
    getString(metadata, ["providerReference", "provider_reference"]) ||
    "";
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

function getScalarAsString(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function normalizePlan(value: string) {
  return value.trim().toLowerCase();
}

function normalizePaymentStatus(value: string): SubscriptionPaymentRow["status"] {
  const normalized = value.trim().toLowerCase();

  if (normalized === "approved") return "approved";
  if (normalized === "pending" || normalized === "in_process") return "pending";
  if (normalized === "canceled" || normalized === "cancelled") return "canceled";
  if (normalized === "refunded" || normalized === "charged_back") return "refunded";
  if (normalized === "failed" || normalized === "rejected") return "failed";

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
