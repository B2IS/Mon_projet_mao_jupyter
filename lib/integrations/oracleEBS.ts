/**
 * oracleEBS.ts — Connecteur Oracle E-Business Suite R12
 * Modules : Financials (GL, AP, AR), Fixed Assets (FA), Projects (PA)
 *
 * APIs utilisées :
 *   • Oracle REST Data Services (ORDS) — REST/SQL
 *   • Oracle BI Publisher Web Services — rapports
 *   • PL/SQL Callable via ORDS — procédures métier DPE/Senelec
 *   • Oracle E-Business Suite Integrated SOA Gateway (ISG) — SOAP
 *
 * Flux DPE ⇄ Oracle :
 *   PULL : Factures fournisseurs, paiements, écritures GL, état immobilisations
 *   PUSH : Immobilisations nouvelles (projets DPE → Oracle FA), affectations projets
 */

import type {
  OracleConfig,
  OracleFacture,
  OraclePaiement,
  OracleImmobilisation,
  OracleAmortissementPeriode,
  OracleEcritureGL,
  ApiResult,
  SyncLog,
} from './types';

// ─── Configuration par défaut (surchargeable via env) ──────────────────────
const DEFAULT_ORACLE_CONFIG: OracleConfig = {
  host: process.env.ORACLE_HOST || 'oracle-ebs.senelec.local',
  port: parseInt(process.env.ORACLE_PORT || '1521', 10),
  serviceName: process.env.ORACLE_SERVICE || 'EBSR12.senelec.sn',
  username: process.env.ORACLE_USER || 'APPS',
  password: process.env.ORACLE_PASS || '',
  poolMin: 2,
  poolMax: 10,
  connectTimeout: 30000,
  ssl: true,
};

// ════════════════════════════════════════════════════════════════════════════
// AUTH & UTILITAIRES
// ════════════════════════════════════════════════════════════════════════════

function getOrdsBaseUrl(cfg: Partial<OracleConfig> = {}): string {
  const c = { ...DEFAULT_ORACLE_CONFIG, ...cfg };
  return `https://${c.host}:${c.port}/ords/${c.username}`;
}

function basicAuth(cfg: Partial<OracleConfig> = {}): string {
  const c = { ...DEFAULT_ORACLE_CONFIG, ...cfg };
  return 'Basic ' + Buffer.from(`${c.username}:${c.password}`).toString('base64');
}

async function ordsFetch<T>(
  endpoint: string,
  options: RequestInit = {},
  cfg: Partial<OracleConfig> = {}
): Promise<ApiResult<T>> {
  const start = Date.now();
  const url = `${getOrdsBaseUrl(cfg)}${endpoint}`;
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: basicAuth(cfg),
        ...(options.headers || {}),
      },
    });
    if (!res.ok) {
      const text = await res.text();
      return {
        success: false,
        error: `Oracle EBS HTTP ${res.status}: ${text}`,
        httpStatus: res.status,
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - start,
        source: 'ORACLE_R12',
      };
    }
    const data = await res.json();
    return {
      success: true,
      data,
      httpStatus: res.status,
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - start,
      source: 'ORACLE_R12',
    };
  } catch (e: any) {
    return {
      success: false,
      error: e.message || 'Network error',
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - start,
      source: 'ORACLE_R12',
    };
  }
}

// ════════════════════════════════════════════════════════════════════════════
// 1. ACCOUNTS PAYABLE (AP) — FACTURES FOURNISSEURS
// ════════════════════════════════════════════════════════════════════════════

/**
 * Récupère les factures d'un projet ou d'une direction sur une période.
 * Table Oracle : AP_INVOICES_ALL + AP_INVOICE_LINES_ALL
 */
export async function getFacturesProjet(
  projetId: string,
  periodeDebut: string, // YYYY-MM-DD
  periodeFin: string,
  cfg?: Partial<OracleConfig>
): Promise<ApiResult<OracleFacture[]>> {
  // Appel ORDS vers vue SQL custom : v_dpe_ap_invoices
  const res = await ordsFetch<{
    items: OracleFacture[];
    hasMore: boolean;
    limit: number;
    offset: number;
    count: number;
  }>(
    `/sql/v_dpe_ap_invoices?projet_id=${encodeURIComponent(projetId)}` +
      `&date_debut=${periodeDebut}&date_fin=${periodeFin}`,
    { method: 'GET' },
    cfg
  );
  if (!res.success) return { ...res, data: undefined };
  return { ...res, data: res.data!.items };
}

