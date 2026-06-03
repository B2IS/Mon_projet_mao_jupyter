/**
 * types.ts — Types communs pour les intégrations externes SIGEPP-DPE
 * Oracle EBS R12, ArcGIS Enterprise, SAP, SCADA, AMI, etc.
 */

// ════════════════════════════════════════════════════════════════════════════
// ORACLE E-BUSINESS SUITE (EBS) R12
// ════════════════════════════════════════════════════════════════════════════

export interface OracleConfig {
  host: string;
  port: number;
  sid?: string;
  serviceName?: string;
  username: string;
  password: string;       // via env / secrets manager
  poolMin?: number;
  poolMax?: number;
  connectTimeout?: number;
  ssl?: boolean;
}

/** Module Oracle Financials (GL, AP, AR, FA) */
export interface OracleFacture {
  invoiceId: string;
  invoiceNum: string;
  invoiceDate: string;     // ISO
  dueDate?: string;
  montantHT: number;
  montantTVA: number;
  montantTTC: number;
  devise: 'XOF' | 'EUR' | 'USD';
  statut: 'VALIDEE' | 'PAYEE' | 'EN_ATTENTE' | 'REJETEE';
  fournisseurId: string;
  fournisseurNom: string;
  projetId?: string;       // lien SIGEPP
  directionCode: string;
  ligneBudgetaire?: string;
  compteGeneral?: string;  // Compte Oracle GL
  poNumber?: string;       // Purchase Order
  description: string;
  periodeComptable: string; // YYYY-MM
}

export interface OraclePaiement {
  paymentId: string;
  invoiceId: string;
  paymentDate: string;
  montantPaye: number;
  devise: string;
  modePaiement: 'VIREMENT' | 'CHEQUE' | 'TRAITE' | 'ESPECES';
  banque: string;
  referenceBancaire: string;
  statut: 'EXECUTE' | 'EN_ATTENTE' | 'REJETE';
}

/** Fixed Assets (FA) — Immobilisations & Amortissement */
export interface OracleImmobilisation {
  assetId: string;
  assetNumber: string;
  description: string;
  categorie: string;       // ex: "RESEAU HTA", "POSTE TRANSFO", "BATIMENT"
  dateAcquisition: string;
  dateMiseEnService: string;
  coutAcquisition: number;
  devise: string;
  tauxAmortissement: number; // % annuel
  dureeVieUtile: number;    // années
  methodeAmortissement: 'LINEAIRE' | 'DEGRESSIF' | 'UNITS_OF_PRODUCTION';
  valeurResiduelle: number;
  montantAmortiCumule: number;
  valeurNetteComptable: number; // VNC = cout - cumul
  projetOrigineId?: string;    // lien projet SIGEPP
  localisationGeo?: { lat: number; lng: number };
  directionAffectataire: string;
  compteAmortissement: string;
  compteDotation: string;
  statut: 'ACTIF' | 'EN_COURS' | 'CESSION' | 'REBUT';
  dateDerniereRevision?: string;
}

export interface OracleAmortissementPeriode {
  assetId: string;
  periode: string;         // YYYY-MM
  dotationPeriode: number;
  cumulAmortissement: number;
  vncPeriode: number;
}

/** General Ledger — Écritures comptables */
export interface OracleEcritureGL {
  jeBatchId: string;
  journalName: string;
  periode: string;
  dateComptable: string;
  ligneNum: number;
  compte: string;          // Segment compte Oracle
  debit: number;
  credit: number;
  description: string;
  projetId?: string;
  directionCode: string;
  source: 'FA' | 'AP' | 'AR' | 'GL' | 'PA' | 'PAYROLL';
}

// ════════════════════════════════════════════════════════════════════════════
// ARCGIS ENTERPRISE / ONLINE — ESRI REST API
// ════════════════════════════════════════════════════════════════════════════

export interface ArcGISConfig {
  portalUrl: string;       // ex: https://senelec.maps.arcgis.com
  username: string;
  password: string;
  clientId?: string;
  clientSecret?: string;
  token?: string;
  tokenExpiry?: number;
  featureServerUrl?: string;
  geometryServerUrl?: string;
}

export interface ArcGISFeatureLayer {
  id: number;
  name: string;
  url: string;
  geometryType: 'esriGeometryPoint' | 'esriGeometryPolyline' | 'esriGeometryPolygon';
  spatialReference: { wkid: number; latestWkid?: number };
  fields: ArcGISField[];
  extent: ArcGISExtent;
}

export interface ArcGISField {
  name: string;
  alias: string;
  type: 'esriFieldTypeString' | 'esriFieldTypeInteger' | 'esriFieldTypeDouble' | 'esriFieldTypeDate' | 'esriFieldTypeOID' | 'esriFieldTypeGeometry';
  length?: number;
  nullable?: boolean;
  domain?: any;
}

