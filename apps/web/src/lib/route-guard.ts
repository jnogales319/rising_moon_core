const PROTECTED_PATHS = ["/dashboard", "/account"];
const AUTH_ONLY_PATHS = ["/login", "/register", "/reset-password"];
// The set-new-password page. It's handled explicitly below rather than via the
// lists above: it needs to stay reachable by a genuine recovery session (which
// is otherwise indistinguishable from a normal login here — see
// lib/recovery-marker.ts), while a normal authenticated session that wanders
// onto it should be sent to the in-app change-password page, and a logged-out
// visitor to /login. matchesPath's nested-route rule would otherwise let the
// "/reset-password" AUTH_ONLY entry bounce a just-arrived recovery user to
// /dashboard.
const RESET_PASSWORD_CONFIRM_PATH = "/reset-password/confirm";
const CHANGE_PASSWORD_PATH = "/account/password";

function matchesPath(pathname: string, paths: string[]) {
  return paths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export function isResetPasswordConfirmPath(pathname: string): boolean {
  return matchesPath(pathname, [RESET_PASSWORD_CONFIRM_PATH]);
}

export function getGuardRedirect(
  pathname: string,
  isAuthenticated: boolean,
  hasRecoveryMarker = false,
): string | null {
  if (isResetPasswordConfirmPath(pathname)) {
    if (hasRecoveryMarker) {
      return null;
    }
    return isAuthenticated ? CHANGE_PASSWORD_PATH : "/login";
  }
  if (!isAuthenticated && matchesPath(pathname, PROTECTED_PATHS)) {
    return "/login";
  }
  if (isAuthenticated && matchesPath(pathname, AUTH_ONLY_PATHS)) {
    return "/dashboard";
  }
  return null;
}
