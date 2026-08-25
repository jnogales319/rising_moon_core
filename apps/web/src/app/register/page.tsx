"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const DEBOUNCE_MS = 500;
const DISPLAY_NAME_STATUS_ID = "display-name-status";

const inputClassName =
  "rounded-md border border-muted/40 px-3 py-2 text-base focus:border-accent focus:outline-none";

type DisplayNameCheck = {
  name: string;
  status: "checking" | "available" | "taken";
} | null;

export default function Register() {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Tagged with the name it was for, so a stale/out-of-order response (or
  // one for a name the user has since edited away from) is simply ignored
  // at render time below rather than needing explicit request-id tracking.
  const [check, setCheck] = useState<DisplayNameCheck>(null);
  const [passwordMismatchError, setPasswordMismatchError] = useState<
    string | null
  >(null);
  const [signUpError, setSignUpError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!displayName) return;

    const timer = setTimeout(async () => {
      setCheck({ name: displayName, status: "checking" });

      const supabase = createClient();
      // Advisory only — if the check itself fails (resolved error or a
      // thrown rejection), fall back to no status rather than misreporting
      // "taken" or leaving "Checking availability…" stuck forever. Submit's
      // own authoritative re-check still guards signUp regardless.
      try {
        const { data, error } = await supabase.rpc(
          "is_display_name_available",
          { name: displayName },
        );
        setCheck(
          error
            ? null
            : { name: displayName, status: data ? "available" : "taken" },
        );
      } catch {
        setCheck(null);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [displayName]);

  const checkStatus =
    check && check.name === displayName ? check.status : "idle";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSignUpError(null);

    if (password !== confirmPassword) {
      setPasswordMismatchError("Passwords do not match.");
      return;
    }
    setPasswordMismatchError(null);

    const supabase = createClient();

    let available: boolean | null;
    try {
      const result = await supabase.rpc("is_display_name_available", {
        name: displayName,
      });
      if (result.error) {
        setSignUpError(result.error.message);
        return;
      }
      available = result.data;
    } catch (err) {
      setSignUpError(
        err instanceof Error ? err.message : "Something went wrong.",
      );
      return;
    }

    if (!available) {
      setCheck({ name: displayName, status: "taken" });
      return;
    }
    setCheck({ name: displayName, status: "available" });

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    });

    if (error) {
      // The rare race the pre-check can't catch (two identical display
      // names submitted at nearly the same instant) surfaces as a raw
      // Postgres constraint-violation message via the handle_new_user
      // trigger, not a clean GoTrue error — translate it to the same
      // message the pre-check already shows for this fact.
      setSignUpError(
        error.message.includes("profiles_display_name_lower_key")
          ? "That display name is taken."
          : error.message,
      );
      return;
    }

    setSubmitted(true);
  }

  if (submitted) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-3xl font-semibold">Check your email</h1>
        <p>Check your email to confirm your account.</p>
      </main>
    );
  }

  const displayNameTaken = checkStatus === "taken";

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
      <h1 className="text-3xl font-semibold">Create account</h1>
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-sm flex-col gap-4"
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="displayName">Display name</label>
          <input
            id="displayName"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            aria-invalid={displayNameTaken ? "true" : undefined}
            aria-describedby={
              displayNameTaken ? DISPLAY_NAME_STATUS_ID : undefined
            }
            required
            className={inputClassName}
          />
          <p
            id={DISPLAY_NAME_STATUS_ID}
            aria-live="polite"
            className={`text-sm ${checkStatus === "taken" ? "text-danger" : "text-muted"}`}
          >
            {checkStatus === "checking" && "Checking availability…"}
            {checkStatus === "taken" && "That display name is taken."}
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className={inputClassName}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
            className={inputClassName}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="confirmPassword">Confirm password</label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            minLength={8}
            required
            className={inputClassName}
          />
        </div>

        {passwordMismatchError && (
          <p className="text-sm text-danger">{passwordMismatchError}</p>
        )}
        {signUpError && <p className="text-sm text-danger">{signUpError}</p>}

        <button
          type="submit"
          className="rounded-md bg-accent-secondary px-4 py-2 font-medium text-background hover:bg-accent-secondary/90"
        >
          Create account
        </button>
      </form>

      <p className="text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="underline hover:text-foreground">
          Log in
        </Link>
      </p>
    </main>
  );
}
