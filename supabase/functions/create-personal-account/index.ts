import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-landing-token, x-signup-token, x-api-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DEFAULT_PLAN_SLUG = "free";
const DEFAULT_BILLING_CYCLE = "monthly";
const DEFAULT_EVOLUTION_MODE = "standalone";
const DEFAULT_ANAMNESIS_REVIEW_REQUIRED = true;

const PLAN_CONFIGS: Record<string, { studentLimit: number; paid: boolean }> = {
  free: { studentLimit: 1, paid: false },
  starter: { studentLimit: 10, paid: true },
  pro: { studentLimit: 30, paid: true },
  premium: { studentLimit: 30, paid: true },
  elite: { studentLimit: 999999, paid: true },
  unlimited: { studentLimit: 999999, paid: true },
};

const PLAN_PRICES: Record<string, number> = {
  starter: 14.9,
  pro: 39.9,
  premium: 39.9,
  elite: 39.9,
  unlimited: 39.9,
};

type ProfileRow = {
  id: string;
  role: string | null;
  full_name: string | null;
  email: string | null;
  data: Record<string, unknown> | null;
};

type SavedPaymentMethod = {
  provider: "mercadopago";
  providerCustomerId: string;
  providerCardId: string;
  paymentMethodId: string | null;
  issuerId: string | null;
  brand: string | null;
  lastFour: string | null;
  firstPaymentProviderPaymentId: string | null;
  updatedAt: string;
};

type LandingPaymentContext = {
  paymentStatus: string;
  paymentProvider: string;
  paymentId: string | null;
  paymentAmount: number | null;
  paymentCurrency: string;
  providerReference: string | null;
  paymentDescription: string | null;
  paymentRawPayload: Record<string, unknown>;
  providerCustomerId: string | null;
  providerSubscriptionId: string | null;
  savedPaymentMethod: SavedPaymentMethod | null;
  recurringReady: boolean;
  missingRecurringFields: string[];
};

type SubscriptionRow = {
  id: string;
  personal_id: string;
  plan_slug: string | null;
  billing_cycle: string | null;
  status: string | null;
};

type LandingRequestMode = {
  mode: "landing";
};

type OwnerRequestMode = {
  mode: "owner";
  requesterId: string;
  requesterProfile: ProfileRow;
};

