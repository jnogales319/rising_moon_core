"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getErrorMessage } from "@/lib/error-message";
import { markPasswordResetSuccess } from "@/lib/reset-password-notice";

const inputClassName =
  "rounded-md border border-muted/40 px-3 py-2 text-base focus:border-accent focus:outline-none";

export default function ResetPasswordConfirm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [mismatchError, setMismatchError] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUpdateError(null);

    if (password !== confirmPassword) {
      setMismatchError("Passwords do not match.");
      return;
    }
    setMismatchError(null);

    const supabase = createClient();
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setUpdateError(error.message);
        return;
      }
    } catch (err) {
      setUpdateError(getErrorMessage(err));
      return;
    }

    // Avoids leaving a live recovery session in the browser once the
    // password has been changed. Best-effort: the password change already
    // succeeded, so a failed sign-out shouldn't block the redirect.
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore
    }

    markPasswordResetSuccess();
    router.push("/login");
    router.refresh();
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
      <h1 className="font-display text-4xl font-semibold">
        Set a new password
      </h1>
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-sm flex-col gap-4"
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="password">New password</label>
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
          <label htmlFor="confirmPassword">Confirm new password</label>
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

        {mismatchError && (
          <p className="text-sm text-danger">{mismatchError}</p>
        )}
        {updateError && <p className="text-sm text-danger">{updateError}</p>}

        <button
          type="submit"
          className="rounded-md bg-accent-secondary px-4 py-2 font-medium text-background hover:bg-accent-secondary/90"
        >
          Set new password
        </button>
      </form>
    </main>
  );
}
