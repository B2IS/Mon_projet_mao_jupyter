/**
 * authSecret.ts — Résolution centralisée et sécurisée du secret de signature JWT.
 * -----------------------------------------------------------------------------
 * FAILLE CORRIGÉE : auparavant le secret JWT avait une valeur par défaut codée
 * en dur ET publiée dans le dépôt. N'importe qui pouvait donc forger un jeton
 * `role: 'ADMIN'` et obtenir un accès total (« clé exposée = porte grande
 * ouverte »).
 *
 * Règle :
 *   - PRODUCTION : `SIGEPP_JWT_SECRET` est OBLIGATOIRE. Sans secret, la
 *     résolution échoue (fail-closed) → aucune session n'est signée/vérifiée.
 *   - DÉVELOPPEMENT : un secret de repli local est toléré (jamais utilisable en
 *     production) pour faciliter le hot-reload.
 *
 * La résolution est paresseuse (au moment de l'appel) et non au chargement du
 * module, afin de ne pas faire échouer le build/prerender Next.js.
 */

const DEV_ONLY_FALLBACK = 'sigepp-dpe-dev-only-secret-do-not-use-in-production';

export const JWT_ISSUER = 'sigepp-dpe';
export const JWT_AUDIENCE = 'sigepp-dpe-client';

function resolveSecret(): string {
  const fromEnv = process.env.SIGEPP_JWT_SECRET;
  if (fromEnv && fromEnv.trim().length > 0) return fromEnv;

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'SIGEPP_JWT_SECRET manquant : définissez un secret JWT fort (≥ 32 octets) ' +
      'dans les variables d\'environnement de production.',
    );
  }
  return DEV_ONLY_FALLBACK;
}

let cachedKey: Uint8Array | null = null;
let cachedSecret: string | null = null;

/** Clé secrète encodée pour jose (memoïsée tant que le secret ne change pas). */
export function getJwtSecretKey(): Uint8Array {
  const secret = resolveSecret();
  if (cachedKey && cachedSecret === secret) return cachedKey;
  cachedSecret = secret;
  cachedKey = new TextEncoder().encode(secret);
  return cachedKey;
}
