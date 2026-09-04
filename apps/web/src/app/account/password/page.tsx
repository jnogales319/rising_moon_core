import { headers } from "next/headers";
import { redirect } from "next/navigation";
import ChangePasswordForm from "./change-password-form";

export default async function ChangePasswordPage() {
  // proxy.ts has already verified the session (and the route guard redirects
  // unauthenticated visitors off /account/*), so this just needs the verified
  // email it forwards. If it's somehow absent, we can't drive the re-auth
  // check — send the user somewhere useful rather than render a dead form.
  const email = (await headers()).get("x-supabase-user-email");
  if (!email) {
    redirect("/dashboard");
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
      <h1 className="font-display text-4xl font-semibold">
        Change your password
      </h1>
      <ChangePasswordForm email={email} />
    </main>
  );
}
