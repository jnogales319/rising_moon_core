// A short-lived, HMAC-signed marker proving the current session was just
// established from a password-recovery email. `/auth/confirm` sets it as an
// httpOnly cookie when it verifies a `type=recovery` link; the proxy checks it
// on `/reset-password/confirm` so only a genuine recovery session can complete
// a password change there (everyone else is bounced to the authenticated
// change-password page or /login).
//
// GoTrue v2 gives us nothing session-side to distinguish a recovery login from
// a magic-link or just-confirmed-signup login (all three land as `amr` method
// "otp"), so this marker is minted at the one point that DOES know: the
// verifyOtp call in the confirm route.
//
// The marker binds only the subject id and an issued-at timestamp. That's
// enough: a valid signature over the current user's own id proves recent
// email control, which is exactly what "arrived via a recovery link" means.
// Uses Web Crypto so it runs in both the Edge proxy and the Node route handler.

export const RECOVERY_MARKER_COOKIE = "rm_recovery";
export const RECOVERY_MARKER_MAX_AGE_MS = 60 * 60 * 1000;

// Resolves the HMAC signing secret. Production MUST supply it via the
// environment; outside production we fall back to a fixed dev value so
// `next dev` works with no setup. The fallback is unreachable in a production
// build, so it can never silently become the real key — a misconfigured
// production deploy gets "" instead, which fails safe (no marker ever
// validates; recovery links dead-end rather than the gate weakening).
export function getRecoveryMarkerSecret(): string {
  const configured = process.env.RECOVERY_MARKER_SECRET;
  if (configured) {
    return configured;
  }
  if (process.env.NODE_ENV !== "production") {
    return "insecure-development-only-recovery-marker-secret";
  }
  return "";
}

function bytesToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  // atob follows the forgiving-base64 spec, so missing padding is fine, but a
  // character outside the alphabet throws — callers treat that as "not a valid
  // marker" rather than letting it bubble.
  const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
  // Back it with a concrete ArrayBuffer so it satisfies BufferSource without a
  // cast (a bare `new Uint8Array(n)` widens to ArrayBufferLike under the DOM
  // lib's generic typing).
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function signRecoveryMarker(
  sub: string,
  issuedAtMs: number,
  secret: string,
): Promise<string> {
  const payload = `${sub}.${issuedAtMs}`;
  const key = await importKey(secret);
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  return `${payload}.${bytesToBase64Url(mac)}`;
}

export async function verifyRecoveryMarker(
  markerValue: string | null | undefined,
  opts: {
    sub: string;
    nowMs: number;
    secret: string;
    maxAgeMs?: number;
  },
): Promise<boolean> {
  const { sub, nowMs, secret, maxAgeMs = RECOVERY_MARKER_MAX_AGE_MS } = opts;

  if (!markerValue || !secret) {
    return false;
  }

  const segments = markerValue.split(".");
  if (segments.length !== 3) {
    return false;
  }
  const [markerSub, issuedAtRaw, macSegment] = segments;

  if (markerSub !== sub) {
    return false;
  }

  const issuedAtMs = Number(issuedAtRaw);
  if (!Number.isFinite(issuedAtMs)) {
    return false;
  }
  if (nowMs - issuedAtMs > maxAgeMs) {
    return false;
  }

  try {
    const key = await importKey(secret);
    // crypto.subtle.verify gives a constant-time comparison for free.
    return await crypto.subtle.verify(
      "HMAC",
      key,
      base64UrlToBytes(macSegment),
      new TextEncoder().encode(`${markerSub}.${issuedAtRaw}`),
    );
  } catch {
    return false;
  }
}