type RequestMode = LandingRequestMode | OwnerRequestMode;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      throw new Error("Método não suportado.");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausente.");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const body = await req.json().catch(() => ({}));
    const requestMode = await resolveRequestMode({ req, supabase });

    return await handleCreatePersonal({
      supabase,
      requestMode,
      body: isRecord(body) ? body : {},
    });
  } catch (error) {
    return jsonResponse(400, {
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

async function resolveRequestMode({
  req,
  supabase,
}: {
  req: Request;
  supabase: ReturnType<typeof createClient>;
}): Promise<RequestMode> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const bearerToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : "";
  const landingToken =
    req.headers.get("x-landing-token")?.trim() ||
    req.headers.get("x-signup-token")?.trim() ||
    req.headers.get("x-api-key")?.trim() ||
    "";
  const expectedLandingToken = Deno.env.get("LANDING_SIGNUP_TOKEN")?.trim() || "";

  if (expectedLandingToken) {
    if (landingToken === expectedLandingToken || bearerToken === expectedLandingToken) {
      return { mode: "landing" };
    }

    if (landingToken) {
      throw new Error("Token da landing inválido.");
    }
  }

  if (!bearerToken) {
    throw new Error("Token da landing ou usuário owner autenticado é obrigatório.");
  }

  const {
    data: { user: requesterUser },
    error: requesterError,
  } = await supabase.auth.getUser(bearerToken);

  if (requesterError || !requesterUser) {
    throw requesterError ?? new Error("Usuário solicitante não autenticado.");
  }

  const { data: requesterProfile, error: requesterProfileError } = await supabase
    .from("profiles")
    .select("id, role, full_name, email, data")
    .eq("id", requesterUser.id)
    .single<ProfileRow>();

  if (requesterProfileError || !requesterProfile) {
    throw requesterProfileError ?? new Error("Perfil do solicitante não encontrado.");
  }

  if (requesterProfile.role !== "owner") {
    throw new Error("Somente o owner pode criar personal por autenticação direta.");
  }

  return {
    mode: "owner",
    requesterId: requesterUser.id,
    requesterProfile,
  };
}

async function handleCreatePersonal({
  supabase,
  requestMode,
  body,
}: {
  supabase: ReturnType<typeof createClient>;
  requestMode: RequestMode;
  body: Record<string, unknown>;
}) {
  const name = getString(body, ["name", "fullName"]);
  const email = normalizeEmail(getString(body, ["email"]));
  const password = getString(body, ["password"]);
  const phone = getString(body, ["phone"]);
  const brandName = getString(body, ["brandName"]) || name;
  const logoUrl = getString(body, ["logoUrl"]);
  const source = getString(body, ["source"]) || requestMode.mode;
  const loginUrl =
    getString(body, ["loginUrl", "redirectUrl"]) ||
    (Deno.env.get("PERSONAL_LOGIN_URL")?.trim() || "");

  const requestedPlan = normalizePlanSlug(
    getString(body, ["plan", "planSlug"]),
  ) || DEFAULT_PLAN_SLUG;
  const planConfig = PLAN_CONFIGS[requestedPlan];

  if (!planConfig) {
    throw new Error("Plano informado é inválido.");
  }

  if (!name || !email || !password) {
    throw new Error("Nome, email e senha são obrigatórios.");
  }

  if (!isValidEmail(email)) {
    throw new Error("Email inválido.");
  }

  if (password.length < 6) {
    throw new Error("A senha deve ter no mínimo 6 caracteres.");
  }

  const paymentStatus = getString(body, ["paymentStatus"]).toLowerCase();
  const paymentProvider = getString(body, ["paymentProvider"]).toLowerCase();
  const paymentId = getString(body, ["paymentId"]);

  if (requestMode.mode === "landing" && planConfig.paid) {
    if (paymentStatus !== "approved") {
      throw new Error("Plano pago só pode criar a conta após pagamento aprovado.");
    }

    if (!paymentProvider || !paymentId) {
      throw new Error("Dados do pagamento são obrigatórios para planos pagos.");
    }
  }

  const evolutionMode = resolveEvolutionMode({
    requestMode,
    body,
  });
  const billingCycle = resolveBillingCycle({
    requestMode,
    body,
    isPaidPlan: planConfig.paid,
  });
  const anamnesisReviewRequired = resolveAnamnesisReviewRequired({
    requestMode,
    body,
  });
  const nowIso = new Date().toISOString();
  const paymentContext = resolveLandingPaymentContext({
    body,
    nowIso,
    requestedPlan,
    planConfig,
    requestMode,
  });
  const subscriptionStatus = resolveSubscriptionStatus({
    requestMode,
    isPaidPlan: planConfig.paid,
  });
  const nextBillingAt = planConfig.paid && subscriptionStatus === "active"
    ? calculateNextBillingAt(nowIso, billingCycle)
    : null;

  const saasData = {
    plan: requestedPlan,
    billingCycle,
    studentLimit: planConfig.studentLimit,
    paymentStatus: planConfig.paid
      ? paymentStatus || (requestMode.mode === "owner" ? "manual" : "approved")
      : "free",
    paymentProvider: planConfig.paid ? paymentProvider || null : null,
    paymentId: planConfig.paid ? paymentId || null : null,
    recurringReady: paymentContext.recurringReady,
    subscriptionStatus,
    startedAt: planConfig.paid ? nowIso : null,
    nextBillingAt,
    createdVia: requestMode.mode,
  };

  const profileData = {
    phone,
    status: "active",
    signupSource: source,
    branding: {
      brandName,
      logoUrl,
    },
    config: {
      evolutionMode,
      anamnesisReviewRequired,
      evolutionFields: [],
    },
    ...(paymentContext.savedPaymentMethod
      ? { paymentMethod: paymentContext.savedPaymentMethod }
      : {}),
    saas: saasData,
  };

  const userMetadata = {
    full_name: name,
    role: "personal",
    phone,
    source,
    branding: {
      brandName,
      logoUrl,
    },
    config: {
      evolutionMode,
      anamnesisReviewRequired,
    },
    saas: saasData,
    created_via: requestMode.mode,
    created_by: requestMode.mode === "owner" ? requestMode.requesterId : null,
  };

  const { data: createdUserData, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: userMetadata,
  });

  if (createError || !createdUserData.user) {
    throw createError ?? new Error("Não foi possível criar o usuário do personal.");
  }

  const createdUserId = createdUserData.user.id;

  const profilePayload: Record<string, unknown> = {
    id: createdUserId,
    full_name: name,
    email,
    role: "personal",
    data: profileData,
    updated_at: nowIso,
  };

  if (requestMode.mode === "owner") {
    profilePayload.created_by = requestMode.requesterId;
  }

  const { error: profileError } = await supabase.from("profiles").upsert(profilePayload);

  if (profileError) {
    await supabase.auth.admin.deleteUser(createdUserId).catch(() => undefined);
    throw profileError;
  }

  const { error: personalConfigError } = await supabase.from("personal_config").upsert({
    personal_id: createdUserId,
    app_name: brandName || name,
    logo_url: logoUrl || null,
    status: "active",
    saas_monthly_value: 0,
    updated_at: nowIso,
  });

  if (personalConfigError) {
    await supabase.from("profiles").delete().eq("id", createdUserId).catch(() => undefined);
    await supabase.auth.admin.deleteUser(createdUserId).catch(() => undefined);
    throw personalConfigError;
  }

  const { data: subscriptionRow, error: subscriptionError } = await supabase
    .from("personal_subscriptions")
    .upsert(
      buildSubscriptionPayload({
        personalId: createdUserId,
        requestedPlan,
        studentLimit: planConfig.studentLimit,
        billingCycle,
        subscriptionStatus,
        paymentProvider: planConfig.paid ? paymentContext.paymentProvider || null : null,
        paymentId: planConfig.paid ? paymentContext.paymentId || null : null,
        paymentStatus: planConfig.paid
          ? paymentContext.paymentStatus || (requestMode.mode === "owner" ? "manual" : "approved")
          : "free",
        startedAt: planConfig.paid ? nowIso : null,
        nextBillingAt,
        amount: paymentContext.paymentAmount,
        currency: paymentContext.paymentCurrency,
        providerCustomerId: paymentContext.providerCustomerId,
        providerSubscriptionId: paymentContext.providerSubscriptionId,
        nowIso,
      }),
      { onConflict: "personal_id" },
    )
    .select("id, personal_id, plan_slug, billing_cycle, status")
    .single<SubscriptionRow>();

  if (subscriptionError) {
    await supabase.from("personal_config").delete().eq("personal_id", createdUserId).catch(() => undefined);
    await supabase.from("profiles").delete().eq("id", createdUserId).catch(() => undefined);
    await supabase.auth.admin.deleteUser(createdUserId).catch(() => undefined);
    throw subscriptionError;
  }

  try {
    if (paymentContext.savedPaymentMethod) {
      await upsertPersonalPaymentMethod({
        supabase,
        personalId: createdUserId,
        paymentMethod: paymentContext.savedPaymentMethod,
        providerSubscriptionId: paymentContext.providerSubscriptionId,
        rawPayload: paymentContext.paymentRawPayload,
      });
    }

    if (subscriptionStatus === "active" && planConfig.paid && paymentContext.paymentId) {
      await insertInitialSubscriptionPayment({
        supabase,
        personalId: createdUserId,
        subscription: subscriptionRow,
        paymentContext,
        requestedPlan,
        billingCycle,
        nowIso,
      });
    }
  } catch (postCreateError) {
    await supabase
      .from("personal_payment_methods")
      .delete()
      .eq("personal_id", createdUserId)
      .catch(() => undefined);
    await supabase.from("personal_config").delete().eq("personal_id", createdUserId).catch(() => undefined);
    await supabase.from("personal_subscriptions").delete().eq("personal_id", createdUserId).catch(() => undefined);
    await supabase.from("profiles").delete().eq("id", createdUserId).catch(() => undefined);
    await supabase.auth.admin.deleteUser(createdUserId).catch(() => undefined);
    throw postCreateError;
  }

  return jsonResponse(200, {
    success: true,
    message: "Conta criada com sucesso.",
    userId: createdUserId,
    personalId: createdUserId,
    email,
    loginUrl: loginUrl || null,
    mode: requestMode.mode,
    plan: requestedPlan,
    billingCycle,
    studentLimit: planConfig.studentLimit,
    paymentRequired: planConfig.paid,
    subscriptionStatus,
    recurringReady: paymentContext.recurringReady,
    paymentMethodStored: Boolean(paymentContext.savedPaymentMethod),
    missingRecurringFields: paymentContext.missingRecurringFields,
    defaults: {
      plan: requestedPlan,
      studentLimit: planConfig.studentLimit,
      evolutionMode,
      anamnesisReviewRequired,
    },
  });
}

function resolveEvolutionMode({
  requestMode,
  body,
}: {
  requestMode: RequestMode;
  body: Record<string, unknown>;
}) {
  if (requestMode.mode === "landing") {
    return DEFAULT_EVOLUTION_MODE;
  }

  const requestedMode = normalizeEvolutionMode(
    getString(body, ["evolutionMode"]),
  );

  return requestedMode || DEFAULT_EVOLUTION_MODE;
}

function resolveAnamnesisReviewRequired({
  requestMode,
  body,
}: {
  requestMode: RequestMode;
  body: Record<string, unknown>;
}) {
  if (requestMode.mode === "landing") {
    return DEFAULT_ANAMNESIS_REVIEW_REQUIRED;
  }

  const requestedValue = getBoolean(body, [
    "anamnesisReviewRequired",
    "reviewRequired",
  ]);

  return requestedValue ?? DEFAULT_ANAMNESIS_REVIEW_REQUIRED;
}

function resolveBillingCycle({
  requestMode,
  body,
  isPaidPlan,
}: {
  requestMode: RequestMode;
  body: Record<string, unknown>;
  isPaidPlan: boolean;
}) {
  if (!isPaidPlan) {
    return DEFAULT_BILLING_CYCLE;
  }

  if (requestMode.mode === "landing") {
    return DEFAULT_BILLING_CYCLE;
  }

  const requestedCycle = normalizeBillingCycle(
    getString(body, ["billingCycle", "cycle"]),
  );

  return requestedCycle || DEFAULT_BILLING_CYCLE;
}

function resolveSubscriptionStatus({
  requestMode,
  isPaidPlan,
}: {
  requestMode: RequestMode;
  isPaidPlan: boolean;
}) {
  if (!isPaidPlan) {
    return "free";
  }

  return requestMode.mode === "landing" ? "active" : "pending_payment";
}

function normalizePlanSlug(value: string) {
  const normalized = value.trim().toLowerCase();
  return normalized || "";
}

function normalizeBillingCycle(value: string) {
  const normalized = value.trim().toLowerCase();

  if (!normalized) return "";
  if (["monthly", "quarterly", "yearly"].includes(normalized)) return normalized;

  return "";
}

function normalizeEvolutionMode(value: string) {
  const normalized = value.trim().toLowerCase();

  if (!normalized) return "";
  if (normalized === "manual") return "standalone";
  if (["anamnesis", "standalone"].includes(normalized)) return normalized;

  return "";
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function buildSubscriptionPayload({
  personalId,
  requestedPlan,
  studentLimit,
  billingCycle,
  subscriptionStatus,
  paymentProvider,
  paymentId,
  paymentStatus,
  startedAt,
  nextBillingAt,
  amount,
  currency,
  providerCustomerId,
  providerSubscriptionId,
  nowIso,
}: {
  personalId: string;
  requestedPlan: string;
  studentLimit: number;
  billingCycle: string;
  subscriptionStatus: string;
  paymentProvider: string | null;
  paymentId: string | null;
  paymentStatus: string;
  startedAt: string | null;
  nextBillingAt: string | null;
  amount: number | null;
  currency: string | null;
  providerCustomerId: string | null;
  providerSubscriptionId: string | null;
  nowIso: string;
}) {
  return {
    personal_id: personalId,
    plan_slug: requestedPlan,
    student_limit: studentLimit,
    billing_cycle: billingCycle,
    status: subscriptionStatus,
    amount,
    currency: currency || "BRL",
    started_at: startedAt,
    current_period_start: startedAt,
    current_period_end: nextBillingAt,
    next_billing_at: nextBillingAt,
    grace_until: null,
    blocked_at: null,
    scheduled_plan_slug: null,
    scheduled_student_limit: null,
    scheduled_billing_cycle: null,
    scheduled_change_at: null,
    payment_provider: paymentProvider,
    provider_customer_id: providerCustomerId,
    provider_subscription_id: providerSubscriptionId,
    last_payment_id: paymentId,
    last_payment_status: paymentStatus,
    updated_at: nowIso,
  };
}

function resolveLandingPaymentContext({
  body,
  nowIso,
  requestedPlan,
  planConfig,
  requestMode,
}: {
  body: Record<string, unknown>;
  nowIso: string;
  requestedPlan: string;
  planConfig: { studentLimit: number; paid: boolean };
  requestMode: RequestMode;
}): LandingPaymentContext {
  const paymentStatus = getString(body, ["paymentStatus"]).toLowerCase();
  const paymentProvider = getString(body, ["paymentProvider"]).toLowerCase();
  const paymentId = getString(body, ["paymentId", "providerPaymentId"]) || null;
  const providerCustomerId = getString(body, ["providerCustomerId"]) || null;
  const providerCardId = getString(body, ["providerCardId"]) || null;
  const paymentMethodId = getString(body, ["paymentMethodId"]) || null;
  const issuerId = getString(body, ["issuerId"]) || null;
  const brand = getString(body, ["cardBrand", "brand"]) || paymentMethodId || null;
  const lastFour = getString(body, ["cardLastFour", "lastFour"]) || null;
  const providerSubscriptionId = getString(body, [
    "providerSubscriptionId",
    "subscriptionId",
  ]) || null;
  const paymentAmount = getNumber(body, ["paymentAmount", "amount", "transactionAmount"]) ??
    resolvePlanAmount(requestedPlan);
  const paymentCurrency = getString(body, ["paymentCurrency", "currency"]) || "BRL";
  const providerReference = getString(body, [
    "providerReference",
    "externalReference",
    "external_reference",
  ]) || null;
  const paymentDescription = getString(body, ["paymentDescription", "description"]) ||
    buildPaymentDescription(requestedPlan);
  const paymentRawPayload = getRecord(body, [
    "paymentRawPayload",
    "paymentRaw",
    "payment",
    "raw",
    "paymentData",
  ]) || {};

  const missingRecurringFields = paymentProvider === "mercadopago" && planConfig.paid
    ? [
      !providerCustomerId ? "providerCustomerId" : "",
      !providerCardId ? "providerCardId" : "",
      !paymentMethodId ? "paymentMethodId" : "",
      !paymentId ? "firstPaymentProviderPaymentId" : "",
    ].filter(Boolean)
    : [];

  if (requestMode.mode === "landing" && planConfig.paid) {
    if (paymentStatus !== "approved") {
      throw new Error("Plano pago só pode criar a conta após pagamento aprovado.");
    }

    if (!paymentProvider || !paymentId) {
      throw new Error("Dados do pagamento são obrigatórios para planos pagos.");
    }
  }

  const savedPaymentMethod = paymentProvider === "mercadopago" &&
      providerCustomerId &&
      providerCardId
    ? {
      provider: "mercadopago" as const,
      providerCustomerId,
      providerCardId,
      paymentMethodId,
      issuerId,
      brand,
      lastFour,
      firstPaymentProviderPaymentId: paymentId,
      updatedAt: nowIso,
    }
    : null;

  return {
    paymentStatus,
    paymentProvider,
    paymentId,
    paymentAmount,
    paymentCurrency,
    providerReference,
    paymentDescription,
    paymentRawPayload,
    providerCustomerId: savedPaymentMethod?.providerCustomerId || providerCustomerId,
    providerSubscriptionId,
    savedPaymentMethod,
    recurringReady: Boolean(savedPaymentMethod && !missingRecurringFields.length),
    missingRecurringFields,
  };
}

async function upsertPersonalPaymentMethod({
  supabase,
  personalId,
  paymentMethod,
  providerSubscriptionId,
  rawPayload,
}: {
  supabase: ReturnType<typeof createClient>;
  personalId: string;
  paymentMethod: SavedPaymentMethod;
  providerSubscriptionId: string | null;
  rawPayload: Record<string, unknown>;
}) {
  const { error } = await supabase
    .from("personal_payment_methods")
    .upsert({
      personal_id: personalId,
      provider: paymentMethod.provider,
      provider_customer_id: paymentMethod.providerCustomerId,
      provider_card_id: paymentMethod.providerCardId,
      payment_method_id: paymentMethod.paymentMethodId,
      issuer_id: paymentMethod.issuerId,
      brand: paymentMethod.brand,
      last_four: paymentMethod.lastFour,
      first_payment_provider_payment_id: paymentMethod.firstPaymentProviderPaymentId,
      provider_subscription_id: providerSubscriptionId,
      status: "active",
      raw_payload: rawPayload,
      updated_at: paymentMethod.updatedAt,
    }, { onConflict: "personal_id" });

  if (error) throw error;
}

async function insertInitialSubscriptionPayment({
  supabase,
  personalId,
  subscription,
  paymentContext,
  requestedPlan,
  billingCycle,
  nowIso,
}: {
  supabase: ReturnType<typeof createClient>;
  personalId: string;
  subscription: SubscriptionRow;
  paymentContext: LandingPaymentContext;
  requestedPlan: string;
  billingCycle: string;
  nowIso: string;
}) {
  if (!paymentContext.paymentId) return;

  const { data: existingPayment } = await supabase
    .from("subscription_payments")
    .select("id")
    .eq("subscription_id", subscription.id)
    .eq("provider_payment_id", paymentContext.paymentId)
    .maybeSingle<{ id: string }>();

  if (existingPayment?.id) return;

  const { error } = await supabase
    .from("subscription_payments")
    .insert({
      personal_id: personalId,
      subscription_id: subscription.id,
      plan_slug: requestedPlan,
      billing_cycle: billingCycle,
      amount: paymentContext.paymentAmount ?? resolvePlanAmount(requestedPlan) ?? 0,
      currency: paymentContext.paymentCurrency || "BRL",
      status: normalizeSubscriptionPaymentStatus(paymentContext.paymentStatus || "approved"),
      provider: paymentContext.paymentProvider || "mercadopago",
      provider_payment_id: paymentContext.paymentId,
      provider_reference: paymentContext.providerReference,
      description: paymentContext.paymentDescription || buildPaymentDescription(requestedPlan),
      due_at: nowIso,
      paid_at: paymentContext.paymentStatus === "approved" ? nowIso : null,
      raw_payload: {
        source: "landing-create-personal-account",
        ...paymentContext.paymentRawPayload,
      },
    });

  if (error) throw error;
}

function getString(body: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = body[key];
    if (typeof value === "string") {
      return value.trim();
    }
  }

  return "";
}

function getBoolean(body: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = body[key];

    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (normalized === "true") return true;
      if (normalized === "false") return false;
    }
  }

  return undefined;
}

function getNumber(body: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = body[key];

    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string") {
      const normalized = Number(value.replace(",", ".").trim());
      if (Number.isFinite(normalized)) {
        return normalized;
      }
    }
  }

  return undefined;
}

function getRecord(body: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = body[key];
    if (isRecord(value)) return value;
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function resolvePlanAmount(plan: string) {
  return PLAN_PRICES[plan] ?? null;
}

function buildPaymentDescription(plan: string) {
  const normalized = normalizePlanSlug(plan);
  const label = normalized === "starter"
    ? "FitBody Starter"
    : normalized === "pro"
    ? "FitBody Pro"
    : normalized === "premium"
    ? "FitBody Premium"
    : normalized === "elite"
    ? "FitBody Elite"
    : normalized === "unlimited"
    ? "FitBody Ilimitado"
    : "Assinatura FitBody";

  return `Assinatura ${label}`;
}

function normalizeSubscriptionPaymentStatus(value: string) {
  const normalized = value.trim().toLowerCase();

  if (["pending", "approved", "failed", "canceled", "refunded"].includes(normalized)) {
    return normalized;
  }

  return normalized === "cancelled" ? "canceled" : "pending";
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

function jsonResponse(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}
