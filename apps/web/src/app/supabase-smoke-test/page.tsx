import { createClient } from "@/lib/supabase/server";
import { SupabaseClientStatus } from "./client-status";

export const dynamic = "force-dynamic";

async function getServerStatus() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    // getUser() returns an AuthSessionMissingError when there's simply no
    // logged-in user — that's the expected state here, not a failure.
    if (error && error.name !== "AuthSessionMissingError") {
      return `error: ${error.message}`;
    }
    return `connected (user: ${data.user ? data.user.id : "none"})`;
  } catch (err) {
    return `error: ${err instanceof Error ? err.message : String(err)}`;
  }
}

export default async function SupabaseSmokeTestPage() {
  const serverStatus = await getServerStatus();

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-3xl font-semibold">Supabase Smoke Test</h1>
      <p data-testid="server-status">Server client: {serverStatus}</p>
      <SupabaseClientStatus />
    </main>
  );
}
