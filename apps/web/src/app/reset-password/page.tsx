"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getErrorMessage } from "@/lib/error-message";
import PendingButton from "@/components/pending-button";

const inputClassName =
  "rounded-md border border-muted/40 px-3 py-2 text-base focus:border-accent focus:outline-none";

export default function ResetPassword() {
  const [email, setEmail] = useState("");
  const [requestError, setRequestError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }
    setRequestError(null);
    setIsSubmitting(true);

    const supabase = createClient();
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) {
        setRequestError(error.message);
        setIsSubmitting(false);
        return;
      }
    } catch (err) {
      setRequestError(getErrorMessage(err));
      setIsSubmitting(false);
      return;
    }

    setSubmitted(true);
  }

  if (submitted) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="font-display text-4xl font-semibold">
          Check your email
        </h1>
        <p>Check your email for a link to reset your password.</p>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
      <h1 className="font-display text-4xl font-semibold">
        Reset your password
      </h1>
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-sm flex-col gap-4"
      >
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

        {requestError && <p className="text-sm text-danger">{requestError}</p>}

        <PendingButton
          type="submit"
          pending={isSubmitting}
          idleLabel="Send reset link"
          pendingLabel="Sending reset link…"
          className="rounded-md bg-accent-secondary px-4 py-2 font-medium text-background hover:bg-accent-secondary/90"
        />
      </form>

      <p className="text-sm text-muted">
        <Link href="/login" className="underline hover:text-foreground">
          Back to log in
        </Link>
      </p>
    </main>
  );
}
