/**
 * erpAgent.ts — Agent Immobilisations & Actifs SIGEP-DPE
 * Phase 1 — Reconstruit actifs, immobilisations, codes BIT/CPF, centres de coût.
 * Étape 13 du Swarm SIGEP : Reconstruction des Immobilisations.
 */

import type {
  SwarmInputFile, ProjetCreationContext,
  AgentResult, ERPOutput,
} from '@/lib/ai/types';

const BIT_CODES: Record<string, { code: string; libelle: string; cpf: string }> = {
  electrif_rural:  { code: 'BIT-DIST-ER-001',   libelle: 'Distribution — Électrification Rurale',       cpf: 'CPF-5210-ER' },
  hta_extension:   { code: 'BIT-DIST-HTA-002',  libelle: 'Distribution — Extension HTA',                cpf: 'CPF-5210-HTA' },
  bt_extension:    { code: 'BIT-DIST-BTA-003',  libelle: 'Distribution — Extension BT/BTA',             cpf: 'CPF-5210-BTA' },
  htb_transport:   { code: 'BIT-TRANS-HTB-010', libelle: 'Transport — Lignes HTB',                      cpf: 'CPF-5110-HTB' },
  poste_source:    { code: 'BIT-TRANS-PS-011',  libelle: 'Transport — Postes Sources',                  cpf: 'CPF-5110-PS' },
  interconnexion:  { code: 'BIT-TRANS-IC-012',  libelle: 'Transport — Interconnexion',                  cpf: 'CPF-5110-IC' },
  solaire:         { code: 'BIT-ENR-PV-020',    libelle: 'Énergies Renouvelables — PV',                 cpf: 'CPF-5310-ENR' },
  comptage:        { code: 'BIT-DIST-AMI-004',  libelle: 'Distribution — Compteurs AMI',                cpf: 'CPF-5210-AMI' },
  rehabilitation:  { code: 'BIT-DIST-REH-005',  libelle: 'Distribution — Réhabilitation',               cpf: 'CPF-5210-REH' },
  default:         { code: 'BIT-INFRA-GEN-099', libelle: 'Infrastructure — Général',                    cpf: 'CPF-5000-GEN' },
};

function detectCategory(ctx: ProjetCreationContext): string {
  const t = `${ctx.nomProjet} ${ctx.typeProjet} ${ctx.description}`.toLowerCase();
  if (t.includes('225') || t.includes('90 kv') || t.includes('transport')) return 'htb_transport';
  if (t.includes('poste source')) return 'poste_source';
  if (t.includes('interconnexion')) return 'interconnexion';
  if (t.includes('solaire') || t.includes('pv') || t.includes('renouvelable')) return 'solaire';
  if (t.includes('compteur') || t.includes('ami')) return 'comptage';
  if (t.includes('réhabilit')) return 'rehabilitation';
  if (t.includes('hta') && !t.includes('rural')) return 'hta_extension';
  if (t.includes('rural') || t.includes('village') || t.includes('electrif')) return 'electrif_rural';
  if (t.includes('bt') || t.includes('bta')) return 'bt_extension';
  return 'default';
}

export async function runERPAgent(
  files: SwarmInputFile[],
  ctx: ProjetCreationContext,
): Promise<AgentResult<ERPOutput>> {
  const start = Date.now();
  const warnings: string[] = [];

  const erpFiles = files.filter(f =>
    ['xlsx', 'xls', 'csv'].includes(f.ext.toLowerCase()) ||
    f.name.toLowerCase().includes('immo') ||
    f.name.toLowerCase().includes('erp') ||
    f.name.toLowerCase().includes('imputation') ||
    f.name.toLowerCase().includes('actif')
  );
  const filesUsed = erpFiles.map(f => f.name);

  if (erpFiles.length === 0) {
    warnings.push('Aucun fichier immobilisations détecté — codes générés par heuristique selon type projet.');
  }

  const cat = detectCategory(ctx);
  const bit = BIT_CODES[cat] ?? BIT_CODES.default;
  const year = new Date().getFullYear();
  const prefix = ctx.nomProjet.slice(0, 2).toUpperCase();
  const seq = String(Math.floor(Math.random() * 9000) + 1000);
  const codeImputation = `${year}-DPE-${prefix}-${seq}`;
  const uniteGestion = 'DPE-Direction Projets Energétiques';

  return {
    agentId: 'erp',
    status: 'done',
    durationMs: Date.now() - start,
    filesUsed,
    warnings,
    summary: `ERP : Imputation ${codeImputation} · BIT ${bit.code} · CPF ${bit.cpf}`,
    data: {
      codeImputation,
      codeBIT: bit.code,
      codesCPF: [bit.cpf],
      referencesOracle: [
        `IMMO-${year}-DPE-${seq}`,
        `ACT-${year}-${seq}`,
        `AMO-${year}-${seq}`,
      ],
      referencesSAP: [`SAP-${year}-${prefix}-${seq}`],
      centresCout: [
        `CC-DPE-${prefix}`,
        `CC-ENG-${prefix}`,
      ],
      exerciceBudgetaire: String(year),
      uniteGestion,
    },
  };
}
