"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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
        <button
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="cursor-pointer text-sm text-muted underline hover:text-foreground disabled:cursor-default disabled:opacity-60"
        >
          Log out
        </button>
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
