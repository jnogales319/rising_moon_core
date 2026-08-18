const PROTECTED_PATHS = ["/dashboard"];
const AUTH_ONLY_PATHS = ["/login", "/register"];

function matchesPath(pathname: string, paths: string[]) {
  return paths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export function getGuardRedirect(
  pathname: string,
  isAuthenticated: boolean,
): string | null {
  if (!isAuthenticated && matchesPath(pathname, PROTECTED_PATHS)) {
    return "/login";
  }
  if (isAuthenticated && matchesPath(pathname, AUTH_ONLY_PATHS)) {
    return "/dashboard";
  }
  return null;
}
