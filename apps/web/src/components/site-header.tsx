import { headers } from "next/headers";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import AuthNavLink from "./auth-nav-link";

export default async function SiteHeader() {
  // proxy.ts has already verified the user for this request and forwards the
  // result via these headers, so this only needs a profile lookup — no
  // second getUser() round trip to the Auth server per render.
  const requestHeaders = await headers();
  const userId = requestHeaders.get("x-supabase-user-id");
  const userEmail = requestHeaders.get("x-supabase-user-email");

  let displayName: string | null = null;
  if (userId) {
    try {
      const supabase = await createClient();
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", userId)
        .maybeSingle();
      if (error) {
        console.error("SiteHeader profile lookup failed:", error);
      }
      displayName = profile?.display_name ?? userEmail ?? null;
    } catch (err) {
      // Missing Supabase config (CI, or a dev box without .env.local) —
      // render the logged-out header instead of crashing every route, same
      // convention as proxy.ts.
      console.error("SiteHeader failed to initialize Supabase client:", err);
    }
  }

  return (
    <header className="flex items-center justify-between border-b-2 border-accent/70 px-6 py-4">
      <Link href="/" className="font-semibold">
        Rising Moon
      </Link>
      <AuthNavLink loggedIn={!!userId} displayName={displayName} />
    </header>
  );
}
