import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * Cliente com a SERVICE ROLE: ignora a RLS. Use SÓ em src/lib/email/fila.ts
 * (reservar/concluir e-mails). Telas e server actions usam o cliente do usuário.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL não está configurada.");
  if (!chave) throw new Error("SUPABASE_SERVICE_ROLE_KEY não está configurada.");

  return createClient<Database>(url, chave, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
