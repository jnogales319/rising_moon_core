"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const inputClassName =
  "rounded-md border border-muted/40 px-3 py-2 text-base focus:border-accent focus:outline-none";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setLoginError(error.message);
      return;
    }

    router.push("/dashboard");
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
      <h1 className="font-display text-4xl font-semibold">Log in</h1>
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

        <div className="flex flex-col gap-1">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className={inputClassName}
          />
        </div>

        {loginError && <p className="text-sm text-danger">{loginError}</p>}

        <button
          type="submit"
          className="rounded-md bg-accent-secondary px-4 py-2 font-medium text-background hover:bg-accent-secondary/90"
        >
          Log in
        </button>
      </form>

      <p className="text-sm text-muted">
        Need an account?{" "}
        <Link href="/register" className="underline hover:text-foreground">
          Sign up
        </Link>
      </p>
    </main>
  );
}
