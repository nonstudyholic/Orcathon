import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Explicit type so the build does not depend on the installed @supabase/ssr version
// to infer it.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CookieToSet = { name: string; value: string; options?: any };

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component; middleware refreshes the session instead.
          }
        },
      },
    }
  );
}
