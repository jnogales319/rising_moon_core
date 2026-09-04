"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { getErrorMessage } from "@/lib/error-message";
import PendingButton from "@/components/pending-button";

const inputClassName =
  "rounded-md border border-muted/40 px-3 py-2 text-base focus:border-accent focus:outline-none";

export default function ChangePasswordForm({ email }: { email: string }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [mismatchError, setMismatchError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [succeeded, setSucceeded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }
    setFormError(null);
    setSucceeded(false);

    if (newPassword !== confirmPassword) {
      setMismatchError("Passwords do not match.");
      return;
    }
    setMismatchError(null);
    setIsSubmitting(true);

    const supabase = createClient();

    // Re-verify the *current* password before allowing the change — this is
    // the whole point of an in-app change vs. the recovery flow. It assumes a
    // single password factor; if TOTP/MFA lands later this needs an AAL
    // step-up check alongside it (see the #51 discussion). Note this reuses
    // the same sign-in path as /login, so repeated wrong guesses here count
    // against GoTrue's per-identifier sign-in rate limit.
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });
      if (error) {
        // Only claim the password is wrong when GoTrue actually says so —
        // rate limits, captcha challenges, and 5xxs come back as errors too
        // and should surface as themselves, not a misleading "incorrect".
        const wrongPassword =
          (error as { code?: string }).code === "invalid_credentials" ||
          /invalid login credentials/i.test(error.message ?? "");
        setFormError(
          wrongPassword ? "Current password is incorrect." : error.message,
        );
        setIsSubmitting(false);
        return;
      }
    } catch (err) {
      setFormError(getErrorMessage(err));
      setIsSubmitting(false);
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) {
        // Surface GoTrue's own message (weak password, same as old, etc.)
        // rather than paraphrasing it.
        setFormError(error.message);
        setIsSubmitting(false);
        return;
      }
    } catch (err) {
      setFormError(getErrorMessage(err));
      setIsSubmitting(false);
      return;
    }

    // A password change is a common response to "someone else is in my
    // account", so revoke every *other* session — this device stays signed
    // in. Best-effort: the change already succeeded, and GoTrue rotates the
    // password regardless of whether this lands.
    try {
      await supabase.auth.signOut({ scope: "others" });
    } catch {
      // ignore
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setSucceeded(true);
    setIsSubmitting(false);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-sm flex-col gap-4"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor="currentPassword">Current password</label>
        <input
          id="currentPassword"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
          className={inputClassName}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="newPassword">New password</label>
        <input
          id="newPassword"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
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

      {mismatchError && <p className="text-sm text-danger">{mismatchError}</p>}
      {formError && <p className="text-sm text-danger">{formError}</p>}
      {succeeded && (
        <p role="status" className="text-sm text-success">
          Your password has been updated.
        </p>
      )}

      <PendingButton
        type="submit"
        pending={isSubmitting}
        idleLabel="Update password"
        pendingLabel="Updating password…"
        className="rounded-md bg-accent-secondary px-4 py-2 font-medium text-background hover:bg-accent-secondary/90"
      />
    </form>
  );
}
