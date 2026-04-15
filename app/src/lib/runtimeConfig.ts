const LOCAL_API_BASE_URL = 'http://localhost:5000';

function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

function getHostName(): string {
  if (typeof window === 'undefined') return '';
  return window.location.hostname;
}

function isLocalHost(): boolean {
  const host = getHostName();
  return host === 'localhost' || host === '127.0.0.1';
}

function isAbsoluteUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function allowCrossOriginRedirects(): boolean {
  return String(import.meta.env.VITE_ALLOW_CROSS_ORIGIN_REDIRECT || '').trim().toLowerCase() === 'true';
}

function hasWindowLocation(): boolean {
  return typeof window !== 'undefined' && !!window.location;
}

function isExternalToCurrentHost(value: string): boolean {
  if (!isAbsoluteUrl(value) || !hasWindowLocation()) return false;
  try {
    const target = new URL(value);
    return target.origin !== window.location.origin;
  } catch {
    return false;
  }
}

/**
 * API base URL resolution order:
 * 1) VITE_API_URL (explicit env override)
 * 2) localhost fallback during local development
 * 3) empty string in deployed builds (same-origin/proxy)
 */
export function getApiBaseUrl(): string {
  const configured = String(import.meta.env.VITE_API_URL || '').trim();
  if (configured) return trimTrailingSlash(configured);
  if (isLocalHost()) return LOCAL_API_BASE_URL;
  return '';
}

/**
 * Post-login redirect target resolution:
 * 1) VITE_POST_LOGIN_REDIRECT_URL (optional explicit override)
 * 2) /dashboard on current origin
 */
export function getPostLoginRedirectTarget(): string {
  const configured = String(import.meta.env.VITE_POST_LOGIN_REDIRECT_URL || '').trim();
  if (configured) {
    if (configured.startsWith('/')) return configured;

    // Keep localhost fully local even if an external redirect is accidentally configured.
    if (isExternalToCurrentHost(configured) && !allowCrossOriginRedirects()) {
      return '/dashboard';
    }
    return configured;
  }
  return '/dashboard';
}

/**
 * OAuth callback URL resolution:
 * 1) VITE_OAUTH_REDIRECT_URL (explicit override)
 * 2) current-origin callback
 */
export function getOAuthCallbackUrl(): string {
  const currentOriginCallback = hasWindowLocation()
    ? `${window.location.origin}/auth/callback`
    : '/auth/callback';

  const configured = String(import.meta.env.VITE_OAUTH_REDIRECT_URL || '').trim();
  if (!configured) return currentOriginCallback;

  if (configured.startsWith('/')) {
    if (!hasWindowLocation()) return configured;
    return `${window.location.origin}${configured}`;
  }

  if (isExternalToCurrentHost(configured) && !allowCrossOriginRedirects()) {
    return currentOriginCallback;
  }

  return configured;
}
