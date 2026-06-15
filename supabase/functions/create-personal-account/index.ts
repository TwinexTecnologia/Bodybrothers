import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
};

type ProfileRow = {
  id: string;
  role: string | null;
};

type RequestMode =
  | {
      mode: "landing";
      requesterId: null;
      requesterRole: null;
    }
  | {
      mode: "owner";
      requesterId: string;
      requesterRole: "owner";
    };

const DEFAULT_EVOLUTION_MODE = "standalone";
const DEFAULT_ANAMNESIS_REVIEW_REQUIRED = true;
const DEFAULT_PLAN_SLUG = "free";
const PLAN_CONFIGS: Record<string, { studentLimit: number; paid: boolean }> = {
  free: { studentLimit: 1, paid: false },
  starter: { studentLimit: 10, paid: true },
  pro: { studentLimit: 30, paid: true },
  premium: { studentLimit: 30, paid: true },
  elite: { studentLimit: 999999, paid: true },
  unlimited: { studentLimit: 999999, paid: true },
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

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const requestMode = await resolveRequestMode(req, supabase);
    const body = await req.json().catch(() => ({}));

    const result = await createPersonalAccount({
      supabase,
      body: typeof body === "object" && body != null ? (body as Record<string, unknown>) : {},
      requestMode,
    });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

async function resolveRequestMode(
  req: Request,
  supabase: ReturnType<typeof createClient>,
): Promise<RequestMode> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const bearerToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : "";
  const apiKeyHeader = req.headers.get("x-api-key")?.trim() ?? "";
  const landingToken = (Deno.env.get("LANDING_SIGNUP_TOKEN") ?? "").trim();

  if (landingToken && (bearerToken === landingToken || apiKeyHeader === landingToken)) {
    return { mode: "landing", requesterId: null, requesterRole: null };
  }

  if (!bearerToken) {
    throw new Error("Token de autenticação ausente.");
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(bearerToken);

  if (authError || !user) {
    throw authError ?? new Error("Usuário solicitante não autenticado.");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .single<ProfileRow>();

  if (profileError || !profile) {
    throw profileError ?? new Error("Perfil do solicitante não encontrado.");
  }

  if (profile.role !== "owner") {
    throw new Error("Somente o owner pode criar personais manualmente.");
  }

  return {
    mode: "owner",
    requesterId: user.id,
    requesterRole: "owner",
  };
}

async function createPersonalAccount({
  supabase,
  body,
  requestMode,
}: {
  supabase: ReturnType<typeof createClient>;
  body: Record<string, unknown>;
  requestMode: RequestMode;
}) {
  const fullName = getString(body, ["fullName", "name"]);
  const email = getEmail(body, ["email"]);
  const password = getPassword(body, ["password"]);
  const phone = getString(body, ["phone", "whatsapp"]);
  const brandName = getString(body, ["brandName"]);
  const logoUrl = getString(body, ["logoUrl"]);
  const source = getString(body, ["source"]) || requestMode.mode;
  const loginUrl =
    getString(body, ["loginUrl"]) ||
    getString(body, ["redirectUrl"]) ||
    (Deno.env.get("PERSONAL_LOGIN_URL") ?? "").trim();

  if (!fullName || !email || !password) {
    throw new Error("Nome, email e senha são obrigatórios.");
  }

  if (!isValidEmail(email)) {
    throw new Error("Email inválido.");
  }

  if (password.length < 6) {
    throw new Error("A senha deve ter no mínimo 6 caracteres.");
  }

  const ownerCanOverride = requestMode.mode === "owner";
  const evolutionMode = resolveEvolutionMode(
    ownerCanOverride ? getString(body, ["evolutionMode"]) : "",
  );
  const anamnesisReviewRequired = ownerCanOverride
    ? getBoolean(body, ["anamnesisReviewRequired"], DEFAULT_ANAMNESIS_REVIEW_REQUIRED)
    : DEFAULT_ANAMNESIS_REVIEW_REQUIRED;

  const requestedPlan = getPlanSlug(body, ["plan", "planSlug"]);
  const planSlug = requestedPlan || DEFAULT_PLAN_SLUG;
  const planConfig = PLAN_CONFIGS[planSlug];

  if (!planConfig) {
    throw new Error("Plano informado é inválido.");
  }

  const paymentStatus = getString(body, ["paymentStatus"]).toLowerCase();
  const paymentProvider = getString(body, ["paymentProvider"]).toLowerCase();
  const paymentId = getString(body, ["paymentId"]);
  const studentLimit = planConfig.studentLimit;

  if (requestMode.mode === "landing" && planConfig.paid) {
    if (paymentStatus !== "approved") {
      throw new Error("Plano pago só pode criar a conta após pagamento aprovado.");
    }

    if (!paymentProvider || !paymentId) {
      throw new Error("Dados do pagamento são obrigatórios para planos pagos.");
    }
  }

  const { data: createdUser, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
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
      saas: {
        plan: planSlug,
        studentLimit,
        paymentStatus: planConfig.paid ? paymentStatus || "approved" : "free",
        paymentProvider: paymentProvider || null,
        paymentId: paymentId || null,
      },
    },
  });

  if (createError || !createdUser.user) {
    throw createError ?? new Error("Não foi possível criar o usuário do personal.");
  }

  const profileData = {
    phone,
    signupSource: source,
    branding: {
      brandName,
      logoUrl,
    },
    config: {
      evolutionMode,
      anamnesisReviewRequired,
    },
    saas: {
      plan: planSlug,
      studentLimit,
      status: "active",
      createdAt: new Date().toISOString(),
      paymentStatus: planConfig.paid ? paymentStatus || "approved" : "free",
      paymentProvider: paymentProvider || null,
      paymentId: paymentId || null,
    },
  };

  const { error: profileError } = await supabase.from("profiles").upsert({
    id: createdUser.user.id,
    full_name: fullName,
    email,
    role: "personal",
    created_by: requestMode.requesterId,
    data: profileData,
  });

  if (profileError) {
    await supabase.auth.admin.deleteUser(createdUser.user.id);
    throw profileError;
  }

  const { error: personalConfigError } = await supabase.from("personal_config").upsert({
    personal_id: createdUser.user.id,
    app_name: brandName || fullName,
    logo_url: logoUrl || null,
    status: "active",
    saas_monthly_value: 0,
    updated_at: new Date().toISOString(),
  });

  if (personalConfigError) {
    await supabase.from("profiles").delete().eq("id", createdUser.user.id);
    await supabase.auth.admin.deleteUser(createdUser.user.id);
    throw personalConfigError;
  }

  return {
    success: true,
    message: "Conta criada com sucesso.",
    personalId: createdUser.user.id,
    email,
    loginUrl: loginUrl || null,
    defaults: {
      plan: planSlug,
      studentLimit,
      evolutionMode,
      anamnesisReviewRequired,
    },
  };
}

function getString(body: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = body[key];
    if (typeof value === "string") {
      const normalized = value.trim();
      if (normalized) return normalized;
    }
  }
  return "";
}

function getEmail(body: Record<string, unknown>, keys: string[]) {
  const value = getString(body, keys);
  return value.toLowerCase();
}

function getPlanSlug(body: Record<string, unknown>, keys: string[]) {
  const value = getString(body, keys);
  return value.toLowerCase();
}

function getPassword(body: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = body[key];
    if (typeof value === "string") return value;
  }
  return "";
}

function getBoolean(body: Record<string, unknown>, keys: string[], fallback: boolean) {
  for (const key of keys) {
    const value = body[key];
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (["true", "1", "yes", "sim"].includes(normalized)) return true;
      if (["false", "0", "no", "nao", "não"].includes(normalized)) return false;
    }
  }
  return fallback;
}

function resolveEvolutionMode(value: string) {
  const normalized = value.trim().toLowerCase();
  if (normalized === "anamnesis") return "anamnesis";
  if (normalized === "manual" || normalized === "standalone") return "standalone";
  return DEFAULT_EVOLUTION_MODE;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
