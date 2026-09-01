"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import PendingButton from "@/components/pending-button";

export default function AuthNavLink({
  loggedIn,
  displayName,
}: {
  loggedIn: boolean;
  displayName: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    if (isLoggingOut) return;
    setIsLoggingOut(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("AuthNavLink logout failed:", error);
    }
    router.push("/login");
    router.refresh();
  }

  if (loggedIn) {
    return (
      <span className="flex items-center gap-3">
        <span className="font-medium">{displayName}</span>
        <PendingButton
          type="button"
          onClick={handleLogout}
          pending={isLoggingOut}
          idleLabel="Log out"
          pendingLabel="Logging out…"
          className="cursor-pointer text-sm text-muted underline hover:text-foreground disabled:opacity-60"
        />
      </span>
    );
  }

  if (pathname === "/login") {
    return null;
  }

  return (
    <Link href="/login" className="underline hover:no-underline">
      Log in
    </Link>
  );
}