/**
 * Récupère les factures par direction pour le reporting DPE.
 */
export async function getFacturesDirection(
  directionCode: string,
  periodeComptable: string, // YYYY-MM
  cfg?: Partial<OracleConfig>
): Promise<ApiResult<OracleFacture[]>> {
  const res = await ordsFetch<{
    items: OracleFacture[];
  }>(
    `/sql/v_dpe_ap_invoices?direction=${directionCode}&periode=${periodeComptable}`,
    { method: 'GET' },
    cfg
  );
  if (!res.success) return { ...res, data: undefined };
  return { ...res, data: res.data!.items };
}

/**
 * Récupère les paiements associés à une facture.
 * Table Oracle : AP_CHECKS_ALL / AP_PAYMENT_HISTORY_ALL
 */
export async function getPaiementsFacture(
  invoiceId: string,
  cfg?: Partial<OracleConfig>
): Promise<ApiResult<OraclePaiement[]>> {
  const res = await ordsFetch<{ items: OraclePaiement[] }>(
    `/sql/v_dpe_ap_payments?invoice_id=${invoiceId}`,
    { method: 'GET' },
    cfg
  );
  if (!res.success) return { ...res, data: undefined };
  return { ...res, data: res.data!.items };
}

// ════════════════════════════════════════════════════════════════════════════
// 2. FIXED ASSETS (FA) — IMMOBILISATIONS & AMORTISSEMENT
// ════════════════════════════════════════════════════════════════════════════

/**
 * Récupère l'état des immobilisations d'une direction ou d'un projet.
 * Tables Oracle : FA_ADDITIONS_B + FA_BOOKS + FA_CATEGORIES_B
 */
export async function getImmobilisations(
  filters: {
    directionCode?: string;
    projetId?: string;
    categorie?: string;
    statut?: 'ACTIF' | 'EN_COURS' | 'CESSION' | 'REBUT';
  },
  cfg?: Partial<OracleConfig>
): Promise<ApiResult<OracleImmobilisation[]>> {
  const params = new URLSearchParams();
  if (filters.directionCode) params.append('direction', filters.directionCode);
  if (filters.projetId) params.append('projet_id', filters.projetId);
  if (filters.categorie) params.append('categorie', filters.categorie);
  if (filters.statut) params.append('statut', filters.statut);

  const res = await ordsFetch<{ items: OracleImmobilisation[] }>(
    `/sql/v_dpe_fa_assets?${params.toString()}`,
    { method: 'GET' },
    cfg
  );
  if (!res.success) return { ...res, data: undefined };
  return { ...res, data: res.data!.items };
}

/**
 * Récupère le détail d'une immobilisation par asset_id.
 */
export async function getImmobilisationDetail(
  assetId: string,
  cfg?: Partial<OracleConfig>
): Promise<ApiResult<OracleImmobilisation>> {
  const res = await ordsFetch<OracleImmobilisation>(
    `/sql/v_dpe_fa_assets/${assetId}`,
    { method: 'GET' },
    cfg
  );
  return res;
}

/**
 * Récupère les dotations d'amortissement par période.
 * Table Oracle : FA_DEPRN_DETAIL
 */
export async function getAmortissements(
  assetId: string,
  periodeDebut?: string,
  periodeFin?: string,
  cfg?: Partial<OracleConfig>
): Promise<ApiResult<OracleAmortissementPeriode[]>> {
  const params = new URLSearchParams({ asset_id: assetId });
  if (periodeDebut) params.append('periode_debut', periodeDebut);
  if (periodeFin) params.append('periode_fin', periodeFin);

  const res = await ordsFetch<{ items: OracleAmortissementPeriode[] }>(
    `/sql/v_dpe_fa_depreciation?${params.toString()}`,
    { method: 'GET' },
    cfg
  );
  if (!res.success) return { ...res, data: undefined };
  return { ...res, data: res.data!.items };
}

/**
 * Crée une nouvelle immobilisation dans Oracle FA à partir d'un projet DPE
 * (appelé après réception définitive d'un ouvrage).
 *
 * Procédure PL/SQL encapsulée via ORDS :
 *   BEGIN dpe_fa_pkg.create_asset_from_project(...); END;
 */
