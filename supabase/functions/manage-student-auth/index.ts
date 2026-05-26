import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type ProfileRow = {
  id: string;
  role: string | null;
  personal_id: string | null;
  full_name: string | null;
  email: string | null;
  data: Record<string, unknown> | null;
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
      .select("id, role, personal_id")
      .eq("id", requesterUser.id)
      .single<ProfileRow>();

    if (requesterProfileError || !requesterProfile) {
      throw requesterProfileError ?? new Error("Perfil do solicitante não encontrado.");
    }

    if (!["personal", "owner"].includes(requesterProfile.role ?? "")) {
      throw new Error("Sem permissão para gerenciar credenciais de alunos.");
    }

    const body = await req.json().catch(() => ({}));
    const action = typeof body?.action === "string" ? body.action : "";

    if (action === "create") {
      return await handleCreateStudent({
        supabase,
        requesterId: requesterUser.id,
        requesterRole: requesterProfile.role ?? "",
        body,
      });
    }

    if (action === "update_credentials") {
      return await handleUpdateCredentials({
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

async function handleCreateStudent({
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
  const personalId =
    typeof body.personalId === "string" ? body.personalId.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const profileData =
    typeof body.profileData === "object" && body.profileData != null
      ? (body.profileData as Record<string, unknown>)
      : {};

  if (!personalId || !name || !email || !password) {
    throw new Error("Dados obrigatórios ausentes para criar aluno.");
  }

  if (password.length < 6) {
    throw new Error("A senha deve ter no mínimo 6 caracteres.");
  }

  if (requesterRole === "personal" && personalId !== requesterId) {
    throw new Error("Você só pode criar alunos vinculados ao seu perfil.");
  }

  const { data: createdUser, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: name,
      role: "aluno",
      personal_id: personalId,
      created_by: requesterId,
    },
  });

  if (createError || !createdUser.user) {
    throw createError ?? new Error("Não foi possível criar o usuário do aluno.");
  }

  const { error: profileError } = await supabase.from("profiles").upsert({
    id: createdUser.user.id,
    full_name: name,
    email,
    role: "aluno",
    personal_id: personalId,
    data: profileData,
    updated_at: new Date().toISOString(),
  });

  if (profileError) {
    throw profileError;
  }

  return new Response(
    JSON.stringify({ userId: createdUser.user.id }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}

async function handleUpdateCredentials({
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
  const studentId = typeof body.studentId === "string" ? body.studentId.trim() : "";
  const email =
    typeof body.email === "string" && body.email.trim()
      ? body.email.trim().toLowerCase()
      : undefined;
  const password =
    typeof body.password === "string" && body.password.trim()
      ? body.password
      : undefined;

  if (!studentId) {
    throw new Error("Aluno não informado.");
  }

  if (!email && !password) {
    throw new Error("Nenhuma credencial foi informada para atualização.");
  }

  if (password && password.length < 6) {
    throw new Error("A senha deve ter no mínimo 6 caracteres.");
  }

  const { data: studentProfile, error: studentProfileError } = await supabase
    .from("profiles")
    .select("id, role, personal_id, full_name, data")
    .eq("id", studentId)
    .single<ProfileRow>();

  if (studentProfileError || !studentProfile) {
    throw studentProfileError ?? new Error("Perfil do aluno não encontrado.");
  }

  if (studentProfile.role !== "aluno") {
    throw new Error("O usuário informado não é um aluno.");
  }

  if (requesterRole === "personal" && studentProfile.personal_id !== requesterId) {
    throw new Error("Você só pode editar credenciais dos seus alunos.");
  }

  const payload: Record<string, unknown> = {};
  if (email) {
    payload.email = email;
    payload.email_confirm = true;
  }
  if (password) payload.password = password;

  const { error: updateError } = await supabase.auth.admin.updateUserById(
    studentId,
    payload,
  );

  if (updateError) throw updateError;

  if (email) {
    const nextData = {
      ...(studentProfile.data ?? {}),
      email,
    };

    const { error: profileUpdateError } = await supabase
      .from("profiles")
      .update({
        email,
        data: nextData,
        updated_at: new Date().toISOString(),
      })
      .eq("id", studentId);

    if (profileUpdateError) throw profileUpdateError;
  }

  return new Response(
    JSON.stringify({ userId: studentId }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}
