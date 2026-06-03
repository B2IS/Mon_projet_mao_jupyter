/**
 * index.ts — Point d'entrée des intégrations externes SIGEPP-DPE
 *
 * Systèmes connectés :
 *   • Oracle E-Business Suite R12 (Financials, Fixed Assets, GL)
 *   • ArcGIS Enterprise / Online (ESRI) — SIG patrimoine réseau
 *   • SAP (RFC/BAPI) — si déployé côté Senelec
 *   • SCADA / AMI — données temps réel (futur)
 */

export * from './types';
export * from './oracleEBS';
export * from './arcgis';
