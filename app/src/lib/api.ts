/**
 * Central API client for the Secure School Voting System backend.
 * Handles base URL, JWT token injection, and uniform error handling.
 */

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const TOKEN_KEY = 'ssvs_token';
const REFRESH_TOKEN_KEY = 'ssvs_refresh_token';
let refreshInFlight: Promise<string | null> | null = null;

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string, refreshToken?: string): void {
  localStorage.setItem(TOKEN_KEY, token);
  if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const response = await fetch(`${BASE_URL}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });

        if (!response.ok) {
          clearToken();
          return null;
        }

        const data = await response.json() as { accessToken: string; refreshToken?: string };
        setToken(data.accessToken, data.refreshToken);
        return data.accessToken;
      } catch {
        clearToken();
        return null;
      } finally {
        refreshInFlight = null;
      }
    })();
  }

  return refreshInFlight;
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const buildHeaders = (token: string | null): Record<string, string> => {
    const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };

    if (!isFormData && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  };

  const doFetch = (token: string | null) =>
    fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: buildHeaders(token),
    });

  let response = await doFetch(getToken());

  // Attempt one token refresh + retry for protected endpoints.
  if (response.status === 401 && path !== '/api/auth/refresh') {
    const refreshedAccessToken = await refreshAccessToken();
    if (refreshedAccessToken) {
      response = await doFetch(refreshedAccessToken);
    }
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ error: 'Request failed' }));
    // In development the backend attaches `details` to 5xx responses — surface it
    // so the real error is visible in the browser console.
    const message = errorBody.error || `HTTP ${response.status}`;
    const detail  = errorBody.details ? ` | ${errorBody.details}` : '';
    throw new Error(`${message}${detail}`);
  }

  // 204 No Content
  if (response.status === 204) return undefined as T;

  return response.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  postForm: <T>(path: string, formData: FormData) =>
    request<T>(path, { method: 'POST', body: formData }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  patchForm: <T>(path: string, formData: FormData) =>
    request<T>(path, { method: 'PATCH', body: formData }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

// ─── Snake_case → camelCase mapper (for Supabase/backend responses) ──────────

function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, char) => char.toUpperCase());
}

export function camelize<T>(obj: unknown): T {
  if (Array.isArray(obj)) return obj.map(camelize) as T;
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [
        toCamelCase(k),
        camelize(v),
      ])
    ) as T;
  }
  return obj as T;
}

// ─── Snakify (camelCase → snake_case for request bodies) ─────────────────────

function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, char => `_${char.toLowerCase()}`);
}

export function snakify(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(snakify);
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [
        toSnakeCase(k),
        snakify(v),
      ])
    );
  }
  return obj;
}
