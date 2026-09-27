/**
 * Paths that need a signed-in user; the middleware sends anyone else to sign-in. A route covers itself and
 * everything below it, matched on whole path segments: `/log` covers `/log` and `/log/new`, never `/login`.
 */
const PROTECTED_ROUTES = [
  "/dashboard",
  "/gear",
  "/api/gear",
  "/tonight",
  "/onboarding",
  "/api/onboarding",
  "/log",
  "/api/log",
];

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}
