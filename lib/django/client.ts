/**
 * lib/django/client.ts
 * Client HTTP pour le backend Django (DRF) — SIGEPP-DPE
 * Gère : JWT (access + refresh), erreurs typées, pagination DRF.
 */

const DJANGO_BASE = process.env.NEXT_PUBLIC_DJANGO_API_URL ?? 'http://localhost:8000/api';

/** Réponse paginée standard DRF */
export interface PaginatedResponse<T> {
  count:    number;
  next:     string | null;
  previous: string | null;
  results:  T[];
}

/** Erreur HTTP typée */
export class DjangoApiError extends Error {
  constructor(public status: number, public detail: string) {
    super(`Django API ${status}: ${detail}`);
  }
}

/** Stockage du token (localStorage côté client, cookie httpOnly en prod) */
function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('sigepp_access');
}
function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('sigepp_refresh');
}
export function storeTokens(access: string, refresh: string) {
  localStorage.setItem('sigepp_access', access);
  localStorage.setItem('sigepp_refresh', refresh);
}
export function clearTokens() {
  localStorage.removeItem('sigepp_access');
  localStorage.removeItem('sigepp_refresh');
}

/** Refresh le access token via le refresh token */
async function refreshAccessToken(): Promise<string | null> {
  const refresh = getRefreshToken();
  if (!refresh) return null;
  const res = await fetch(`${DJANGO_BASE}/auth/token/refresh/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh }),
  });
  if (!res.ok) { clearTokens(); return null; }
  const data = await res.json();
  localStorage.setItem('sigepp_access', data.access);
  return data.access;
}

/** Fetch authentifié avec retry automatique après refresh */
export async function djangoFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let token = getAccessToken();

  const makeReq = (t: string | null) =>
    fetch(`${DJANGO_BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(t ? { Authorization: `Bearer ${t}` } : {}),
        ...options.headers,
      },
    });

  let res = await makeReq(token);

  // Token expiré → on rafraîchit et on réessaie une fois
  if (res.status === 401) {
    token = await refreshAccessToken();
    if (!token) throw new DjangoApiError(401, 'Session expirée — reconnectez-vous');
    res = await makeReq(token);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new DjangoApiError(res.status, body.detail ?? res.statusText);
  }

  return res.json() as Promise<T>;
}

/** Login — retourne les tokens JWT */
export async function djangoLogin(email: string, password: string) {
  const res = await fetch(`${DJANGO_BASE}/auth/login/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new DjangoApiError(res.status, body.detail ?? 'Identifiants incorrects');
  }
  const data = await res.json();
  storeTokens(data.access, data.refresh);
  return data;
}
