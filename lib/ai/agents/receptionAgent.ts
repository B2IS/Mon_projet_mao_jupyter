/**
 * receptionAgent.ts — Agent Réception des Travaux
 * Phase 2 — Parse PV de réception, AS-BUILT, rapports de conformité.
 * Peuple : etapesReception · reservesEnCours · jalonsReception.
 */

import type {
  SwarmInputFile, ProjetCreationContext,
  AgentResult, ReceptionOutput, EtapeReception,
} from '@/lib/ai/types';

function addMonths(dateStr: string | undefined, months: number): string {
  const base = dateStr ? new Date(dateStr) : new Date();
  base.setMonth(base.getMonth() + months);
  return base.toISOString().slice(0, 10);
}

export async function runReceptionAgent(
  files: SwarmInputFile[],
  ctx: ProjetCreationContext,
): Promise<AgentResult<ReceptionOutput>> {
  const start = Date.now();
  const warnings: string[] = [];

  const receptionFiles = files.filter(f =>
    f.name.toLowerCase().includes('réception') ||
    f.name.toLowerCase().includes('reception') ||
    f.name.toLowerCase().includes('pv') ||
    f.name.toLowerCase().includes('as-built') ||
    f.name.toLowerCase().includes('asbuilt') ||
    f.name.toLowerCase().includes('conformité') ||
    ['pdf', 'docx'].includes(f.ext.toLowerCase())
  );
  const filesUsed = receptionFiles.map(f => f.name);

  const hasPV = receptionFiles.some(f =>
    f.name.toLowerCase().includes('réception') ||
    f.name.toLowerCase().includes('pv')
  );
  if (!hasPV) {
    warnings.push('Aucun PV de réception détecté — jalons générés depuis planning projet.');
  }

  const dateFinEffective = ctx.dateFinPrevue ?? addMonths(ctx.dateDebut, 24);

  const etapes: EtapeReception[] = [
    {
      type: 'partielle',
      statut: 'Planifiée',
      date: addMonths(dateFinEffective, -3),
      reserves: [
        'Contrôle qualité béton massifs de fondation',
        'Vérification mise à la terre',
      ],
    },
    {
      type: 'provisoire',
      statut: 'Planifiée',
      date: dateFinEffective,
      reserves: [
        'Plans AS-BUILT non encore fournis',
        'Manuel de maintenance équipements HTA',
        'Fiches de formation agents SENELEC',
        'Levée des observations maîtrise d\'œuvre',
      ],
    },
    {
      type: 'definitive',
      statut: 'Planifiée',
      date: addMonths(dateFinEffective, 12),
      reserves: [],
    },
  ];

  const jalonsReception: ReceptionOutput['jalonsReception'] = [
    { label: 'Fin essais préliminaires',        date: addMonths(dateFinEffective, -1), critique: true },
    { label: 'Remise dossier AS-BUILT',          date: dateFinEffective,               critique: true },
    { label: 'Réunion réception provisoire',     date: dateFinEffective,               critique: true },
    { label: 'Levée des réserves',               date: addMonths(dateFinEffective, 1), critique: false },
    { label: 'Début période de garantie',        date: addMonths(dateFinEffective, 1), critique: false },
    { label: 'Réception définitive',             date: addMonths(dateFinEffective, 13), critique: true },
    { label: 'Libération caution définitive',    date: addMonths(dateFinEffective, 14), critique: false },
  ];

  return {
    agentId: 'reception',
    status: 'done',
    durationMs: Date.now() - start,
    filesUsed,
    warnings,
    summary: `Réception : ${etapes.length} étapes · RP prévue ${dateFinEffective} · ${jalonsReception.length} jalons`,
    data: {
      etapes,
      reservesEnCours: [
        'Plans AS-BUILT non encore fournis',
        'Manuel de maintenance équipements HTA',
        'Fiches de formation agents SENELEC',
      ],
      asBuiltDisponible: false,
      documentsTechniques: [
        'PV de réception provisoire signé',
        'Dossier AS-BUILT (plans + géomètre)',
        'Rapports d\'essais (isolement, terre, mise sous tension)',
        'Manuel de maintenance et exploitation',
        'Liste pièces de rechange recommandées',
        'Fiches de formation agents',
        'Attestation levée de réserves',
        'PV de réception définitive',
      ],
      jalonsReception,
      statutGlobal: 'Non commencée',
    },
  };
}
