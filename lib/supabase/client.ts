import { createBrowserClient } from "@supabase/ssr";
import { supabaseAnonKey, supabaseUrl } from "./env";

// Supabase client for Client Components (browser). Used where we need the
// live session in the browser; most data access happens server-side.
export function createClient() {
  return createBrowserClient(supabaseUrl(), supabaseAnonKey());
}