export async function creerImmobilisationOracle(
  payload: {
    projetId: string;
    description: string;
    categorie: string;
    coutAcquisition: number;
    devise: string;
    dateMiseEnService: string;
    dureeVie: number;
    methodeAmort: 'LINEAIRE' | 'DEGRESSIF';
    directionCode: string;
    compteAmort: string;
    compteDotation: string;
    localisationGeo?: { lat: number; lng: number };
  },
  cfg?: Partial<OracleConfig>
): Promise<ApiResult<{ assetId: string; assetNumber: string }>> {
  const res = await ordsFetch<{ assetId: string; assetNumber: string }>(
    `/rpc/dpe_fa_pkg/create_asset_from_project`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    cfg
  );
  return res;
}

// ════════════════════════════════════════════════════════════════════════════
// 3. GENERAL LEDGER (GL) — ÉCRITURES COMPTABLES
// ════════════════════════════════════════════════════════════════════════════

/**
 * Récupère les écritures GL d'un projet ou d'une direction sur une période.
 * Tables Oracle : GL_JE_BATCHES + GL_JE_HEADERS + GL_JE_LINES
 */
export async function getEcrituresGL(
  filters: {
    periode: string; // YYYY-MM
    projetId?: string;
    directionCode?: string;
    compte?: string;
    source?: string;
  },
  cfg?: Partial<OracleConfig>
): Promise<ApiResult<OracleEcritureGL[]>> {
  const params = new URLSearchParams({ periode: filters.periode });
  if (filters.projetId) params.append('projet_id', filters.projetId);
  if (filters.directionCode) params.append('direction', filters.directionCode);
  if (filters.compte) params.append('compte', filters.compte);
  if (filters.source) params.append('source', filters.source);

  const res = await ordsFetch<{ items: OracleEcritureGL[] }>(
    `/sql/v_dpe_gl_journals?${params.toString()}`,
    { method: 'GET' },
    cfg
  );
  if (!res.success) return { ...res, data: undefined };
  return { ...res, data: res.data!.items };
}

// ════════════════════════════════════════════════════════════════════════════
// 4. SYNCHRONISATION BATCH & LOGS
// ════════════════════════════════════════════════════════════════════════════

/**
 * Lance un batch de synchronisation complet DPE → Oracle FA
 * pour les immobilisations en attente d'enregistrement comptable.
 */
export async function syncImmobilisationsDPEVersOracle(
  projetIds?: string[],
  cfg?: Partial<OracleConfig>
): Promise<ApiResult<SyncLog>> {
  const start = Date.now();
  const res = await ordsFetch<{ syncId: string; processed: number; errors: string[] }>(
    `/rpc/dpe_sync_pkg/sync_assets_to_fa`,
    {
      method: 'POST',
      body: JSON.stringify({ projet_ids: projetIds || [] }),
    },
    cfg
  );
  if (!res.success) return { ...res, data: undefined };
  const log: SyncLog = {
    id: res.data!.syncId,
    systemeSource: 'SIGEPP',
    systemeCible: 'ORACLE_R12',
    typeOperation: 'PUSH',
    entite: 'IMMOBILISATIONS',
    statut: res.data!.errors.length === 0 ? 'SUCCES' : res.data!.errors.length < res.data!.processed ? 'ECHEC_PARTIEL' : 'ECHEC_TOTAL',
    recordsTotal: res.data!.processed + res.data!.errors.length,
    recordsSuccess: res.data!.processed,
    recordsFailed: res.data!.errors.length,
    dateDebut: new Date(start).toISOString(),
    dateFin: new Date().toISOString(),
    messageErreur: res.data!.errors.join('; ') || undefined,
    declencheur: 'SYSTEM',
  };
  return { ...res, data: log };
}

/**
 * Récupère les factures en attente de validation pour un reporting
 * mensuel du DPE (Bilan DPD, DPT, DGC, etc.).
 */
export async function getFacturesEnAttenteValidation(
  directionCode: string,
  cfg?: Partial<OracleConfig>
): Promise<ApiResult<OracleFacture[]>> {
  const res = await ordsFetch<{ items: OracleFacture[] }>(
    `/sql/v_dpe_ap_invoices?direction=${directionCode}&statut=EN_ATTENTE`,
    { method: 'GET' },
    cfg
  );
  if (!res.success) return { ...res, data: undefined };
  return { ...res, data: res.data!.items };
}

// ─── Export par défaut ─────────────────────────────────────────────────────
export { DEFAULT_ORACLE_CONFIG };
