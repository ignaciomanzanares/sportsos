import { createClient } from "@supabase/supabase-js";

const url  = import.meta.env.VITE_SUPABASE_URL;
const key  = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.warn("⚠️  Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en .env");
}

/** false = corriendo sin .env (dev/preview): no hay backend contra el cual escribir. */
export const supabaseConfigured = !!(url && key);

export const supabase = createClient(url ?? "", key ?? "", {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
