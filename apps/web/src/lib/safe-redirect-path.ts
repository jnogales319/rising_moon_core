// Guards a redirect target that originates from an untrusted query param
// (e.g. auth/confirm's `next`) against resolving to a different origin.
// Delegates to the URL parser itself rather than pattern-matching leading
// characters by hand — browsers normalize things like backslashes and
// stripped tab/newline characters into protocol-relative URLs in ways a
// manual character check misses (e.g. "/\evil.com" parses to
// "http://evil.com/", bypassing a plain `!startsWith("//")` check).
const SAME_ORIGIN_BASE = "http://localhost";

export function isSafeRedirectPath(path: string): boolean {
  if (!path.startsWith("/")) return false;
  try {
    return new URL(path, SAME_ORIGIN_BASE).origin === SAME_ORIGIN_BASE;
  } catch {
    return false;
  }
}
