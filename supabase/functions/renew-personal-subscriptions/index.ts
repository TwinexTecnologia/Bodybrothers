import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PLAN_PRICES: Record<string, number> = {
  starter: 14.9,
  premium: 39.9,
  pro: 39.9,
  elite: 39.9,
  unlimited: 39.9,
};

type SubscriptionRow = {
  id: string;
  personal_id: string;
  plan_slug: string | null;
  billing_cycle: string | null;
  status: string | null;
  amount: number | null;
  currency: string | null;
  next_billing_at: string | null;
  grace_until: string | null;
  blocked_at: string | null;
  last_payment_id: string | null;
  last_payment_status: string | null;
  payment_provider: string | null;
  provider_subscription_id?: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  started_at?: string | null;
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

type ProfileRow = {
  id: string;
  email: string | null;
  data: Record<string, unknown> | null;
};

type PersonalPaymentMethodRow = {
  provider: string | null;
  provider_customer_id: string | null;
  provider_card_id: string | null;
  provider_payment_profile_id: string | null;
  payment_method_id: string | null;
  issuer_id: string | null;
  brand: string | null;
  last_four: string | null;
  first_payment_provider_payment_id: string | null;
  updated_at: string | null;
};

type SavedPaymentMethod = {
  provider: "mercadopago";
  providerCustomerId: string;
  providerCardId: string | null;
  providerPaymentProfileId: string | null;
  paymentMethodId: string | null;
  issuerId: string | null;
  brand: string | null;
  lastFour: string | null;
  firstPaymentProviderPaymentId: string | null;
  updatedAt: string;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      throw new Error("Método não suportado.");
    }

    authorizeCronRequest(req);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim() || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() || "";
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausente.");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const body = await req.json().catch(() => ({}));
    const limit = Math.max(1, Math.min(Number(body?.limit) || 25, 100));
    const nowIso = new Date().toISOString();

    const { data: dueSubscriptions, error: dueSubscriptionsError } = await supabase
      .from("personal_subscriptions")
      .select("id, personal_id, plan_slug, billing_cycle, status, amount, currency, next_billing_at, grace_until, blocked_at, last_payment_id, last_payment_status, payment_provider, provider_subscription_id, current_period_start, current_period_end, started_at")
      .eq("status", "active")
      .neq("plan_slug", "free")
      .lte("next_billing_at", nowIso)
      .order("next_billing_at", { ascending: true })
      .limit(limit)
      .returns<SubscriptionRow[]>();

    if (dueSubscriptionsError) throw dueSubscriptionsError;

    const results: Array<Record<string, unknown>> = [];
    let approvedCount = 0;
    let pendingCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    for (const subscription of dueSubscriptions || []) {
      const baseProviderReference = buildProviderReference({
        personalId: subscription.personal_id,
        subscriptionId: subscription.id,
        prefix: "renew",
        suffix: formatReferenceDate(subscription.next_billing_at || nowIso),
      });
      let providerReference = baseProviderReference;

      try {
        const { data: existingPayment } = await supabase
          .from("subscription_payments")
          .select("id, status, provider_reference")
          .eq("provider_reference", baseProviderReference)
          .maybeSingle<{ id: string; status: SubscriptionPaymentRow["status"]; provider_reference: string | null }>();

        if (existingPayment?.id) {
          if (existingPayment.status === "failed" || existingPayment.status === "canceled") {
            providerReference = buildProviderReference({
              personalId: subscription.personal_id,
              subscriptionId: subscription.id,
              prefix: "renew",
              suffix: `${formatReferenceDate(subscription.next_billing_at || nowIso)}_retry_${Date.now()}`,
            });
          } else {
          skippedCount += 1;
          results.push({
            subscriptionId: subscription.id,
            personalId: subscription.personal_id,
            status: existingPayment.status,
            action: "skipped_existing_reference",
            providerReference: baseProviderReference,
          });
          continue;
          }
        }

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("id, email, data")
          .eq("id", subscription.personal_id)
          .single<ProfileRow>();

        if (profileError || !profile) {
          throw profileError ?? new Error("Perfil do personal não encontrado para renovação.");
        }

        const config = getMercadoPagoConfig();
        const email = normalizeEmail(profile.email || "");
        if (!email) {
          throw new Error("Email do personal não encontrado para renovação.");
        }

        const profileSavedMethod = extractSavedPaymentMethod(profile.data);
        const { data: storedPaymentMethod, error: storedPaymentMethodError } = await supabase
          .from("personal_payment_methods")
          .select("provider, provider_customer_id, provider_card_id, provider_payment_profile_id, payment_method_id, issuer_id, brand, last_four, first_payment_provider_payment_id, updated_at")
          .eq("personal_id", subscription.personal_id)
          .eq("status", "active")
          .maybeSingle<PersonalPaymentMethodRow>();

        if (storedPaymentMethodError) {
          throw storedPaymentMethodError;
        }

        const baseSavedMethod = mapStoredPaymentMethod(storedPaymentMethod) || profileSavedMethod;
        if (!baseSavedMethod) {
          const failedPayment = await createLocalFailedRenewalPayment({
            supabase,
            subscription,
            providerReference,
            message: "Nenhum cartão salvo foi encontrado para a renovação automática.",
          });
          await syncSubscriptionWithRenewalPayment({
            supabase,
            subscription,
            payment: failedPayment,
          });
          failedCount += 1;
          results.push({
            subscriptionId: subscription.id,
            personalId: subscription.personal_id,
            status: failedPayment.status,
            action: "failed_missing_saved_card",
            providerReference,
          });
          continue;
        }

        if (!profileSavedMethod && baseSavedMethod) {
          await savePaymentMethodToProfile({
            supabase,
            personalId: profile.id,
            currentData: profile.data,
            paymentMethod: baseSavedMethod,
          });
        }

        let savedPaymentMethod = baseSavedMethod;

        if (!savedPaymentMethod.paymentMethodId && savedPaymentMethod.providerCardId) {
          const gatewayCard = await getMercadoPagoCustomerCard({
            customerId: savedPaymentMethod.providerCustomerId,
            cardId: savedPaymentMethod.providerCardId,
            config,
          });

          savedPaymentMethod = buildSavedPaymentMethod({
            providerCustomerId: savedPaymentMethod.providerCustomerId,
            cardResponse: gatewayCard,
            fallbackBrand: savedPaymentMethod.brand || "",
            fallbackFirstPaymentProviderPaymentId: savedPaymentMethod.firstPaymentProviderPaymentId,
          });

          await savePaymentMethodToProfile({
            supabase,
            personalId: profile.id,
            currentData: profile.data,
            paymentMethod: savedPaymentMethod,
          });
        }

        const amount = resolveSubscriptionAmount(subscription);
        const description = buildPaymentDescription(subscription.plan_slug || "premium");
        const automaticPaymentContext = await resolveAutomaticPaymentContext({
          supabase,
          subscription,
          savedPaymentMethod,
        });

        let insertedPayment: SubscriptionPaymentRow;

        try {
          const gatewayPayment = await createSavedCardPayment({
            personalId: subscription.personal_id,
            subscriptionId: subscription.id,
            providerReference,
            plan: normalizePlan(subscription.plan_slug || "premium"),
            amount,
            email,
            description,
            config,
            savedPaymentMethod,
            automaticPaymentContext,
          });

          const normalizedStatus = normalizePaymentStatus(
            extractGatewayPaymentStatus(gatewayPayment) || getString(gatewayPayment, ["status"]) || "pending",
          );
          const providerPaymentId = extractGatewayPaymentId(gatewayPayment);
          const paidAt = getString(gatewayPayment, ["date_approved", "last_updated_date", "date_created"]) || null;
          const dueAt = getString(gatewayPayment, ["date_of_expiration", "expiration_date"]) ||
            subscription.next_billing_at;

          const { data, error } = await supabase
            .from("subscription_payments")
            .insert({
              personal_id: subscription.personal_id,
              subscription_id: subscription.id,
              plan_slug: normalizePlan(subscription.plan_slug || "premium"),
              billing_cycle: subscription.billing_cycle || "monthly",
              amount,
              currency: subscription.currency || "BRL",
              status: normalizedStatus,
              provider: "mercadopago",
              provider_payment_id: providerPaymentId || null,
              provider_reference: providerReference,
              description,
              due_at: dueAt || null,
              paid_at: normalizedStatus === "approved" ? paidAt || new Date().toISOString() : null,
              raw_payload: gatewayPayment,
            })
            .select("*")
            .single<SubscriptionPaymentRow>();

          if (error || !data) {
            throw error ?? new Error("Não foi possível salvar a cobrança de renovação.");
          }

          insertedPayment = data;
        } catch (error) {
          insertedPayment = await createLocalFailedRenewalPayment({
            supabase,
            subscription,
            providerReference,
            message: error instanceof Error ? error.message : "Erro ao cobrar o cartão salvo.",
          });
        }

        await syncSubscriptionWithRenewalPayment({
          supabase,
          subscription,
          payment: insertedPayment,
        });

        if (insertedPayment.status === "approved") {
          approvedCount += 1;
        } else if (insertedPayment.status === "pending") {
          pendingCount += 1;
        } else {
          failedCount += 1;
        }

        results.push({
          subscriptionId: subscription.id,
          personalId: subscription.personal_id,
          paymentId: insertedPayment.id,
          providerPaymentId: insertedPayment.provider_payment_id,
          status: insertedPayment.status,
          providerReference,
        });
      } catch (error) {
        failedCount += 1;
        results.push({
          subscriptionId: subscription.id,
          personalId: subscription.personal_id,
          status: "failed",
          action: "renewal_error",
          message: error instanceof Error ? error.message : "Unknown error",
          providerReference,
        });
      }
    }

    return jsonResponse(200, {
      success: true,
      processed: results.length,
      approvedCount,
      pendingCount,
      failedCount,
      skippedCount,
      results,
    });
  } catch (error) {
    return jsonResponse(400, {
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

function authorizeCronRequest(req: Request) {
  const cronSecret = (
    Deno.env.get("RENEW_SUBSCRIPTIONS_CRON_SECRET") ||
    Deno.env.get("CRON_SECRET") ||
    ""
  ).trim();

  if (!cronSecret) {
    throw new Error("RENEW_SUBSCRIPTIONS_CRON_SECRET não configurado.");
  }

  const authorization = req.headers.get("Authorization") ?? "";
  const bearerToken = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";
  const headerSecret = req.headers.get("x-cron-secret")?.trim() || "";

  if (bearerToken !== cronSecret && headerSecret !== cronSecret) {
    throw new Error("Sem permissão para executar a renovação automática.");
  }
}

function jsonResponse(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizePlan(value: string) {
  return value.trim().toLowerCase();
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function getString(value: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const entry = value[key];
    if (typeof entry === "string") {
      return entry.trim();
    }
  }

  return "";
}

function getScalarAsString(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizePaymentStatus(value: string): SubscriptionPaymentRow["status"] {
  const normalized = value.trim().toLowerCase();

  if (normalized === "approved" || normalized === "processed") return "approved";
  if (
    normalized === "pending" ||
    normalized === "in_process" ||
    normalized === "processing" ||
    normalized === "created" ||
    normalized === "action_required"
  ) return "pending";
  if (normalized === "canceled" || normalized === "cancelled") return "canceled";
  if (normalized === "expired") return "canceled";
  if (normalized === "refunded" || normalized === "charged_back") return "refunded";
  if (normalized === "failed" || normalized === "rejected") return "failed";

  return "pending";
}

function getMercadoPagoConfig() {
  const accessToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN")?.trim() || "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim() || "";

  if (!accessToken) {
    throw new Error("MERCADO_PAGO_ACCESS_TOKEN não configurado.");
  }
  if (!supabaseUrl) {
    throw new Error("SUPABASE_URL não configurado.");
  }

  return {
    accessToken,
    webhookUrl: `${supabaseUrl}/functions/v1/mercado-pago-webhook`,
  };
}

async function mercadoPagoRequest(
  path: string,
  config: { accessToken: string },
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: Record<string, unknown>;
  } = {},
) {
  const response = await fetch(`https://api.mercadopago.com${path}`, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.accessToken}`,
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
// #region debug-point mp-request-error-context
    const requestBody = isRecord(options.body) ? options.body : {};
    const payer = isRecord(requestBody.payer) ? requestBody.payer : {};
    const transactions = isRecord(requestBody.transactions) ? requestBody.transactions : {};
    const payments = Array.isArray(transactions.payments) ? transactions.payments : [];
    const firstPayment = payments.length && isRecord(payments[0]) ? payments[0] : {};
    const automaticPayments = isRecord(firstPayment.automatic_payments)
      ? firstPayment.automatic_payments
      : {};
    const storedCredential = isRecord(firstPayment.stored_credential)
      ? firstPayment.stored_credential
      : {};
    const pointOfInteraction = isRecord(requestBody.point_of_interaction)
      ? requestBody.point_of_interaction
      : {};
    const transactionData = isRecord(pointOfInteraction.transaction_data)
      ? pointOfInteraction.transaction_data
      : {};
    const paymentReference = isRecord(transactionData.payment_reference)
      ? transactionData.payment_reference
      : {};
    const debugContext = {
      path,
      responseStatus: response.status,
      request: {
        card_id: getScalarAsString(requestBody.card_id) || null,
        payment_method_id: getScalarAsString(requestBody.payment_method_id) || null,
        payment_profile_id: getScalarAsString(automaticPayments.payment_profile_id) || null,
        issuer_id: getScalarAsString(requestBody.issuer_id) || null,
        payer_type: getScalarAsString(payer.type) || null,
        payer_id: getScalarAsString(payer.id) || null,
        payer_customer_id: getScalarAsString(payer.customer_id) || null,
        point_type: getScalarAsString(pointOfInteraction.type) || null,
        first_time_use: transactionData.first_time_use ?? null,
        subscription_id: getScalarAsString(transactionData.subscription_id) || null,
        sequence_number: isRecord(transactionData.subscription_sequence)
          ? getScalarAsString(transactionData.subscription_sequence.number) || null
          : null,
        payment_reference_id: getScalarAsString(paymentReference.id) || null,
        user_present: transactionData.user_present ?? null,
        external_reference: getScalarAsString(requestBody.external_reference) || null,
        stored_credential_reason: getScalarAsString(storedCredential.reason) || null,
        previous_transaction_reference:
          getScalarAsString(storedCredential.previous_transaction_reference) || null,
      },
    };
// #endregion debug-point mp-request-error-context
    const causes = Array.isArray((data as { cause?: unknown[] })?.cause)
      ? ((data as { cause?: unknown[] }).cause ?? [])
        .map((entry) => {
          if (!entry || typeof entry !== "object") return "";
          const causeRecord = entry as Record<string, unknown>;
          return [
            getScalarAsString(causeRecord.code),
            getScalarAsString(causeRecord.description),
          ].filter(Boolean).join(": ");
        })
        .filter(Boolean)
      : [];

    throw new Error(
      [
        typeof data?.message === "string" ? data.message : "Erro ao comunicar com o Mercado Pago.",
        causes.length ? causes.join(" | ") : "",
        `debug_context=${JSON.stringify(debugContext)}`,
      ].filter(Boolean).join(" - "),
    );
  }

  return isRecord(data) ? data : {};
}

async function getMercadoPagoCustomerCard({
  customerId,
  cardId,
  config,
}: {
  customerId: string;
  cardId: string;
  config: { accessToken: string };
}) {
  return await mercadoPagoRequest(`/v1/customers/${customerId}/cards/${cardId}`, config);
}

async function createMercadoPagoCardToken({
  cardId,
  config,
}: {
  cardId: string;
  config: { accessToken: string };
}) {
  const response = await mercadoPagoRequest("/v1/card_tokens", config, {
    method: "POST",
    body: {
      card_id: cardId,
    },
  });

  const token = getScalarAsString(response.id);
  if (!token) {
    throw new Error("Não foi possível gerar o token temporário do cartão salvo.");
  }

  return {
    token,
    paymentMethodId: getString(response, ["payment_method_id", "paymentMethodId"]) || null,
  };
}

async function createSavedCardPayment({
  personalId,
  subscriptionId,
  providerReference,
  plan,
  amount,
  email,
  description,
  config,
  savedPaymentMethod,
  automaticPaymentContext,
}: {
  personalId: string;
  subscriptionId: string;
  providerReference: string;
  plan: string;
  amount: number;
  email: string;
  description: string;
  config: { accessToken: string; webhookUrl: string };
  savedPaymentMethod: SavedPaymentMethod;
  automaticPaymentContext: AutomaticPaymentContext;
}) {
  if (savedPaymentMethod.providerPaymentProfileId) {
    return await createSavedCardOrderPayment({
      personalId,
      subscriptionId,
      providerReference,
      plan,
      amount,
      description,
      config,
      savedPaymentMethod,
      automaticPaymentContext,
    });
  }

  if (!savedPaymentMethod.providerCardId) {
    throw new Error("Não foi possível identificar o cartão salvo. Cadastre o método novamente.");
  }

  const idempotencyKey = `${Date.now()}-${crypto.randomUUID()}`;
  const cardToken = await createMercadoPagoCardToken({
    cardId: savedPaymentMethod.providerCardId,
    config,
  });
  const paymentMethodId = savedPaymentMethod.paymentMethodId || cardToken.paymentMethodId;

  if (!paymentMethodId) {
    throw new Error("Não foi possível identificar a bandeira do cartão salvo.");
  }

  return await mercadoPagoRequest("/v1/payments", config, {
    method: "POST",
    headers: {
      "X-Idempotency-Key": idempotencyKey,
    },
    body: {
      transaction_amount: amount,
      token: cardToken.token,
      description,
      installments: 1,
      payment_method_id: paymentMethodId,
      ...(savedPaymentMethod.issuerId ? { issuer_id: savedPaymentMethod.issuerId } : {}),
      payer: {
        email,
        type: "customer",
        id: savedPaymentMethod.providerCustomerId,
      },
      point_of_interaction: buildAutomaticPaymentPointOfInteraction(automaticPaymentContext),
      notification_url: config.webhookUrl,
      external_reference: providerReference,
      metadata: {
        plan,
        personalId,
        subscriptionId,
        providerReference,
        source: "personal-platform-renewal",
      },
    },
  });
}

async function createSavedCardOrderPayment({
  personalId,
  subscriptionId,
  providerReference,
  plan,
  amount,
  description,
  config,
  savedPaymentMethod,
  automaticPaymentContext,
}: {
  personalId: string;
  subscriptionId: string;
  providerReference: string;
  plan: string;
  amount: number;
  description: string;
  config: { accessToken: string; webhookUrl: string };
  savedPaymentMethod: SavedPaymentMethod;
  automaticPaymentContext: AutomaticPaymentContext;
}) {
  const idempotencyKey = `${Date.now()}-${crypto.randomUUID()}`;

  return await mercadoPagoRequest("/v1/orders", config, {
    method: "POST",
    headers: {
      "X-Idempotency-Key": idempotencyKey,
    },
    body: {
      type: "online",
      external_reference: providerReference,
      notification_url: config.webhookUrl,
      total_amount: formatOrderAmount(amount),
      processing_mode: "automatic_async",
      payer: {
        customer_id: savedPaymentMethod.providerCustomerId,
      },
      transactions: {
        payments: [
          {
            amount: formatOrderAmount(amount),
            automatic_payments: {
              payment_profile_id: savedPaymentMethod.providerPaymentProfileId,
              retries: 3,
              subscription: {
                id: automaticPaymentContext.subscriptionGatewayId,
                sequence: {
                  number: automaticPaymentContext.sequenceNumber,
                  total: null,
                },
                invoice: {
                  id: automaticPaymentContext.invoiceId,
                  billing_date: automaticPaymentContext.billingDate,
                  period: {
                    interval: automaticPaymentContext.invoicePeriod.period,
                    type: automaticPaymentContext.invoicePeriod.type,
                  },
                },
              },
            },
            stored_credential: {
              payment_initiator: "merchant",
              reason: "recurring",
              previous_transaction_reference: automaticPaymentContext.previousTransactionReference,
              first_payment: false,
            },
          },
        ],
      },
    },
  });
}

type AutomaticPaymentContext = {
  subscriptionGatewayId: string;
  sequenceNumber: number;
  previousTransactionReference: string;
  billingDate: string;
  invoiceId: string;
  invoicePeriod: { period: number; type: string };
};

async function resolveAutomaticPaymentContext({
  supabase,
  subscription,
  savedPaymentMethod,
  userPresent,
}: {
  supabase: ReturnType<typeof createClient>;
  subscription: SubscriptionRow;
  savedPaymentMethod: SavedPaymentMethod;
}) {
  const previousTransactionReference = await findLatestApprovedTransactionReference({
      supabase,
      subscriptionId: subscription.id,
    });

  if (!previousTransactionReference) {
    throw new Error("Esse cartão salvo ainda não possui uma transação anterior rastreável. Faça um pagamento manual com o formulário completo uma vez para liberar as próximas cobranças automáticas.");
  }

  const sequenceNumber = await countSubscriptionPayments({
    supabase,
    subscriptionId: subscription.id,
  });

  return {
    subscriptionGatewayId: resolveSubscriptionGatewayId(subscription),
    sequenceNumber: Math.max(sequenceNumber + 1, 2),
    previousTransactionReference,
    billingDate: formatBillingDate(subscription.next_billing_at || new Date().toISOString()),
    invoiceId: buildSubscriptionInvoiceId(subscription, sequenceNumber + 1),
    invoicePeriod: getInvoicePeriod(subscription.billing_cycle || "monthly"),
  };
}

async function countSubscriptionPayments({
  supabase,
  subscriptionId,
}: {
  supabase: ReturnType<typeof createClient>;
  subscriptionId: string;
}) {
  const { count, error } = await supabase
    .from("subscription_payments")
    .select("id", { count: "exact", head: true })
    .eq("subscription_id", subscriptionId);

  if (error) throw error;
  return count || 0;
}

async function findLatestApprovedTransactionReference({
  supabase,
  subscriptionId,
}: {
  supabase: ReturnType<typeof createClient>;
  subscriptionId: string;
}) {
  const { data, error } = await supabase
    .from("subscription_payments")
    .select("provider_payment_id, raw_payload, status")
    .eq("subscription_id", subscriptionId)
    .eq("status", "approved")
    .order("paid_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(10)
    .returns<Array<{
      provider_payment_id: string | null;
      raw_payload: Record<string, unknown> | null;
      status: SubscriptionPaymentRow["status"];
    }>>();

  if (error) throw error;

  for (const payment of data || []) {
    const transactionReference = extractTransactionReference(payment.raw_payload) ||
      payment.provider_payment_id ||
      "";

    if (transactionReference) return transactionReference;
  }

  return "";
}

function resolveSubscriptionGatewayId(subscription: SubscriptionRow) {
  const providerSubscriptionId = subscription.provider_subscription_id?.trim() || "";
  if (providerSubscriptionId && providerSubscriptionId.length <= 30) {
    return providerSubscriptionId;
  }

  return buildSubscriptionGatewayId({
    personalId: subscription.personal_id,
    subscriptionId: subscription.id,
  });
}

function buildSubscriptionGatewayId({
  personalId,
  subscriptionId,
}: {
  personalId: string;
  subscriptionId: string;
}) {
  return `sub_${createShortStableId(`${personalId}:${subscriptionId}`)}`;
}

function createShortStableId(value: string) {
  let hashA = 5381;
  let hashB = 52711;

  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    hashA = ((hashA << 5) + hashA) ^ code;
    hashB = ((hashB << 5) + hashB) ^ (code + index);
  }

  const normalizedA = (hashA >>> 0).toString(36);
  const normalizedB = (hashB >>> 0).toString(36);
  return `${normalizedA}${normalizedB}`.slice(0, 14);
}

function formatBillingDate(value: string) {
  const date = new Date(value);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getInvoicePeriod(billingCycle: string) {
  if (billingCycle === "quarterly") {
    return { period: 3, type: "monthly" };
  }

  if (billingCycle === "yearly") {
    return { period: 12, type: "monthly" };
  }

  return { period: 1, type: "monthly" };
}

function buildSubscriptionInvoiceId(subscription: SubscriptionRow, sequenceNumber: number) {
  return `inv_${createShortStableId(`${subscription.id}:${sequenceNumber}`)}_${sequenceNumber}`;
}

function formatOrderAmount(amount: number) {
  return amount.toFixed(2);
}

function extractTransactionReference(rawPayload: Record<string, unknown> | null | undefined) {
  const firstPayment = getFirstOrderPayment(rawPayload);

  return getScalarAsString(firstPayment?.reference_id) ||
    getScalarAsString(firstPayment?.reference?.id) ||
    "";
}

function extractGatewayPaymentId(rawPayload: Record<string, unknown> | null | undefined) {
  const firstPayment = getFirstOrderPayment(rawPayload);

  return getScalarAsString(firstPayment?.id) ||
    (isRecord(rawPayload) ? getScalarAsString(rawPayload.id) : "") ||
    "";
}

function extractGatewayPaymentStatus(rawPayload: Record<string, unknown> | null | undefined) {
  const firstPayment = getFirstOrderPayment(rawPayload);

  return getScalarAsString(firstPayment?.status) ||
    (isRecord(rawPayload) ? getString(rawPayload, ["status"]) : "");
}

function getFirstOrderPayment(rawPayload: Record<string, unknown> | null | undefined) {
  if (!isRecord(rawPayload)) return null;

  const transactions = isRecord(rawPayload.transactions) ? rawPayload.transactions : null;
  const payments = transactions && Array.isArray(transactions.payments) ? transactions.payments : [];
  const firstPayment = payments.length && isRecord(payments[0]) ? payments[0] : null;

  return firstPayment;
}

function buildSavedPaymentMethod({
  providerCustomerId,
  cardResponse,
  fallbackBrand,
  fallbackFirstPaymentProviderPaymentId,
}: {
  providerCustomerId: string;
  cardResponse: Record<string, unknown>;
  fallbackBrand: string;
  fallbackFirstPaymentProviderPaymentId: string | null;
}): SavedPaymentMethod {
  const cardId = getScalarAsString(cardResponse.id);
  const directBrand = getString(cardResponse, ["payment_method_id", "paymentMethodId"]);
  const nestedPaymentMethod = isRecord(cardResponse.payment_method)
    ? getString(cardResponse.payment_method, ["id", "name"])
    : "";
  const lastFour = getString(cardResponse, ["last_four_digits", "lastFourDigits", "last_four"]);
  const issuerId = getString(cardResponse, ["issuer_id", "issuerId"]) ||
    (isRecord(cardResponse.issuer) ? getString(cardResponse.issuer, ["id"]) : "");

  if (!cardId) {
    throw new Error("Não foi possível identificar o cartão salvo no Mercado Pago.");
  }

  return {
    provider: "mercadopago",
    providerCustomerId,
    providerCardId: cardId,
    paymentMethodId: directBrand || nestedPaymentMethod || fallbackBrand || null,
    issuerId: issuerId || null,
    brand: directBrand || nestedPaymentMethod || fallbackBrand || null,
    lastFour: lastFour || null,
    firstPaymentProviderPaymentId: fallbackFirstPaymentProviderPaymentId,
    updatedAt: new Date().toISOString(),
  };
}

function extractSavedPaymentMethod(data: unknown): SavedPaymentMethod | null {
  if (!isRecord(data)) return null;

  const rawPaymentMethod = data.paymentMethod;
  if (!isRecord(rawPaymentMethod)) return null;

  const providerCustomerId = getString(rawPaymentMethod, ["providerCustomerId"]);
  const providerCardId = getString(rawPaymentMethod, ["providerCardId"]);
  const providerPaymentProfileId = getString(rawPaymentMethod, [
    "providerPaymentProfileId",
    "paymentProfileId",
  ]);

  if (!providerCustomerId || (!providerCardId && !providerPaymentProfileId)) return null;

  return {
    provider: "mercadopago",
    providerCustomerId,
    providerCardId,
    providerPaymentProfileId: providerPaymentProfileId || null,
    paymentMethodId: getString(rawPaymentMethod, ["paymentMethodId"]) || null,
    issuerId: getString(rawPaymentMethod, ["issuerId"]) || null,
    brand: getString(rawPaymentMethod, ["brand"]) || null,
    lastFour: getString(rawPaymentMethod, ["lastFour"]) || null,
    firstPaymentProviderPaymentId: getString(rawPaymentMethod, ["firstPaymentProviderPaymentId"]) || null,
    updatedAt: getString(rawPaymentMethod, ["updatedAt"]) || new Date().toISOString(),
  };
}

function mapStoredPaymentMethod(row: PersonalPaymentMethodRow | null): SavedPaymentMethod | null {
  if (!row) return null;

  const providerCustomerId = row.provider_customer_id?.trim() || "";
  const providerCardId = row.provider_card_id?.trim() || "";
  const providerPaymentProfileId = row.provider_payment_profile_id?.trim() || "";

  if (!providerCustomerId || (!providerCardId && !providerPaymentProfileId)) return null;

  return {
    provider: "mercadopago",
    providerCustomerId,
    providerCardId || null,
    providerPaymentProfileId: providerPaymentProfileId || null,
    paymentMethodId: row.payment_method_id?.trim() || null,
    issuerId: row.issuer_id?.trim() || null,
    brand: row.brand?.trim() || null,
    lastFour: row.last_four?.trim() || null,
    firstPaymentProviderPaymentId: row.first_payment_provider_payment_id?.trim() || null,
    updatedAt: row.updated_at?.trim() || new Date().toISOString(),
  };
}

async function savePaymentMethodToProfile({
  supabase,
  personalId,
  currentData,
  paymentMethod,
}: {
  supabase: ReturnType<typeof createClient>;
  personalId: string;
  currentData: Record<string, unknown> | null;
  paymentMethod: SavedPaymentMethod | null;
}) {
  const nextData = isRecord(currentData)
    ? { ...currentData }
    : {};

  if (paymentMethod) {
    nextData.paymentMethod = paymentMethod;
  } else {
    delete nextData.paymentMethod;
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      data: nextData,
      updated_at: new Date().toISOString(),
    })
    .eq("id", personalId);

  if (error) throw error;
}

function resolveSubscriptionAmount(subscription: SubscriptionRow) {
  if (typeof subscription.amount === "number" && Number.isFinite(subscription.amount)) {
    return Number(subscription.amount);
  }

  const planSlug = normalizePlan(subscription.plan_slug || "");
  const defaultAmount = PLAN_PRICES[planSlug];

  if (typeof defaultAmount === "number") {
    return defaultAmount;
  }

  throw new Error(`Não foi possível determinar o valor da assinatura do plano ${planSlug || "atual"}.`);
}

function buildPaymentDescription(plan: string) {
  const label = plan === "starter"
    ? "FitBody Starter"
    : plan === "premium" || plan === "pro" || plan === "elite" || plan === "unlimited"
    ? "FitBody Premium"
    : "FitBody Pro";

  return `${label} - renovacao da assinatura`;
}

function buildProviderReference({
  personalId,
  subscriptionId,
  prefix,
  suffix,
}: {
  personalId: string;
  subscriptionId: string;
  prefix: string;
  suffix: string;
}) {
  return `${prefix}_${personalId}_${subscriptionId}_${suffix}`;
}

function formatReferenceDate(value: string) {
  const date = new Date(value);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

async function createLocalFailedRenewalPayment({
  supabase,
  subscription,
  providerReference,
  message,
}: {
  supabase: ReturnType<typeof createClient>;
  subscription: SubscriptionRow;
  providerReference: string;
  message: string;
}) {
  const { data, error } = await supabase
    .from("subscription_payments")
    .insert({
      personal_id: subscription.personal_id,
      subscription_id: subscription.id,
      plan_slug: normalizePlan(subscription.plan_slug || "premium"),
      billing_cycle: subscription.billing_cycle || "monthly",
      amount: resolveSubscriptionAmount(subscription),
      currency: subscription.currency || "BRL",
      status: "failed",
      provider: "mercadopago",
      provider_payment_id: null,
      provider_reference: providerReference,
      description: buildPaymentDescription(subscription.plan_slug || "premium"),
      due_at: subscription.next_billing_at,
      paid_at: null,
      raw_payload: {
        error: message,
        source: "personal-platform-renewal",
      },
    })
    .select("*")
    .single<SubscriptionPaymentRow>();

  if (error || !data) {
    throw error ?? new Error("Não foi possível registrar a falha da renovação.");
  }

  return data;
}

async function syncSubscriptionWithRenewalPayment({
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
        started_at: subscription.started_at || subscription.current_period_start || currentPeriodStart,
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

  if (payment.status === "pending") {
    const { error } = await supabase
      .from("personal_subscriptions")
      .update({
        last_payment_id: payment.provider_payment_id,
        last_payment_status: payment.status,
        payment_provider: payment.provider || "mercadopago",
        updated_at: nowIso,
      })
      .eq("id", subscription.id);

    if (error) throw error;
    return;
  }

  const graceUntil = subscription.grace_until || addDays(nowIso, 3);

  const { error } = await supabase
    .from("personal_subscriptions")
    .update({
      status: "past_due",
      last_payment_id: payment.provider_payment_id,
      last_payment_status: payment.status,
      payment_provider: payment.provider || "mercadopago",
      grace_until: graceUntil,
      blocked_at: null,
      updated_at: nowIso,
    })
    .eq("id", subscription.id);

  if (error) throw error;
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

function addDays(value: string, days: number) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date.toISOString();
}
