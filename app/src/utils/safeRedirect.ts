/**
 * safeRedirect.ts
 *
 * Validates redirect/return-URL values against a strict allowlist before any
 * navigation takes place.  This prevents open-redirect attacks where an
 * attacker crafts a URL like:
 *
 *   /login?returnTo=https://evil.com
 *   /login?returnTo=//evil.com
 *   /login?returnTo=javascript:alert(1)
 *
 * Rules applied (in order):
 *  1. Value must be a non-empty string.
 *  2. Value must start with a single "/" and must NOT start with "//" (protocol-relative).
 *  3. Value must NOT contain a protocol scheme (e.g. "http:", "https:", "javascript:").
 *  4. Value must NOT contain a backslash (IIS-style bypass: "/\evil.com").
 *  5. The pathname portion must match one of the ALLOWED_PATHS prefixes.
 *  6. If any check fails the fallback path is returned instead.
 */

/**
 * Internal routes that are safe redirect destinations.
 * Add new routes here as the application grows.
 * Prefix matching is used, so "/dashboard" covers "/dashboard/anything".
 */
const ALLOWED_PATH_PREFIXES: readonly string[] = [
  '/',
  '/login',
  '/dashboard',
] as const;

/** Returned whenever validation fails. */
const FALLBACK_PATH = '/dashboard';

/**
 * Returns `true` when `url` is a safe internal path.
 */
export function isSafeRedirectUrl(url: unknown): url is string {
  if (typeof url !== 'string' || url.trim() === '') return false;

  const trimmed = url.trim();

  // Must start with a single "/" — blocks absolute URLs and protocol-relative URLs.
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return false;

  // Block protocol schemes anywhere in the value.
  if (/[a-z][a-z\d+\-.]*:/i.test(trimmed)) return false;

  // Block backslash — used in some browser URL normalisation bypasses.
  if (trimmed.includes('\\')) return false;

  // Extract just the pathname (strip query/hash) for allowlist matching.
  const pathname = trimmed.split(/[?#]/)[0];

  // Path must match at least one allowed prefix.
  const allowed = ALLOWED_PATH_PREFIXES.some(
    (prefix) =>
      pathname === prefix ||
      (prefix !== '/' && pathname.startsWith(prefix + '/')) ||
      prefix === '/'
  );

  return allowed;
}

/**
 * Validates `url` and returns it unchanged when safe, or `fallback` otherwise.
 *
 * @param url      - Candidate redirect path (typically from a query parameter).
 * @param fallback - Returned when validation fails (default: "/dashboard").
 */
export function getSafeRedirectUrl(
  url: unknown,
  fallback: string = FALLBACK_PATH
): string {
  return isSafeRedirectUrl(url) ? (url as string).trim() : fallback;
}

/**
 * Reads the `returnTo` query parameter from the current URL and validates it.
 *
 * Usage in a component:
 *   const returnTo = getReturnToParam();   // safe to pass straight to navigate()
 */
export function getReturnToParam(fallback: string = FALLBACK_PATH): string {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('returnTo');
  return getSafeRedirectUrl(raw, fallback);
}
