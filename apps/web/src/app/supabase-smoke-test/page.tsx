import { createClient } from "@/lib/supabase/server";
import { SupabaseClientStatus } from "./client-status";

export const dynamic = "force-dynamic";

async function getServerProfile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", userId)
      .maybeSingle();
    if (error) {
      console.error("supabase-smoke-test profile lookup failed:", error);
      return "error: profile lookup failed";
    }
    if (!data) {
      return "no profile row";
    }
    return `display_name: ${data.display_name ?? "(none)"}`;
  } catch (err) {
    console.error("supabase-smoke-test profile lookup threw:", err);
    return "error: profile lookup failed";
  }
}

export default async function SupabaseSmokeTestPage() {
  let serverStatus: string;
  let serverProfile: string;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    // getUser() returns an AuthSessionMissingError when there's simply no
    // logged-in user — that's the expected state here, not a failure.
    if (error && error.name !== "AuthSessionMissingError") {
      console.error("supabase-smoke-test auth check failed:", error);
      serverStatus = "error: auth check failed";
      serverProfile = "error: auth check failed, profile not checked";
    } else {
      serverStatus = `connected (user: ${data.user ? data.user.id : "none"})`;
      serverProfile = data.user
        ? await getServerProfile(supabase, data.user.id)
        : "no user";
    }
  } catch (err) {
    console.error("supabase-smoke-test client setup threw:", err);
    serverStatus = "error: client setup failed";
    serverProfile = "error: client setup failed, profile not checked";
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-3xl font-semibold">Supabase Smoke Test</h1>
      <p data-testid="server-status">Server client: {serverStatus}</p>
      <p data-testid="server-profile">Profile: {serverProfile}</p>
      <SupabaseClientStatus />
    </main>
  );
}
