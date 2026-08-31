const PROTECTED_PATHS = ["/dashboard"];
const AUTH_ONLY_PATHS = ["/login", "/register", "/reset-password"];
// Reached via a freshly-established recovery session, which is
// indistinguishable from a normal session to this guard — matchesPath's
// nested-route rule would otherwise treat it as covered by the
// "/reset-password" entry above and bounce a just-arrived recovery user to
// /dashboard before they can set a new password. It's excluded from
// PROTECTED_PATHS too, so a stale/used link still renders the form and
// lets updateUser() surface GoTrue's own error.
const RESET_PASSWORD_CONFIRM_PATH = "/reset-password/confirm";

function matchesPath(pathname: string, paths: string[]) {
  return paths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export function getGuardRedirect(
  pathname: string,
  isAuthenticated: boolean,
): string | null {
  if (matchesPath(pathname, [RESET_PASSWORD_CONFIRM_PATH])) {
    return null;
  }
  if (!isAuthenticated && matchesPath(pathname, PROTECTED_PATHS)) {
    return "/login";
  }
  if (isAuthenticated && matchesPath(pathname, AUTH_ONLY_PATHS)) {
    return "/dashboard";
  }
  return null;
}