export interface ArcGISExtent {
  xmin: number; ymin: number;
  xmax: number; ymax: number;
  spatialReference: { wkid: number };
}

/** Feature pour réseau électrique */
export interface ArcGISReseauFeature {
  objectId: number;
  geometry: ArcGISGeometry;
  attributes: {
    id_patrimoine: string;
    type_ouvrage: 'LIGNE_THT' | 'LIGNE_HTA' | 'LIGNE_BT' | 'POSTE_SOURCE' | 'POSTE_HT' | 'POSTE_BT' | 'TRANSFO';
    tension: string;
    longueur_km?: number;
    localite: string;
    region: string;
    date_construction: string;
    etat: 'EXPLOITATION' | 'CONSTRUCTION' | 'PROJET' | 'HORS_SERVICE';
    projet_origine_id?: string;
    immobilisation_id?: string;
    direction: string;
    departement: string;
    gestionnaire: string;
    dernier_controle: string;
    observations?: string;
  };
}

export interface ArcGISGeometry {
  type: 'point' | 'polyline' | 'polygon';
  coordinates?: number[] | number[][] | number[][][];
  paths?: number[][][];    // polyline
  rings?: number[][][];   // polygon
  x?: number; y?: number;  // point
  spatialReference?: { wkid: number };
}

export interface ArcGISQueryParams {
  where?: string;
  geometry?: ArcGISGeometry;
  geometryType?: string;
  spatialRel?: string;
  outFields?: string[];
  returnGeometry?: boolean;
  outSR?: number;
  f?: 'json' | 'geojson' | 'html';
  resultRecordCount?: number;
  orderByFields?: string[];
}

/** Symbologie & rendu carte */
export interface ArcGISRenderer {
  type: 'simple' | 'uniqueValue' | 'classBreaks';
  symbol?: ArcGISSymbol;
  field?: string;
  uniqueValueInfos?: { value: string; symbol: ArcGISSymbol; label: string }[];
}

export interface ArcGISSymbol {
  type: 'esriSMS' | 'esriSLS' | 'esriSFS' | 'esriPMS';
  color?: number[];        // [R,G,B,A]
  width?: number;
  size?: number;
  style?: string;
}

// ════════════════════════════════════════════════════════════════════════════
// SCADA / AMI / SMART GRID
// ════════════════════════════════════════════════════════════════════════════

export interface ScadaConfig {
  host: string;
  port: number;
  protocol: 'IEC61850' | 'DNP3' | 'MODBUS_TCP' | 'OPC_UA';
  username?: string;
  password?: string;
  pollingIntervalSec: number;
}

export interface ScadaMesure {
  pointId: string;
  timestamp: string;
  valeur: number;
  unite: string;
  qualite: 'BONNE' | 'INCERTAINE' | 'MAUVAISE';
  posteSource?: string;
  ligneId?: string;
}

export interface AMIMeterReading {
  meterId: string;
  clientId: string;
  timestamp: string;
  kWhDelivre: number;
  kWhRecu?: number;
  kVARh?: number;
  puissanceApparente?: number;
  etatCompteur: 'ACTIF' | 'COUPE' | 'ERREUR' | 'MAINTENANCE';
  derniereComm: string;
  indexCumule: number;
}

// ════════════════════════════════════════════════════════════════════════════
// SAP / AUTRES ERP
// ════════════════════════════════════════════════════════════════════════════

export interface SAPConfig {
  host: string;
  port: number;
  client: string;
  username: string;
  password: string;
  lang: string;
  useRFC?: boolean;
}

// ════════════════════════════════════════════════════════════════════════════
// RÉSULTAT D'APPEL API GÉNÉRIQUE
// ════════════════════════════════════════════════════════════════════════════

export interface ApiResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  httpStatus?: number;
  timestamp: string;
  durationMs: number;
  source: string;          // nom du système externe
}

export interface SyncLog {
  id: string;
  systemeSource: 'SIGEPP' | 'ORACLE_R12' | 'ARCGIS' | 'SCADA' | 'SAP' | 'AMI';
  systemeCible: 'SIGEPP' | 'ORACLE_R12' | 'ARCGIS';
  typeOperation: 'PULL' | 'PUSH' | 'BIDIRECTIONAL';
  entite: string;          // ex: "FACTURES", "IMMOBILISATIONS", "RESEAU_HTA"
  statut: 'SUCCES' | 'ECHEC_PARTIEL' | 'ECHEC_TOTAL';
  recordsTotal: number;
  recordsSuccess: number;
  recordsFailed: number;
  dateDebut: string;
  dateFin: string;
  messageErreur?: string;
  declencheur: string;     // utilisateur ou batch
}
