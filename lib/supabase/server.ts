import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabaseAnonKey, supabaseUrl } from "./env";

// Supabase client for Server Components, Server Actions, and Route Handlers.
// Reads/writes the auth session through Next's cookie store. Writing cookies
// from a Server Component render is not allowed; that throws and is ignored
// here because proxy.ts refreshes the session cookie on every request.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component — safe to ignore, proxy refreshes it.
        }
      },
    },
  });
}
