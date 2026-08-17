import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Copy apps/web/.env.local.example to apps/web/.env.local and fill in values from `supabase status`.",
    );
  }

  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      // NOTE: @supabase/ssr also passes a `headers` argument here (Cache-
      // Control/Expires/Pragma to stop a CDN from caching a refreshed auth
      // cookie — see proxy.ts, which applies them). There's no equivalent
      // API to set arbitrary response headers from a Server Component or
      // this shared factory, so it's intentionally not accepted here. This
      // matters only if a Route Handler ever uses this client to refresh a
      // session behind a caching CDN/reverse proxy — proxy.ts is the layer
      // that actually keeps sessions fresh, and does apply these headers.
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch (err) {
          // Next.js only allows cookie mutation in Server Actions/Route
          // Handlers; reading from a plain Server Component throws here,
          // which is expected — proxy.ts is what refreshes the session in
          // that case. Anything else is unexpected and worth surfacing.
          if (
            !(err instanceof Error) ||
            !err.message.includes("Cookies can only be modified")
          ) {
            console.error(
              "Unexpected error writing Supabase auth cookies:",
              err,
            );
          }
        }
      },
    },
  });
}
