import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.75.0";

const allowedOrigins = new Set([
  "https://estudioonline.github.io",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

const corsFor = (origin: string) => ({
  ...(allowedOrigins.has(origin) ? { "Access-Control-Allow-Origin": origin } : {}),
  "Vary": "Origin",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
});

const json = (body: Record<string, unknown>, status = 200, headers: Record<string,string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin") || "";
  const corsHeaders = corsFor(origin);
  const reply = (body: Record<string, unknown>, status = 200) => json(body, status, corsHeaders);
  if (origin && !allowedOrigins.has(origin)) return reply({ error: "Origem não permitida." }, 403);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply({ error: "Método não permitido." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return reply({ error: "Configuração segura do servidor indisponível." }, 500);
  }

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return reply({ error: "Sessão inválida." }, 401);

  const callerClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: callerData, error: callerError } = await callerClient.auth.getUser(token);
  if (callerError || !callerData.user) return reply({ error: "Sessão inválida." }, 401);

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("perfil,ativo")
    .eq("id", callerData.user.id)
    .maybeSingle();

  if (profileError) return reply({ error: "Não foi possível validar o administrador." }, 500);
  if (!profile?.ativo || profile.perfil !== "administrador") {
    return reply({ error: "Somente administradores ativos podem alterar senhas." }, 403);
  }

  let body: { user_id?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return reply({ error: "Dados inválidos." }, 400);
  }

  const userId = String(body.user_id || "").trim();
  const password = String(body.password || "");
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return reply({ error: "Usuário inválido." }, 400);
  if (password.length < 12) return reply({ error: "A senha deve ter pelo menos 12 caracteres." }, 400);
  if (password.length > 128) return reply({ error: "A senha é muito longa." }, 400);
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    return reply({ error: "A senha deve conter letra minúscula, maiúscula, número e símbolo." }, 400);
  }

  const { data: target, error: targetError } = await adminClient.auth.admin.getUserById(userId);
  if (targetError || !target.user) return reply({ error: "Usuário não encontrado." }, 404);

  const { error: updateError } = await adminClient.auth.admin.updateUserById(userId, { password });
  if (updateError) return reply({ error: updateError.message || "Não foi possível alterar a senha." }, 400);

  return reply({ ok: true, user_id: userId });
});
