"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function SupabaseClientStatus() {
  const [status, setStatus] = useState("checking...");

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const supabase = createClient();
        const { data, error } = await supabase.auth.getUser();
        if (cancelled) return;
        // getUser() returns an AuthSessionMissingError when there's simply
        // no logged-in user — that's the expected state here, not a failure.
        if (error && error.name !== "AuthSessionMissingError") {
          setStatus(`error: ${error.message}`);
          return;
        }
        setStatus(`connected (user: ${data.user ? data.user.id : "none"})`);
      } catch (err) {
        if (cancelled) return;
        setStatus(`error: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    check();

    return () => {
      cancelled = true;
    };
  }, []);

  return <p data-testid="client-status">Browser client: {status}</p>;
}
