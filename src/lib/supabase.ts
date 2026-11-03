import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { authStorage } from "./auth-storage";

// O navegador usa somente a chave pública anon/publishable; nunca coloque service_role aqui.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabasePublishableKey = (
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  || import.meta.env.VITE_SUPABASE_ANON_KEY
)?.trim();

const hasValidSupabaseConfig = Boolean(
  supabaseUrl
  && supabasePublishableKey
  && !supabaseUrl.includes("PREENCHER_AQUI")
  && !supabasePublishableKey.includes("PREENCHER_AQUI")
  && !supabaseUrl.includes("SEU-PROJETO")
  && !supabasePublishableKey.includes("COLE_SUA_CHAVE")
  && isHttpsUrl(supabaseUrl),
);

export const supabase = hasValidSupabaseConfig && supabaseUrl && supabasePublishableKey
  ? createClient<Database>(supabaseUrl, supabasePublishableKey, {
      auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true, storage: authStorage },
    })
  : null;
export const supabaseConfigured = supabase !== null;

function isHttpsUrl(value: string) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}
