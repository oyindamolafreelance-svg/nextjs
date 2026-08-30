import { createClient } from "@supabase/supabase-js";
import { supabaseUrl } from "./env";

// Service-role client — SERVER ONLY. Bypasses Row Level Security, so never
// import this into anything that runs in the browser. Used by the cron route
// that expires stale listings (it has no user session to act on behalf of).
export function createAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Add it to your environment (see .env.example)."
    );
  }
  return createClient(supabaseUrl(), serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
