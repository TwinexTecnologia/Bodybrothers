import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PLAN_CONFIGS: Record<string, { studentLimit: number; paid: boolean; rank: number }> = {
  free: { studentLimit: 1, paid: false, rank: 0 },
  starter: { studentLimit: 10, paid: true, rank: 1 },
  pro: { studentLimit: 30, paid: true, rank: 2 },
  premium: { studentLimit: 30, paid: true, rank: 2 },
  elite: { studentLimit: 999999, paid: true, rank: 3 },
  unlimited: { studentLimit: 999999, paid: true, rank: 3 },
};

const PLAN_PRICES: Record<string, number> = {
  starter: 14.9,
  premium: 39.9,
  pro: 39.9,
  elite: 39.9,
  unlimited: 39.9,
};

type ProfileRow = {
  id: string;
  role: string | null;
  personal_id: string | null;
  email?: string | null;
  data: Record<string, unknown> | null;
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
  next_billing_at: string | null;
  blocked_at: string | null;
  grace_until: string | null;
  last_payment_id: string | null;
  last_payment_status: string | null;
  payment_provider: string | null;
  provider_subscription_id?: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  scheduled_plan_slug?: string | null;
  scheduled_student_limit?: number | null;
  scheduled_billing_cycle?: string | null;
  scheduled_change_at?: string | null;
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

type CardTokenPaymentInput = {
  token: string;
  paymentMethodId: string;
  issuerId: string | null;
  installments: number;
  identificationType: string;
  identificationNumber: string;
};

type SavedPaymentMethod = {
  provider: "mercadopago" | "asaas";
  providerCustomerId: string;
  providerCardId: string | null;
  providerPaymentProfileId: string | null;
  providerPaymentMethodToken: string | null;
  providerSubscriptionId: string | null;
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausente.");
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : "";
    if (!token) throw new Error("Token de autenticação ausente.");

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const {
      data: { user: requesterUser },
      error: requesterError,
    } = await supabase.auth.getUser(token);

    if (requesterError || !requesterUser) {
      throw requesterError ?? new Error("Usuário solicitante não autenticado.");
    }

    const { data: requesterProfile, error: requesterProfileError } = await supabase
      .from("profiles")
      .select("id, role, personal_id, data")
      .eq("id", requesterUser.id)
      .single<ProfileRow>();

    if (requesterProfileError || !requesterProfile) {
      throw requesterProfileError ?? new Error("Perfil do solicitante não encontrado.");
    }

    if (!["personal", "owner"].includes(requesterProfile.role ?? "")) {
      throw new Error("Sem permissão para gerenciar o plano.");
    }

    const body = await req.json().catch(() => ({}));
    const action = typeof body?.action === "string" ? body.action.trim() : "";

    if (action === "request_downgrade") {
      return await handleRequestDowngrade({
        supabase,
        requesterId: requesterUser.id,
        requesterRole: requesterProfile.role ?? "",
        body,
      });
    }

    if (action === "cancel_downgrade") {
      return await handleCancelDowngrade({
        supabase,
        requesterId: requesterUser.id,
        requesterRole: requesterProfile.role ?? "",
        body,
      });
    }

    if (action === "create_regularization_payment") {
      return await handleCreateRegularizationPayment({
        supabase,
        requesterId: requesterUser.id,
        requesterRole: requesterProfile.role ?? "",
        requesterProfile,
        body,
      });
    }

    if (action === "check_payment_status") {
      return await handleCheckPaymentStatus({
        supabase,
        requesterId: requesterUser.id,
        requesterRole: requesterProfile.role ?? "",
        body,
      });
    }

    if (action === "pay_with_card_token") {
      return await handlePayWithCardToken({
        supabase,
        requesterId: requesterUser.id,
        requesterRole: requesterProfile.role ?? "",
        requesterProfile,
        body,
      });
    }

    if (action === "charge_saved_card") {
      return await handleChargeSavedCard({
        supabase,
        requesterId: requesterUser.id,
        requesterRole: requesterProfile.role ?? "",
        requesterProfile,
        body,
      });
    }

    if (action === "save_card_token") {
      return await handleSaveCardToken({
        supabase,
        requesterId: requesterUser.id,
        requesterRole: requesterProfile.role ?? "",
        body,
      });
    }

    if (action === "remove_saved_card") {
      return await handleRemoveSavedCard({
        supabase,
        requesterId: requesterUser.id,
        requesterRole: requesterProfile.role ?? "",
        body,
      });
    }

    throw new Error("Ação inválida.");
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

async function handleRequestDowngrade({
  supabase,
  requesterId,
  requesterRole,
  body,
}: {
  supabase: ReturnType<typeof createClient>;
  requesterId: string;
  requesterRole: string;
  body: Record<string, unknown>;
}) {
  const personalId = requesterRole === "owner"
    ? getString(body, ["personalId"]) || requesterId
    : requesterId;
  const requestedTargetPlan = normalizePlan(getString(body, ["targetPlan", "plan"]));
  const requestedTargetBillingCycle = normalizeBillingCycle(
    getString(body, ["targetBillingCycle", "billingCycle", "cycle"]),
  );

  const { data: subscription, error: subscriptionError } = await supabase
    .from("personal_subscriptions")
    .select("id, personal_id, plan_slug, billing_cycle, status, student_limit, amount, currency, next_billing_at, blocked_at, grace_until, last_payment_id, last_payment_status, payment_provider, provider_subscription_id, current_period_start, current_period_end")
    .eq("personal_id", personalId)
    .single<SubscriptionRow>();

  if (subscriptionError || !subscription) {
    throw subscriptionError ?? new Error("Assinatura do personal não encontrada.");
  }

  const currentPlan = normalizePlan(subscription.plan_slug || "free");
  const currentBillingCycle = normalizeBillingCycle(subscription.billing_cycle || "monthly");
  const currentConfig = PLAN_CONFIGS[currentPlan];

  if (!currentConfig) {
    throw new Error("Plano atual do personal é inválido.");
  }

  if (currentPlan === "free") {
    throw new Error("O plano Free não possui downgrade disponível.");
  }

  const targetPlan = requestedTargetPlan || currentPlan;
  const targetBillingCycle = requestedTargetBillingCycle || currentBillingCycle;
  const targetConfig = PLAN_CONFIGS[targetPlan];

  if (!targetConfig) {
    throw new Error("Plano de destino inválido.");
  }

  if (targetPlan === currentPlan && targetBillingCycle === currentBillingCycle) {
    throw new Error("Nenhuma mudança de plano ou ciclo foi informada.");
  }

  const targetStudentLimit = targetConfig.studentLimit;
  const requiresStudentReduction = targetStudentLimit < (subscription.student_limit ?? currentConfig.studentLimit);
  const activeStudents = requiresStudentReduction
    ? await countActiveStudents({ supabase, personalId })
    : 0;

  if (requiresStudentReduction && activeStudents > targetStudentLimit) {
    throw new Error(
      `Para mudar para o plano ${targetPlan}, você precisa deixar no máximo ${targetStudentLimit} alunos ativos. Hoje você possui ${activeStudents} alunos ativos.`,
    );
  }

  const effectiveAt = subscription.next_billing_at ?? new Date().toISOString();
  const targetAmount = resolveTargetSubscriptionAmount({
    planSlug: targetPlan,
    billingCycle: targetBillingCycle,
  });
  const changeType = targetPlan !== currentPlan && targetBillingCycle !== currentBillingCycle
    ? "plan_and_billing_cycle_change"
    : targetPlan !== currentPlan
    ? "plan_change"
    : "billing_cycle_change";

  const { error: updateError } = await supabase
    .from("personal_subscriptions")
    .update({
      scheduled_plan_slug: targetPlan,
      scheduled_student_limit: targetStudentLimit,
      scheduled_billing_cycle: targetBillingCycle,
      scheduled_change_at: effectiveAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", subscription.id);

  if (updateError) throw updateError;

  return new Response(
    JSON.stringify({
      success: true,
      personalId,
      currentPlan,
      currentBillingCycle,
      targetPlan,
      targetBillingCycle,
      targetAmount,
      targetStudentLimit,
      changeType,
      activeStudents,
      effectiveAt,
    }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}

async function handleCancelDowngrade({
  supabase,
  requesterId,
  requesterRole,
  body,
}: {
  supabase: ReturnType<typeof createClient>;
  requesterId: string;
  requesterRole: string;
  body: Record<string, unknown>;
}) {
  const personalId = requesterRole === "owner"
    ? getString(body, ["personalId"]) || requesterId
    : requesterId;

  const { data: subscription, error: subscriptionError } = await supabase
    .from("personal_subscriptions")
    .select("id, personal_id, plan_slug, billing_cycle, status, student_limit, amount, currency, next_billing_at, blocked_at, grace_until, last_payment_id, last_payment_status, payment_provider, provider_subscription_id, current_period_start, current_period_end")
    .eq("personal_id", personalId)
    .single<SubscriptionRow>();

  if (subscriptionError || !subscription) {
    throw subscriptionError ?? new Error("Assinatura do personal não encontrada.");
  }

  const scheduledPlanSlug = await getScheduledPlanSlug({
    supabase,
    subscriptionId: subscription.id,
  });

  if (!scheduledPlanSlug) {
    throw new Error("Não existe downgrade agendado para cancelar.");
  }

  const { error: updateError } = await supabase
    .from("personal_subscriptions")
    .update({
      scheduled_plan_slug: null,
      scheduled_student_limit: null,
      scheduled_billing_cycle: null,
      scheduled_change_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", subscription.id);

  if (updateError) throw updateError;

  return new Response(
    JSON.stringify({
      success: true,
      personalId,
      currentPlan: normalizePlan(subscription.plan_slug || "free"),
      canceledPlan: scheduledPlanSlug,
    }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}

async function handleCreateRegularizationPayment({
  supabase,
  requesterId,
  requesterRole,
  requesterProfile,
  body,
}: {
  supabase: ReturnType<typeof createClient>;
  requesterId: string;
  requesterRole: string;
  requesterProfile: ProfileRow;
  body: Record<string, unknown>;
}) {
  const personalId = requesterRole === "owner"
    ? getString(body, ["personalId"]) || requesterId
    : requesterId;
  const method = normalizePaymentMethod(
    getString(body, ["method", "paymentMethod"]) || "pix",
  );

  const { subscription, personalProfile } = await getSubscriptionContext({
    supabase,
    personalId,
  });

  if (!PLAN_CONFIGS[normalizePlan(subscription.plan_slug || "free")]?.paid) {
    throw new Error("O plano atual não precisa de regularização de pagamento.");
  }

  const amount = await resolveSubscriptionAmount({ supabase, subscription });
  const currency = subscription.currency || "BRL";
  const description = buildPaymentDescription(subscription.plan_slug || "premium");
  const email = normalizeEmail(requesterProfile.email || personalProfile.email || "");
  const savedPaymentMethod = extractSavedPaymentMethod(personalProfile.data);
  const paymentProvider = resolveSubscriptionPaymentProvider({
    subscription,
    savedPaymentMethod,
    body,
  });
  const providerReference = buildProviderReference({
    personalId,
    subscriptionId: subscription.id,
  });

  let paymentResponse: Record<string, unknown>;
  let normalizedStatus: SubscriptionPaymentRow["status"];
  let providerPaymentId: string | null;
  let dueAt: string | null;

  if (paymentProvider === "asaas") {
    if (!savedPaymentMethod?.providerCustomerId) {
      throw new Error("Nao foi possivel identificar o cliente no Asaas. Crie a conta novamente pelo fluxo novo ou recadastre o metodo de pagamento.");
    }

    paymentResponse = await createAsaasRegularizationPayment({
      providerCustomerId: savedPaymentMethod.providerCustomerId,
      providerReference,
      description,
      amount,
      method,
      dueDate: buildAsaasDueDate(subscription.next_billing_at),
      config: getAsaasConfig(),
    });
    normalizedStatus = normalizeAsaasPaymentStatus(
      getString(paymentResponse, ["status"]) || "PENDING",
    );
    providerPaymentId = getString(paymentResponse, ["id"]) || null;
    dueAt = resolveAsaasDueAt(paymentResponse);
  } else {
    paymentResponse = method === "checkout-pro"
      ? await createCheckoutPreference({
        personalId,
        subscriptionId: subscription.id,
        providerReference,
        plan: normalizePlan(subscription.plan_slug || "premium"),
        amount,
        config: getMercadoPagoConfig(),
      })
      : await createPixPayment({
        personalId,
        subscriptionId: subscription.id,
        providerReference,
        plan: normalizePlan(subscription.plan_slug || "premium"),
        amount,
        email: email || "test@test.com",
        description,
        config: getMercadoPagoConfig(),
      });

    normalizedStatus = method === "checkout-pro"
      ? "pending"
      : normalizePaymentStatus(getString(paymentResponse, ["status"]) || "pending");
    providerPaymentId = method === "checkout-pro"
      ? null
      : getScalarAsString(paymentResponse.id) || null;
    dueAt = getString(paymentResponse, ["date_of_expiration", "expiration_date"]) || null;
  }

  const paymentInsert = {
    personal_id: personalId,
    subscription_id: subscription.id,
    plan_slug: normalizePlan(subscription.plan_slug || "premium"),
    billing_cycle: subscription.billing_cycle || "monthly",
    amount,
    currency,
    status: normalizedStatus,
    provider: paymentProvider,
    provider_payment_id: providerPaymentId,
    provider_reference: providerReference || null,
    description,
    due_at: dueAt || null,
    paid_at: normalizedStatus === "approved" ? new Date().toISOString() : null,
    raw_payload: paymentResponse,
  };

  const { data: insertedPayment, error: paymentInsertError } = await supabase
    .from("subscription_payments")
    .insert(paymentInsert)
    .select("*")
    .single<SubscriptionPaymentRow>();

  if (paymentInsertError || !insertedPayment) {
    throw paymentInsertError ?? new Error("Não foi possível salvar a cobrança de regularização.");
  }

  const { error: subscriptionUpdateError } = await supabase
    .from("personal_subscriptions")
    .update({
      amount,
      currency,
      payment_provider: paymentProvider,
      last_payment_id: providerPaymentId || subscription.last_payment_id,
      last_payment_status: normalizedStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", subscription.id);

  if (subscriptionUpdateError) throw subscriptionUpdateError;

  return new Response(
    JSON.stringify({
      success: true,
      action: "create_regularization_payment",
      paymentId: insertedPayment.id,
      providerPaymentId,
      providerReference,
      status: insertedPayment.status,
      method,
      checkoutUrl: extractNestedString(insertedPayment.raw_payload, [
        "init_point",
        "sandbox_init_point",
        "checkout_url",
        "checkoutUrl",
        "invoiceUrl",
        "invoice_url",
        "paymentUrl",
        "payment_url",
        "ticket_url",
        "ticketUrl",
      ]),
      pixCode: extractNestedString(insertedPayment.raw_payload, [
        "qr_code",
        "qrCode",
        "pixCode",
        "pix_code",
        "payload",
        "copyPaste",
        "copy_paste",
      ]),
      qrCodeBase64: extractNestedString(insertedPayment.raw_payload, [
        "qr_code_base64",
        "qrCodeBase64",
        "encodedImage",
      ]),
      ticketUrl: extractNestedString(insertedPayment.raw_payload, [
        "ticket_url",
        "ticketUrl",
        "invoiceUrl",
        "invoice_url",
        "bankSlipUrl",
        "bank_slip_url",
      ]),
    }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}

async function handleCheckPaymentStatus({
  supabase,
  requesterId,
  requesterRole,
  body,
}: {
  supabase: ReturnType<typeof createClient>;
  requesterId: string;
  requesterRole: string;
  body: Record<string, unknown>;
}) {
  const personalId = requesterRole === "owner"
    ? getString(body, ["personalId"]) || requesterId
    : requesterId;
  const providedProviderPaymentId = getString(body, ["providerPaymentId", "paymentId"]);
  const providedLocalPaymentId = getString(body, ["localPaymentId"]);

  const { subscription } = await getSubscriptionContext({
    supabase,
    personalId,
  });

  let paymentRecord: SubscriptionPaymentRow | null = null;

  if (providedLocalPaymentId) {
    const { data } = await supabase
      .from("subscription_payments")
      .select("*")
      .eq("id", providedLocalPaymentId)
      .eq("subscription_id", subscription.id)
      .maybeSingle<SubscriptionPaymentRow>();
    paymentRecord = data ?? null;
  }

  if (!paymentRecord && providedProviderPaymentId) {
    const { data } = await supabase
      .from("subscription_payments")
      .select("*")
      .eq("provider_payment_id", providedProviderPaymentId)
      .eq("subscription_id", subscription.id)
      .order("created_at", { ascending: false })
      .maybeSingle<SubscriptionPaymentRow>();
    paymentRecord = data ?? null;
  }

  if (!paymentRecord) {
    const { data } = await supabase
      .from("subscription_payments")
      .select("*")
      .eq("subscription_id", subscription.id)
      .in("status", ["pending", "failed"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<SubscriptionPaymentRow>();
    paymentRecord = data ?? null;
  }

  if (!paymentRecord) {
    throw new Error("Nenhuma cobrança pendente encontrada para consultar.");
  }

  const paymentProvider = normalizePaymentProvider(
    paymentRecord.provider || subscription.payment_provider || "",
  ) || "mercadopago";

  if (!paymentRecord.provider_payment_id) {
    return new Response(
      JSON.stringify({
        success: true,
        approved: false,
        status: paymentRecord.status,
        providerPaymentId: null,
        requiresRedirectCheck: true,
        payment: paymentRecord,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const gatewayPayment = paymentProvider === "asaas"
    ? await getAsaasPaymentById({
      paymentId: paymentRecord.provider_payment_id,
      config: getAsaasConfig(),
    })
    : await getPaymentById({
      paymentId: paymentRecord.provider_payment_id,
      config: getMercadoPagoConfig(),
    });
  const normalizedStatus = paymentProvider === "asaas"
    ? normalizeAsaasPaymentStatus(
      getString(gatewayPayment, ["status"]) || paymentRecord.status,
    )
    : normalizePaymentStatus(
      getString(gatewayPayment, ["status"]) || paymentRecord.status,
    );
  const paidAt = paymentProvider === "asaas"
    ? resolveAsaasPaidAt(gatewayPayment)
    : getString(gatewayPayment, ["date_approved"]) || null;
  const dueAt = paymentProvider === "asaas"
    ? resolveAsaasDueAt(gatewayPayment) || paymentRecord.due_at
    : getString(gatewayPayment, ["date_of_expiration", "expiration_date"]) || paymentRecord.due_at;

  const { data: updatedPayment, error: paymentUpdateError } = await supabase
    .from("subscription_payments")
    .update({
      status: normalizedStatus,
      provider: paymentProvider,
      paid_at: normalizedStatus === "approved" ? paidAt || new Date().toISOString() : null,
      due_at: dueAt || null,
      raw_payload: gatewayPayment,
    })
    .eq("id", paymentRecord.id)
    .select("*")
    .single<SubscriptionPaymentRow>();

  if (paymentUpdateError || !updatedPayment) {
    throw paymentUpdateError ?? new Error("Não foi possível atualizar o status da cobrança.");
  }

  await syncSubscriptionWithPayment({
    supabase,
    subscription,
    payment: updatedPayment,
  });

  return new Response(
    JSON.stringify({
      success: true,
      approved: updatedPayment.status === "approved",
      status: updatedPayment.status,
      providerPaymentId: updatedPayment.provider_payment_id,
      payment: updatedPayment,
    }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}

async function handlePayWithCardToken({
  supabase,
  requesterId,
  requesterRole,
  requesterProfile,
  body,
}: {
  supabase: ReturnType<typeof createClient>;
  requesterId: string;
  requesterRole: string;
  requesterProfile: ProfileRow;
  body: Record<string, unknown>;
}) {
  const personalId = requesterRole === "owner"
    ? getString(body, ["personalId"]) || requesterId
    : requesterId;

  const cardInput = parseCardTokenPaymentInput(body);
  const { subscription, personalProfile } = await getSubscriptionContext({
    supabase,
    personalId,
  });
  const existingSavedMethod = extractSavedPaymentMethod(personalProfile.data);
  const paymentProvider = resolveSubscriptionPaymentProvider({
    subscription,
    savedPaymentMethod: existingSavedMethod,
    body,
  });

  if (!PLAN_CONFIGS[normalizePlan(subscription.plan_slug || "free")]?.paid) {
    throw new Error("O plano atual não precisa de regularização de pagamento.");
  }

  if (paymentProvider === "asaas") {
    throw new Error("O formulario de cartao do painel ainda nao foi migrado para o Asaas. Por enquanto, gere a cobranca PIX ou conclua o pagamento/cartao pelo fluxo novo da landing.");
  }

  const amount = await resolveSubscriptionAmount({ supabase, subscription });
  const currency = subscription.currency || "BRL";
  const description = buildPaymentDescription(subscription.plan_slug || "premium");
  const email = normalizeEmail(requesterProfile.email || personalProfile.email || "");

  if (!email) {
    throw new Error("Não foi possível identificar o email do pagador.");
  }

  const providerReference = buildProviderReference({
    personalId,
    subscriptionId: subscription.id,
  });

  const validationPaymentContext = buildFirstValidationPaymentContext({
    subscription,
  });

  const gatewayPayment = await createCardTokenPayment({
    personalId,
    subscriptionId: subscription.id,
    providerReference,
    plan: normalizePlan(subscription.plan_slug || "premium"),
    amount,
    email,
    description,
    config: getMercadoPagoConfig(),
    cardInput,
    validationPaymentContext,
    savedPaymentMethod: existingSavedMethod,
  });

  const normalizedStatus = normalizePaymentStatus(
    getString(gatewayPayment, ["status"]) || "pending",
  );
  const providerPaymentId = getScalarAsString(gatewayPayment.id);
  const paidAt = getString(gatewayPayment, ["date_approved"]) || null;
  const dueAt = getString(gatewayPayment, ["date_of_expiration", "expiration_date"]) || null;

  const paymentInsert = {
    personal_id: personalId,
    subscription_id: subscription.id,
    plan_slug: normalizePlan(subscription.plan_slug || "premium"),
    billing_cycle: subscription.billing_cycle || "monthly",
    amount,
    currency,
    status: normalizedStatus,
    provider: "mercadopago",
    provider_payment_id: providerPaymentId || null,
    provider_reference: providerReference,
    description,
    due_at: dueAt,
    paid_at: normalizedStatus === "approved" ? paidAt || new Date().toISOString() : null,
    raw_payload: gatewayPayment,
  };

  const { data: insertedPayment, error: paymentInsertError } = await supabase
    .from("subscription_payments")
    .insert(paymentInsert)
    .select("*")
    .single<SubscriptionPaymentRow>();

  if (paymentInsertError || !insertedPayment) {
    throw paymentInsertError ?? new Error("Não foi possível salvar o pagamento com cartão.");
  }

  if (
    existingSavedMethod &&
    providerPaymentId &&
    insertedPayment.status === "approved" &&
    !existingSavedMethod.firstPaymentProviderPaymentId
  ) {
    await savePaymentMethodToProfile({
      supabase,
      personalId,
      currentData: personalProfile.data,
      paymentMethod: {
        ...existingSavedMethod,
        firstPaymentProviderPaymentId: providerPaymentId,
        paymentMethodId: existingSavedMethod.paymentMethodId || cardInput.paymentMethodId,
        issuerId: existingSavedMethod.issuerId || cardInput.issuerId || null,
        updatedAt: new Date().toISOString(),
      },
    });
  }

  await syncSubscriptionWithPayment({
    supabase,
    subscription,
    payment: insertedPayment,
  });

  return new Response(
    JSON.stringify({
      success: true,
      action: "pay_with_card_token",
      paymentId: insertedPayment.id,
      providerPaymentId: insertedPayment.provider_payment_id,
      status: insertedPayment.status,
      approved: insertedPayment.status === "approved",
      statusDetail: getString(gatewayPayment, ["status_detail", "statusDetail"]) || null,
      payment: insertedPayment,
    }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}

async function handleChargeSavedCard({
  supabase,
  requesterId,
  requesterRole,
  requesterProfile,
  body,
}: {
  supabase: ReturnType<typeof createClient>;
  requesterId: string;
  requesterRole: string;
  requesterProfile: ProfileRow;
  body: Record<string, unknown>;
}) {
  const personalId = requesterRole === "owner"
    ? getString(body, ["personalId"]) || requesterId
    : requesterId;

  const { subscription, personalProfile } = await getSubscriptionContext({
    supabase,
    personalId,
  });

  if (!PLAN_CONFIGS[normalizePlan(subscription.plan_slug || "free")]?.paid) {
    throw new Error("O plano atual não precisa de regularização de pagamento.");
  }

  const existingMethod = extractSavedPaymentMethod(personalProfile.data);
  const paymentProvider = resolveSubscriptionPaymentProvider({
    subscription,
    savedPaymentMethod: existingMethod,
    body,
  });
  if (paymentProvider === "asaas") {
    throw new Error("A cobranca automatica com cartao salvo ainda nao foi migrada para o Asaas no painel. Use o PIX/manual por enquanto.");
  }
  if (!existingMethod?.providerCustomerId || (!existingMethod.providerCardId && !existingMethod.providerPaymentProfileId)) {
    throw new Error("Nenhum cartão salvo foi encontrado para este perfil.");
  }

  const config = getMercadoPagoConfig();
  let savedPaymentMethod = existingMethod;

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
      personalId,
      currentData: personalProfile.data,
      paymentMethod: savedPaymentMethod,
    });
  }

  if (!savedPaymentMethod.paymentMethodId && !savedPaymentMethod.providerPaymentProfileId) {
    throw new Error("Não foi possível identificar os dados do cartão salvo. Cadastre o cartão novamente.");
  }

  const amount = await resolveSubscriptionAmount({ supabase, subscription });
  const currency = subscription.currency || "BRL";
  const description = buildPaymentDescription(
    subscription.plan_slug || "premium",
    "regularization",
  );
  const email = normalizeEmail(requesterProfile.email || personalProfile.email || "");

  if (!email) {
    throw new Error("Não foi possível identificar o email do pagador.");
  }

  const providerReference = buildProviderReference({
    personalId,
    subscriptionId: subscription.id,
    prefix: "saved",
  });

  const automaticPaymentContext = await resolveAutomaticPaymentContext({
    supabase,
    subscription,
    savedPaymentMethod,
  });

  const gatewayPayment = await createSavedCardPayment({
    personalId,
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
  const dueAt = getString(gatewayPayment, ["date_of_expiration", "expiration_date"]) || null;

  const paymentInsert = {
    personal_id: personalId,
    subscription_id: subscription.id,
    plan_slug: normalizePlan(subscription.plan_slug || "premium"),
    billing_cycle: subscription.billing_cycle || "monthly",
    amount,
    currency,
    status: normalizedStatus,
    provider: "mercadopago",
    provider_payment_id: providerPaymentId || null,
    provider_reference: providerReference,
    description,
    due_at: dueAt,
    paid_at: normalizedStatus === "approved" ? paidAt || new Date().toISOString() : null,
    raw_payload: gatewayPayment,
  };

  const { data: insertedPayment, error: paymentInsertError } = await supabase
    .from("subscription_payments")
    .insert(paymentInsert)
    .select("*")
    .single<SubscriptionPaymentRow>();

  if (paymentInsertError || !insertedPayment) {
    throw paymentInsertError ?? new Error("Não foi possível salvar o pagamento com cartão salvo.");
  }

  await syncSubscriptionWithPayment({
    supabase,
    subscription,
    payment: insertedPayment,
  });

  return new Response(
    JSON.stringify({
      success: true,
      action: "charge_saved_card",
      paymentId: insertedPayment.id,
      providerPaymentId: insertedPayment.provider_payment_id,
      status: insertedPayment.status,
      approved: insertedPayment.status === "approved",
      statusDetail: getString(gatewayPayment, ["status_detail", "statusDetail"]) || null,
      payment: insertedPayment,
    }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}

async function handleSaveCardToken({
  supabase,
  requesterId,
  requesterRole,
  body,
}: {
  supabase: ReturnType<typeof createClient>;
  requesterId: string;
  requesterRole: string;
  body: Record<string, unknown>;
}) {
  const personalId = requesterRole === "owner"
    ? getString(body, ["personalId"]) || requesterId
    : requesterId;

  const cardInput = parseCardTokenPaymentInput(body);
  const { subscription, personalProfile } = await getSubscriptionContext({
    supabase,
    personalId,
  });

  if (!PLAN_CONFIGS[normalizePlan(subscription.plan_slug || "free")]?.paid) {
    throw new Error("Somente planos pagos podem cadastrar cartão.");
  }

  const paymentProvider = resolveSubscriptionPaymentProvider({
    subscription,
    savedPaymentMethod: extractSavedPaymentMethod(personalProfile.data),
    body,
  });
  if (paymentProvider === "asaas") {
    throw new Error("O cadastro de cartao no painel ainda esta no fluxo antigo do Mercado Pago. Para Asaas, vamos concluir esse trecho no proximo passo.");
  }

  const email = normalizeEmail(personalProfile.email || "");
  if (!email) {
    throw new Error("Não foi possível identificar o email do titular para salvar o cartão.");
  }

  const config = getMercadoPagoConfig();
  const existingMethod = extractSavedPaymentMethod(personalProfile.data);
  const providerCustomerId = existingMethod?.providerCustomerId ||
    await createMercadoPagoCustomer({
      email,
      config,
    });

  if (existingMethod?.providerCardId) {
    await deleteMercadoPagoCustomerCard({
      customerId: providerCustomerId,
      cardId: existingMethod.providerCardId,
      config,
      ignoreNotFound: true,
    });
  }

  const savedCardResponse = await createMercadoPagoCustomerCard({
    customerId: providerCustomerId,
    config,
    cardInput,
  });

  const savedPaymentMethod = buildSavedPaymentMethod({
    providerCustomerId,
    cardResponse: savedCardResponse,
    fallbackBrand: cardInput.paymentMethodId,
    fallbackFirstPaymentProviderPaymentId: existingMethod?.firstPaymentProviderPaymentId || null,
  });

  await savePaymentMethodToProfile({
    supabase,
    personalId,
    currentData: personalProfile.data,
    paymentMethod: savedPaymentMethod,
  });

  return new Response(
    JSON.stringify({
      success: true,
      action: "save_card_token",
      provider: savedPaymentMethod.provider,
      providerCustomerId: savedPaymentMethod.providerCustomerId,
      providerCardId: savedPaymentMethod.providerCardId,
      brand: savedPaymentMethod.brand,
      lastFour: savedPaymentMethod.lastFour,
    }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}

async function handleRemoveSavedCard({
  supabase,
  requesterId,
  requesterRole,
  body,
}: {
  supabase: ReturnType<typeof createClient>;
  requesterId: string;
  requesterRole: string;
  body: Record<string, unknown>;
}) {
  const personalId = requesterRole === "owner"
    ? getString(body, ["personalId"]) || requesterId
    : requesterId;

  const { personalProfile } = await getSubscriptionContext({
    supabase,
    personalId,
  });

  const existingMethod = extractSavedPaymentMethod(personalProfile.data);

  if (existingMethod?.provider === "mercadopago" && existingMethod.providerCustomerId && existingMethod.providerCardId) {
    await deleteMercadoPagoCustomerCard({
      customerId: existingMethod.providerCustomerId,
      cardId: existingMethod.providerCardId,
      config: getMercadoPagoConfig(),
      ignoreNotFound: true,
    });
  }

  await savePaymentMethodToProfile({
    supabase,
    personalId,
    currentData: personalProfile.data,
    paymentMethod: null,
  });

  return new Response(
    JSON.stringify({
      success: true,
      action: "remove_saved_card",
    }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}

async function countActiveStudents({
  supabase,
  personalId,
}: {
  supabase: ReturnType<typeof createClient>;
  personalId: string;
}) {
  const { data, error } = await supabase
    .from("profiles")
    .select("data")
    .eq("personal_id", personalId)
    .eq("role", "aluno");

  if (error) throw error;

  return (data ?? []).filter((student) => {
    const status =
      typeof student?.data === "object" && student.data !== null
        ? (student.data as Record<string, unknown>).status
        : undefined;
    return status !== "inativo";
  }).length;
}

async function getSubscriptionContext({
  supabase,
  personalId,
}: {
  supabase: ReturnType<typeof createClient>;
  personalId: string;
}) {
  const [{ data: subscription, error: subscriptionError }, { data: personalProfile, error: profileError }] =
    await Promise.all([
      supabase
        .from("personal_subscriptions")
        .select("id, personal_id, plan_slug, billing_cycle, status, student_limit, amount, currency, next_billing_at, blocked_at, grace_until, last_payment_id, last_payment_status, payment_provider, provider_subscription_id, current_period_start, current_period_end")
        .eq("personal_id", personalId)
        .single<SubscriptionRow>(),
      supabase
        .from("profiles")
        .select("id, role, personal_id, data, email")
        .eq("id", personalId)
        .single<ProfileRow & { email: string | null }>(),
    ]);

  if (subscriptionError || !subscription) {
    throw subscriptionError ?? new Error("Assinatura do personal não encontrada.");
  }

  if (profileError || !personalProfile) {
    throw profileError ?? new Error("Perfil do personal não encontrado.");
  }

  return { subscription, personalProfile };
}

async function getScheduledPlanSlug({
  supabase,
  subscriptionId,
}: {
  supabase: ReturnType<typeof createClient>;
  subscriptionId: string;
}) {
  const { data, error } = await supabase
    .from("personal_subscriptions")
    .select("scheduled_plan_slug")
    .eq("id", subscriptionId)
    .maybeSingle<{ scheduled_plan_slug: string | null }>();

  if (error) throw error;
  return normalizePlan(data?.scheduled_plan_slug || "");
}

async function resolveSubscriptionAmount({
  supabase,
  subscription,
}: {
  supabase: ReturnType<typeof createClient>;
  subscription: SubscriptionRow;
}) {
  if (typeof subscription.amount === "number" && !Number.isNaN(subscription.amount)) {
    return Number(subscription.amount);
  }

  const { data: latestApprovedPayment } = await supabase
    .from("subscription_payments")
    .select("amount")
    .eq("subscription_id", subscription.id)
    .in("status", ["approved", "pending", "failed"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ amount: number }>();

  if (typeof latestApprovedPayment?.amount === "number") {
    return Number(latestApprovedPayment.amount);
  }

  const planSlug = normalizePlan(subscription.plan_slug || "");
  const defaultAmount = PLAN_PRICES[planSlug];

  if (typeof defaultAmount === "number") {
    return defaultAmount;
  }

  throw new Error(`Não foi possível determinar o valor da assinatura do plano ${planSlug || "atual"}.`);
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
        started_at: subscription.current_period_start || currentPeriodStart,
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

function getString(body: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = body[key];
    if (typeof value === "string") {
      return value.trim();
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

function normalizeBillingCycle(value: string) {
  const normalized = value.trim().toLowerCase();

  if (!normalized) return "";
  if (normalized === "annual") return "yearly";
  if (["monthly", "quarterly", "yearly"].includes(normalized)) return normalized;

  return "";
}

function getBillingCycleMultiplier(billingCycle: string) {
  if (billingCycle === "quarterly") return 3;
  if (billingCycle === "yearly") return 12;
  return 1;
}

function resolveTargetSubscriptionAmount({
  planSlug,
  billingCycle,
}: {
  planSlug: string;
  billingCycle: string;
}) {
  const baseAmount = PLAN_PRICES[planSlug];

  if (typeof baseAmount !== "number" || Number.isNaN(baseAmount)) {
    throw new Error(`Não foi possível determinar o valor do plano ${planSlug || "informado"}.`);
  }

  return Number((baseAmount * getBillingCycleMultiplier(billingCycle)).toFixed(2));
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function normalizePaymentMethod(value: string) {
  const normalized = value.trim().toLowerCase();
  if (normalized === "checkout-pro" || normalized === "pix") return normalized;
  return "pix";
}

function normalizePaymentProvider(value: string) {
  const normalized = value.trim().toLowerCase();

  if (!normalized) return "";
  if (normalized === "mercado_pago") return "mercadopago";
  if (normalized === "mercadopago" || normalized === "asaas") return normalized;

  return normalized;
}

function resolveSubscriptionPaymentProvider({
  subscription,
  savedPaymentMethod,
  body,
}: {
  subscription: SubscriptionRow;
  savedPaymentMethod: SavedPaymentMethod | null;
  body: Record<string, unknown>;
}) {
  const explicitProvider = normalizePaymentProvider(
    getString(body, ["paymentProvider", "provider"]),
  );

  if (explicitProvider === "asaas" || explicitProvider === "mercadopago") {
    return explicitProvider;
  }

  const savedProvider = normalizePaymentProvider(savedPaymentMethod?.provider || "");
  if (savedProvider === "asaas" || savedProvider === "mercadopago") {
    return savedProvider;
  }

  const subscriptionProvider = normalizePaymentProvider(subscription.payment_provider || "");
  if (subscriptionProvider === "asaas" || subscriptionProvider === "mercadopago") {
    return subscriptionProvider;
  }

  return "mercadopago";
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

function normalizeAsaasPaymentStatus(value: string): SubscriptionPaymentRow["status"] {
  const normalized = value.trim().toLowerCase();

  if (["received", "confirmed", "received_in_cash"].includes(normalized)) return "approved";
  if (["pending", "awaiting_risk_analysis", "authorized"].includes(normalized)) return "pending";
  if (["overdue", "deleted"].includes(normalized)) return "canceled";
  if (["refunded", "partially_refunded"].includes(normalized)) return "refunded";
  if (
    [
      "refund_requested",
      "refund_in_progress",
      "chargeback_requested",
      "chargeback_dispute",
      "awaiting_chargeback_reversal",
    ].includes(normalized)
  ) return "failed";

  return "pending";
}

function parseCardTokenPaymentInput(body: Record<string, unknown>): CardTokenPaymentInput {
  const token = getString(body, ["token"]);
  const paymentMethodId = getString(body, ["paymentMethodId", "payment_method_id"]);
  const issuerIdRaw = getString(body, ["issuerId", "issuer_id"]);
  const installmentsRaw = getString(body, ["installments"]) || "1";
  const identificationType = getString(body, ["identificationType", "identification_type"]);
  const identificationNumber = getString(body, ["identificationNumber", "identification_number"]);

  if (!token) throw new Error("Token do cartão não informado.");
  if (!paymentMethodId) throw new Error("Bandeira do cartão não informada.");
  if (!identificationType) throw new Error("Tipo de documento não informado.");
  if (!identificationNumber) throw new Error("Número do documento não informado.");

  const installments = Number(installmentsRaw);
  if (!Number.isFinite(installments) || installments <= 0) {
    throw new Error("Quantidade de parcelas inválida.");
  }

  return {
    token,
    paymentMethodId,
    issuerId: issuerIdRaw || null,
    installments,
    identificationType,
    identificationNumber,
  };
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

function getMercadoPagoConfig() {
  const accessToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN")?.trim() || "";
  const baseUrl = (
    Deno.env.get("PERSONAL_APP_BASE_URL") ||
    Deno.env.get("APP_BASE_URL") ||
    ""
  ).trim();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim() || "";

  if (!accessToken) {
    throw new Error("MERCADO_PAGO_ACCESS_TOKEN não configurado.");
  }
  if (!supabaseUrl) {
    throw new Error("SUPABASE_URL não configurado.");
  }

  return {
    accessToken,
    baseUrl,
    webhookUrl: `${supabaseUrl}/functions/v1/mercado-pago-webhook`,
    successPath: "/account/profile",
    failurePath: "/account/profile",
    pendingPath: "/account/profile",
  };
}

function getAsaasConfig() {
  const accessToken = (
    Deno.env.get("ASAAS_ACCESS_TOKEN") ||
    Deno.env.get("ASAAS_API_KEY") ||
    ""
  ).trim();
  const configuredBaseUrl = (Deno.env.get("ASAAS_BASE_URL") || "").trim();
  const configuredEnvironment = (
    Deno.env.get("ASAAS_ENVIRONMENT") ||
    Deno.env.get("ASAAS_ENV") ||
    ""
  ).trim().toLowerCase();

  if (!accessToken) {
    throw new Error("ASAAS_ACCESS_TOKEN nao configurado.");
  }

  const isSandbox = configuredEnvironment === "sandbox" || accessToken.startsWith("$aact_hmlg_");

  return {
    accessToken,
    baseUrl: configuredBaseUrl || (isSandbox
      ? "https://api-sandbox.asaas.com/v3"
      : "https://api.asaas.com/v3"),
    userAgent: (Deno.env.get("ASAAS_USER_AGENT") || "fitbodypro-personal-platform/1.0").trim(),
  };
}

async function asaasRequest(
  path: string,
  config: { accessToken: string; baseUrl: string; userAgent: string },
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: Record<string, unknown>;
  } = {},
) {
  const response = await fetch(`${config.baseUrl}${path}`, {
    method: options.method || "GET",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": config.userAgent,
      access_token: config.accessToken,
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errors = isRecord(data) && Array.isArray(data.errors)
      ? data.errors
        .map((entry) => {
          if (!isRecord(entry)) return "";
          return [
            getScalarAsString(entry.code),
            getScalarAsString(entry.description),
          ].filter(Boolean).join(": ");
        })
        .filter(Boolean)
      : [];

    throw new Error(
      [
        isRecord(data) ? getString(data, ["message", "error"]) : "",
        errors.length ? errors.join(" | ") : "",
        `asaas_path=${path}`,
        `asaas_status=${response.status}`,
      ].filter(Boolean).join(" - ") || "Erro ao comunicar com o Asaas.",
    );
  }

  return isRecord(data) ? data : {};
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
        card_token_debug: isRecord(requestBody.metadata)
          ? requestBody.metadata.card_token_debug ?? null
          : null,
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

async function createMercadoPagoCustomer({
  email,
  config,
}: {
  email: string;
  config: { accessToken: string };
}) {
  const existingCustomerId = await findMercadoPagoCustomerByEmail({
    email,
    config,
  });

  if (existingCustomerId) {
    return existingCustomerId;
  }

  const response = await mercadoPagoRequest("/v1/customers", config, {
    method: "POST",
    body: { email },
  });

  const customerId = getString(response, ["id"]) || getScalarAsString(response.id);
  if (!customerId) {
    throw new Error("Não foi possível criar o cliente no Mercado Pago.");
  }

  return customerId;
}

async function findMercadoPagoCustomerByEmail({
  email,
  config,
}: {
  email: string;
  config: { accessToken: string };
}) {
  const response = await fetch(`https://api.mercadopago.com/v1/customers/search?email=${encodeURIComponent(email)}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.accessToken}`,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    return "";
  }

  if (!isRecord(data) || !Array.isArray(data.results) || !data.results.length) {
    return "";
  }

  const firstCustomer = data.results[0];
  if (!isRecord(firstCustomer)) {
    return "";
  }

  return getScalarAsString(firstCustomer.id);
}

async function createMercadoPagoCustomerCard({
  customerId,
  config,
  cardInput,
}: {
  customerId: string;
  config: { accessToken: string };
  cardInput: CardTokenPaymentInput;
}) {
  return await mercadoPagoRequest(`/v1/customers/${customerId}/cards`, config, {
    method: "POST",
    body: {
      token: cardInput.token,
    },
  });
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
    debug: {
      responseId: getScalarAsString(response.id) || null,
      paymentMethodId: getString(response, ["payment_method_id", "paymentMethodId"]) || null,
      issuerId: getScalarAsString(response.issuer_id) || null,
      firstSixDigits: getScalarAsString(response.first_six_digits) || null,
      lastFourDigits: getScalarAsString(response.last_four_digits) || null,
      requiresEsc: response.requires_esc ?? null,
      securityCodeLength: isRecord(response.security_code)
        ? getScalarAsString(response.security_code.length) || null
        : null,
    },
  };
}

async function deleteMercadoPagoCustomerCard({
  customerId,
  cardId,
  config,
  ignoreNotFound = false,
}: {
  customerId: string;
  cardId: string;
  config: { accessToken: string };
  ignoreNotFound?: boolean;
}) {
  try {
    await mercadoPagoRequest(`/v1/customers/${customerId}/cards/${cardId}`, config, {
      method: "DELETE",
    });
  } catch (error) {
    if (ignoreNotFound && error instanceof Error && error.message.toLowerCase().includes("not found")) {
      return;
    }
    throw error;
  }
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
    (isRecord(cardResponse.issuer)
      ? getString(cardResponse.issuer, ["id"])
      : "");

  if (!cardId) {
    throw new Error("Não foi possível identificar o cartão salvo no Mercado Pago.");
  }

  return {
    provider: "mercadopago",
    providerCustomerId,
    providerCardId: cardId,
    providerPaymentProfileId: null,
    providerPaymentMethodToken: null,
    providerSubscriptionId: null,
    paymentMethodId: directBrand || nestedPaymentMethod || fallbackBrand || null,
    issuerId: issuerId || null,
    brand: directBrand || nestedPaymentMethod || fallbackBrand || null,
    lastFour: lastFour || null,
    firstPaymentProviderPaymentId: fallbackFirstPaymentProviderPaymentId,
    updatedAt: new Date().toISOString(),
  };
}

function extractSavedPaymentMethod(data: Record<string, unknown> | null): SavedPaymentMethod | null {
  if (!isRecord(data)) return null;

  const rawPaymentMethod = data.paymentMethod;
  if (!isRecord(rawPaymentMethod)) return null;

  const provider = normalizePaymentProvider(getString(rawPaymentMethod, ["provider"])) || "mercadopago";
  const providerCustomerId = getString(rawPaymentMethod, ["providerCustomerId"]);
  const providerCardId = getString(rawPaymentMethod, ["providerCardId"]);
  const providerPaymentProfileId = getString(rawPaymentMethod, [
    "providerPaymentProfileId",
    "paymentProfileId",
  ]);
  const providerPaymentMethodToken = getString(rawPaymentMethod, [
    "providerPaymentMethodToken",
    "paymentMethodToken",
  ]);
  const providerSubscriptionId = getString(rawPaymentMethod, ["providerSubscriptionId"]);
  const brand = getString(rawPaymentMethod, ["brand"]);
  const lastFour = getString(rawPaymentMethod, ["lastFour"]);

  const hasReusableMethod = provider === "asaas"
    ? Boolean(providerSubscriptionId || providerPaymentMethodToken || brand || lastFour)
    : Boolean(providerCardId || providerPaymentProfileId);

  if (!providerCustomerId || !hasReusableMethod) return null;

  return {
    provider: provider === "asaas" ? "asaas" : "mercadopago",
    providerCustomerId,
    providerCardId: providerCardId || null,
    providerPaymentProfileId: providerPaymentProfileId || null,
    providerPaymentMethodToken: providerPaymentMethodToken || null,
    providerSubscriptionId: providerSubscriptionId || null,
    paymentMethodId: getString(rawPaymentMethod, ["paymentMethodId"]) || null,
    issuerId: getString(rawPaymentMethod, ["issuerId"]) || null,
    brand: brand || null,
    lastFour: lastFour || null,
    firstPaymentProviderPaymentId: getString(rawPaymentMethod, ["firstPaymentProviderPaymentId"]) || null,
    updatedAt: getString(rawPaymentMethod, ["updatedAt"]) || new Date().toISOString(),
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

function buildBackUrls(config: { baseUrl: string; successPath: string; failurePath: string; pendingPath: string }, plan: string) {
  if (!config.baseUrl) return undefined;

  return {
    success: `${config.baseUrl}${config.successPath}?plan=${plan}`,
    failure: `${config.baseUrl}${config.failurePath}`,
    pending: `${config.baseUrl}${config.pendingPath}`,
  };
}

async function createCheckoutPreference({
  personalId,
  subscriptionId,
  providerReference,
  plan,
  amount,
  config,
}: {
  personalId: string;
  subscriptionId: string;
  providerReference: string;
  plan: string;
  amount: number;
  config: { accessToken: string; baseUrl: string; webhookUrl: string; successPath: string; failurePath: string; pendingPath: string };
}) {
  return await mercadoPagoRequest("/checkout/preferences", config, {
    method: "POST",
    body: {
      items: [
        {
          title: buildPaymentDescription(plan),
          description: buildPaymentDescription(plan),
          quantity: 1,
          currency_id: "BRL",
          unit_price: amount,
        },
      ],
      ...(buildBackUrls(config, plan) ? { back_urls: buildBackUrls(config, plan) } : {}),
      auto_return: "approved",
      notification_url: config.webhookUrl,
      external_reference: providerReference,
      metadata: {
        plan,
        personalId,
        subscriptionId,
        providerReference,
        source: "personal-platform-regularization",
      },
    },
  });
}

async function createAsaasRegularizationPayment({
  providerCustomerId,
  providerReference,
  description,
  amount,
  method,
  dueDate,
  config,
}: {
  providerCustomerId: string;
  providerReference: string;
  description: string;
  amount: number;
  method: "pix" | "checkout-pro";
  dueDate: string;
  config: { accessToken: string; baseUrl: string; userAgent: string };
}) {
  const payment = await asaasRequest("/payments", config, {
    method: "POST",
    body: {
      customer: providerCustomerId,
      billingType: method === "pix" ? "PIX" : "UNDEFINED",
      value: amount,
      dueDate,
      description,
      externalReference: providerReference,
    },
  });

  const paymentId = getString(payment, ["id"]);
  if (!paymentId || method !== "pix") {
    return payment;
  }

  try {
    const pixQrCode = await getAsaasPixQrCode({
      paymentId,
      config,
    });

    return {
      ...payment,
      pixQrCode,
      pixCode: getString(pixQrCode, ["payload", "copyPaste", "pixCode"]),
      qrCodeBase64: getString(pixQrCode, ["encodedImage", "qrCodeBase64"]),
    };
  } catch (error) {
    return {
      ...payment,
      pixQrCodeError: error instanceof Error ? error.message : "Nao foi possivel carregar o QR Code Pix no Asaas.",
    };
  }
}

async function createPixPayment({
  personalId,
  subscriptionId,
  providerReference,
  plan,
  amount,
  email,
  description,
  config,
}: {
  personalId: string;
  subscriptionId: string;
  providerReference: string;
  plan: string;
  amount: number;
  email: string;
  description: string;
  config: { accessToken: string; webhookUrl: string };
}) {
  const idempotencyKey = `${Date.now()}-${crypto.randomUUID()}`;

  return await mercadoPagoRequest("/v1/payments", config, {
    method: "POST",
    headers: {
      "X-Idempotency-Key": idempotencyKey,
    },
    body: {
      transaction_amount: amount,
      description,
      payment_method_id: "pix",
      payer: {
        email,
        first_name: "Cliente",
        last_name: "FitBodyPro",
      },
      notification_url: config.webhookUrl,
      external_reference: providerReference,
      metadata: {
        plan,
        personalId,
        subscriptionId,
        providerReference,
        source: "personal-platform-regularization",
      },
    },
  });
}

async function createCardTokenPayment({
  personalId,
  subscriptionId,
  providerReference,
  plan,
  amount,
  email,
  description,
  config,
  cardInput,
  validationPaymentContext,
  savedPaymentMethod,
}: {
  personalId: string;
  subscriptionId: string;
  providerReference: string;
  plan: string;
  amount: number;
  email: string;
  description: string;
  config: { accessToken: string; webhookUrl: string };
  cardInput: CardTokenPaymentInput;
  validationPaymentContext: ValidationPaymentContext;
  savedPaymentMethod: SavedPaymentMethod | null;
}) {
  const idempotencyKey = `${Date.now()}-${crypto.randomUUID()}`;

  return await mercadoPagoRequest("/v1/payments", config, {
    method: "POST",
    headers: {
      "X-Idempotency-Key": idempotencyKey,
    },
    body: {
      transaction_amount: amount,
      token: cardInput.token,
      description,
      installments: cardInput.installments,
      payment_method_id: cardInput.paymentMethodId,
      ...(cardInput.issuerId ? { issuer_id: cardInput.issuerId } : {}),
      payer: savedPaymentMethod?.providerCustomerId ? {
        email,
        type: "customer",
        id: savedPaymentMethod.providerCustomerId,
        identification: {
          type: cardInput.identificationType,
          number: cardInput.identificationNumber,
        },
      } : {
        email,
        identification: {
          type: cardInput.identificationType,
          number: cardInput.identificationNumber,
        },
      },
      point_of_interaction: buildFirstValidationPaymentPointOfInteraction(validationPaymentContext),
      notification_url: config.webhookUrl,
      external_reference: providerReference,
      metadata: {
        plan,
        personalId,
        subscriptionId,
        providerReference,
        source: "personal-platform-card-form",
      },
    },
  });
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
    throw new Error("Não foi possível identificar a bandeira do cartão salvo. Cadastre o cartão novamente.");
  }

  try {
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
          source: "personal-platform-saved-card",
        },
      },
    });
  } catch (error) {
// #region debug-point card-token-error-context
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${message} - card_token_debug=${JSON.stringify(cardToken.debug)}`);
// #endregion debug-point card-token-error-context
  }
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

type ValidationPaymentContext = {
  subscriptionGatewayId: string;
  billingDate: string;
  invoicePeriod: { period: number; type: string };
  userPresent: boolean;
};

async function resolveAutomaticPaymentContext({
  supabase,
  subscription,
  savedPaymentMethod,
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
    throw new Error("Esse cartão salvo ainda não possui uma transação anterior rastreável. Faça um pagamento com o formulário completo uma vez para liberar as próximas cobranças automáticas.");
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

function buildFirstValidationPaymentPointOfInteraction(context: ValidationPaymentContext) {
  return {
    type: "SUBSCRIPTIONS",
    transaction_data: {
      first_time_use: true,
      subscription_id: context.subscriptionGatewayId,
      subscription_sequence: {
        number: 1,
        total: null,
      },
      invoice_period: context.invoicePeriod,
      billing_date: context.billingDate,
      user_present: context.userPresent,
    },
  };
}

function buildFirstValidationPaymentContext({
  subscription,
}: {
  subscription: SubscriptionRow;
}): ValidationPaymentContext {
  return {
    subscriptionGatewayId: resolveSubscriptionGatewayId(subscription),
    billingDate: formatBillingDate(subscription.next_billing_at || new Date().toISOString()),
    invoicePeriod: getInvoicePeriod(subscription.billing_cycle || "monthly"),
    userPresent: true,
  };
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

async function getPaymentById({
  paymentId,
  config,
}: {
  paymentId: string;
  config: { accessToken: string };
}) {
  if (!paymentId) {
    throw new Error("ID do pagamento obrigatório.");
  }

  return await mercadoPagoRequest(`/v1/payments/${paymentId}`, config);
}

async function getAsaasPaymentById({
  paymentId,
  config,
}: {
  paymentId: string;
  config: { accessToken: string; baseUrl: string; userAgent: string };
}) {
  if (!paymentId) {
    throw new Error("ID do pagamento obrigatorio.");
  }

  return await asaasRequest(`/payments/${paymentId}`, config);
}

async function getAsaasPixQrCode({
  paymentId,
  config,
}: {
  paymentId: string;
  config: { accessToken: string; baseUrl: string; userAgent: string };
}) {
  if (!paymentId) {
    throw new Error("ID do pagamento PIX obrigatorio.");
  }

  return await asaasRequest(`/payments/${paymentId}/pixQrCode`, config);
}

function buildAsaasDueDate(referenceIso: string | null) {
  const now = new Date();
  const referenceDate = referenceIso ? new Date(referenceIso) : now;
  const dueDate = Number.isNaN(referenceDate.getTime()) || referenceDate.getTime() < now.getTime()
    ? now
    : referenceDate;

  return formatBillingDate(dueDate.toISOString());
}

function resolveAsaasDueAt(gatewayPayment: Record<string, unknown>) {
  return getString(gatewayPayment, [
    "dueDate",
    "due_at",
    "expirationDate",
    "dateCreated",
  ]) || null;
}

function resolveAsaasPaidAt(gatewayPayment: Record<string, unknown>) {
  return getString(gatewayPayment, [
    "clientPaymentDate",
    "paymentDate",
    "confirmedDate",
    "creditDate",
  ]) || null;
}

function buildPaymentDescription(plan: string, purpose: "regularization" | "renewal" = "regularization") {
  const label = plan === "starter"
    ? "FitBody Starter"
    : plan === "premium" || plan === "pro" || plan === "elite" || plan === "unlimited"
    ? "FitBody Premium"
    : "FitBody Pro";

  return purpose === "renewal"
    ? `${label} - renovacao da assinatura`
    : `${label} - regularizacao da assinatura`;
}

function buildProviderReference({
  personalId,
  subscriptionId,
  prefix = "reg",
  suffix,
}: {
  personalId: string;
  subscriptionId: string;
  prefix?: string;
  suffix?: string;
}) {
  return `${prefix}_${personalId}_${subscriptionId}_${suffix || Date.now()}`;
}

function extractNestedString(value: unknown, keys: string[]): string | null {
  if (!value || typeof value !== "object") return null;

  const entries = Object.entries(value as Record<string, unknown>);

  for (const [key, entryValue] of entries) {
    if (typeof entryValue === "string" && keys.includes(key)) {
      return entryValue;
    }
  }

  for (const [, entryValue] of entries) {
    if (entryValue && typeof entryValue === "object") {
      const nested = extractNestedString(entryValue, keys);
      if (nested) return nested;
    }
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
