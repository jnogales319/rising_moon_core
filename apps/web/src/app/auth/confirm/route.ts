import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isSafeRedirectPath } from "@/lib/safe-redirect-path";
import {
  getRecoveryMarkerSecret,
  RECOVERY_MARKER_COOKIE,
  RECOVERY_MARKER_MAX_AGE_MS,
  signRecoveryMarker,
} from "@/lib/recovery-marker";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const requestedNext = searchParams.get("next");
  const next =
    requestedNext && isSafeRedirectPath(requestedNext)
      ? requestedNext
      : "/dashboard";

  if (!tokenHash || !type) {
    redirect("/auth/confirm/error");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type,
  });

  if (error) {
    redirect("/auth/confirm/error");
  }

  // This is the only point in the app that knows a session was just
  // established from a recovery email. Mint the short-lived marker cookie the
  // proxy uses to let this session — and only this session — complete a
  // password change on /reset-password/confirm.
  if (type === "recovery") {
    const secret = getRecoveryMarkerSecret();
    const userId = data.user?.id;
    if (secret && userId) {
      const cookieStore = await cookies();
      cookieStore.set(
        RECOVERY_MARKER_COOKIE,
        await signRecoveryMarker(userId, Date.now(), secret),
        {
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          path: "/",
          maxAge: RECOVERY_MARKER_MAX_AGE_MS / 1000,
        },
      );
    } else if (!secret) {
      // Only reachable in production (getRecoveryMarkerSecret falls back to a
      // dev value otherwise). Without the marker the proxy bounces this
      // recovery session off /reset-password/confirm to the authenticated
      // change-password page, which asks for a current password the user
      // doesn't have — a dead end. Make the misconfiguration loud.
      console.error(
        "RECOVERY_MARKER_SECRET is not set; password-recovery links cannot reach the set-new-password page. Set it in the production environment.",
      );
    }
  }

  redirect(next);
}
