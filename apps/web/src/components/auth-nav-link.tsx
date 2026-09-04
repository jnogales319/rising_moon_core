"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import PendingButton from "@/components/pending-button";
import { useDropdownMenu } from "@/components/use-dropdown-menu";

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
  const { open, toggle, close, triggerRef, containerRef } = useDropdownMenu<
    HTMLButtonElement,
    HTMLSpanElement
  >({ preventClose: isLoggingOut });
  const menuId = useId();

  // displayName is null whenever the profile lookup fails or returns no
  // row and there's no email header to fall back to (see site-header.tsx) —
  // rare, but loggedIn can still be true then. Fall back to a generic label
  // so the trigger keeps a real accessible name instead of an empty one.
  const accountLabel = displayName ?? "Account";

  // AuthNavLink renders in the root layout and never unmounts across client
  // navigations, so isLoggingOut outlives the logout it belongs to. Clear it
  // the moment the server prop catches up to the signed-out state (i.e.
  // router.refresh has landed) — not mid-handler, where loggedIn is still
  // stale and dropping the flag flashes a "Log in"/"Log out" frame before
  // the redirect. Done in render, per React's "reset state on prop change"
  // guidance, so the corrected markup commits before the browser paints.
  const [prevLoggedIn, setPrevLoggedIn] = useState(loggedIn);
  if (prevLoggedIn !== loggedIn) {
    setPrevLoggedIn(loggedIn);
    if (!loggedIn) {
      setIsLoggingOut(false);
      close(); // don't reopen already-expanded on a later login
    }
  }

  async function handleLogout() {
    if (isLoggingOut) return;
    // Move focus off the item before it's disabled below — disabling a
    // focused element makes the browser force-blur it to <body>, which
    // would otherwise strand focus outside the still-open menu.
    triggerRef.current?.focus();
    setIsLoggingOut(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("AuthNavLink logout failed:", error);
    }
    router.push("/login");
    router.refresh();
  }

  if (loggedIn || isLoggingOut) {
    return (
      <span className="relative flex items-center" ref={containerRef}>
        <button
          type="button"
          ref={triggerRef}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={open ? menuId : undefined}
          onClick={toggle}
          className="inline-flex cursor-pointer items-center gap-1 font-medium underline hover:no-underline"
        >
          {accountLabel}
          <svg
            aria-hidden="true"
            viewBox="0 0 12 12"
            className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
          >
            <path
              d="M2.5 4.5 6 8l3.5-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {open && (
          <div
            id={menuId}
            role="menu"
            aria-label={`${accountLabel} account menu`}
            className="absolute right-0 top-full z-10 mt-2 flex w-max flex-col gap-0.5 rounded-md border border-accent/70 bg-surface p-1.5 shadow-lg"
          >
            <Link
              href="/account"
              role="menuitem"
              onClick={close}
              className="rounded px-3.5 py-2.5 text-left text-sm hover:bg-surface-2 hover:text-foreground"
            >
              Manage account
            </Link>
            <PendingButton
              type="button"
              role="menuitem"
              onClick={handleLogout}
              pending={isLoggingOut}
              idleLabel="Log out"
              pendingLabel="Logging out…"
              className="w-full cursor-pointer justify-start rounded px-3.5 py-2.5 text-left text-sm hover:bg-surface-2 hover:text-foreground disabled:opacity-60"
            />
          </div>
        )}
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
