import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { RECOVERY_MARKER_COOKIE } from "@/lib/recovery-marker";

// Called by the set-new-password page once a recovery password change has
// succeeded, to invalidate the recovery marker immediately rather than
// waiting for it to age out. Clearing an httpOnly cookie has to happen
// server-side, so it can't just be done inline on the client after
// updateUser(). Idempotent — it only ever removes the caller's own marker.
//
// Same-origin only: without this a cross-site form POST could navigate a
// victim mid-recovery here and wipe their in-flight marker, forcing them to
// restart. The confirm page hits this with a same-origin fetch, so a strict
// check costs nothing.
export async function POST(request: NextRequest) {
  const secFetchSite = request.headers.get("sec-fetch-site");
  const origin = request.headers.get("origin");
  const sameOrigin =
    secFetchSite === "same-origin" ||
    (origin !== null && origin === request.nextUrl.origin);
  if (!sameOrigin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const cookieStore = await cookies();
  cookieStore.set(RECOVERY_MARKER_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return NextResponse.json({ ok: true });
}
