/**
 * sigeppApi.ts — Client typé du backend SIGEPP-DPE Enterprise (NestJS).
 * -----------------------------------------------------------------------------
 * Pont Phase 8 : branche progressivement les écrans Next.js sur l'API org-scopée.
 * - Base URL via NEXT_PUBLIC_SIGEPP_API (def. http://localhost:4000/api).
 * - `apiEnabled()` = drapeau : tant qu'aucune base n'est configurée, les écrans
 *   gardent leurs données locales (aucune régression). On bascule écran par écran.
 * - L'identité (x-user-id) est injectée en dev ; en prod c'est le JWT Keycloak.
 *
 * La sécurité (visibilité par unité) est appliquée CÔTÉ SERVEUR (OrgScopeService +
 * RLS) : le client n'a aucune logique de filtrage — il reçoit déjà le périmètre.
 */

const BASE = process.env.NEXT_PUBLIC_SIGEPP_API ?? 'http://localhost:4000/api';

export function apiEnabled(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SIGEPP_API);
}

async function req<T>(path: string, opts: { method?: string; body?: unknown; userId?: string } = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: opts.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      // Dev : résolu par AbacGuard ; prod : remplacé par Authorization: Bearer <JWT Keycloak>.
      ...(opts.userId ? { 'x-user-id': opts.userId } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`SIGEPP API ${res.status} ${res.statusText} @ ${path}`);
  return res.json() as Promise<T>;
}

// ── Types miroir des objets backend (org-scopés) ──────────────────────────────
export interface ApiOrgUnit { id: string; code: string; label: string; type: string; path: string }
export interface ApiScope { userId: string; visiblePaths: string[]; units: ApiOrgUnit[] }
export interface ApiProjet {
  id: string; codeBit?: string; nom: string; domaine: string; orgPath: string;
  budgetMfcfa: number; avancement: number; cpi?: number; spi?: number; statut: string;
}
export interface ApiEVM { pv: number; ev: number; ac: number; bac: number; cpi: number; spi: number; eac: number; vac: number }
export interface ApiAttachement { id: string; numero: number; entreprise?: string; statut: string; montant: number; orgPath: string }

// ── Endpoints REST org-scopés ─────────────────────────────────────────────────
export const sigeppApi = {
  base: BASE,
  orgTree: (userId?: string) => req<ApiOrgUnit[]>('/org/tree', { userId }),
  myScope: (userId?: string) => req<ApiScope>('/org/me/scope', { userId }),
  projets: (userId?: string) => req<ApiProjet[]>('/projets', { userId }),
  planning: (projetId: string, userId?: string) => req<{ evm: ApiEVM }>(`/projets/${projetId}/planning`, { userId }),
  marches: (userId?: string) => req<unknown[]>('/marches', { userId }),
  attachements: (userId?: string) => req<ApiAttachement[]>('/attachements', { userId }),
  submitAttachement: (id: string, userId?: string) => req(`/attachements/${id}/submit`, { method: 'POST', userId }),
  validateAttachement: (id: string, ajustements?: { ligneId: string; qteValidee: number }[], userId?: string) =>
    req(`/attachements/${id}/validate`, { method: 'POST', body: { ajustements }, userId }),
  kpi: (userId?: string) => req<unknown[]>('/kpi', { userId }),
  finances: {
    cashflow: (userId?: string) =>
      req<{ dotation: number; engage: number; decaisse: number; tauxEngagement: number; tauxDecaissement: number }>(
        '/finances/cashflow', { userId },
      ),
  },
};

// ── GraphQL (BFF org-aware) ───────────────────────────────────────────────────
export async function sigeppGraphql<T>(query: string, variables?: Record<string, unknown>, userId?: string): Promise<T> {
  const res = await fetch(`${BASE.replace(/\/api$/, '')}/graphql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(userId ? { 'x-user-id': userId } : {}) },
    body: JSON.stringify({ query, variables }),
    cache: 'no-store',
  });
  const json = await res.json();
  if (json.errors) throw new Error(json.errors.map((e: { message: string }) => e.message).join('; '));
  return json.data as T;
}
