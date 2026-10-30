/**
 * Only allows redirects to paths on our own site. Without this, a link like
 * /sign-in?next=https://evil.example could send users to a phishing page
 * right after they sign in (an "open redirect").
 */
export function safeNextPath(
  next: string | null | undefined,
  fallback = "/dashboard",
): string {
  if (
    !next ||
    !next.startsWith("/") ||
    next.startsWith("//") ||
    next.startsWith("/\\")
  )
    return fallback;
  return next;
}
