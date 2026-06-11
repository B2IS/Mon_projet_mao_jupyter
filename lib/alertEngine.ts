/**
 * Moteur d'alertes — dérive des alertes VIVES depuis les données réelles des projets.
 *
 * Remplace les alertes statiques de démonstration (ALERTES_WORKFLOW) : chaque alerte
 * est recalculée à partir de l'état courant du portefeuille (tâches en retard, jalons
 * dépassés, dépassement budgétaire, CPI/SPI critiques, caution arrivant à échéance).
 *
 * Satisfait notamment :
 *  - PL-03 : alerte automatique quand une tâche est en retard,
 *  - GP-03 : statut/indicateurs à jour,
 *  - règles paramétrées dans alertConfigStore (jalon_retard, budget_depassement…).
 *
 * Les identifiants d'alerte sont STABLES (dérivés de projet.id + règle) afin que
 * l'utilisateur puisse les marquer « traitées » de façon persistante.
 */
import type { WorkflowAlerte } from './types';
import { calculerStatutGlobal, type Projet } from './projectStore';

export interface AlerteRulesConfig {
  /** jours avant expiration de caution déclenchant une alerte (défaut 90) */
  seuilCautionJours?: number;
  /** seuil CPI sous lequel on alerte d'un dépassement budgétaire (défaut 0.85) */
  seuilCpi?: number;
  /** seuil SPI sous lequel on alerte d'un retard planning (défaut 0.85) */
  seuilSpi?: number;
  /** avancement (%) à partir duquel on prépare la réception (défaut 95) */
  seuilReception?: number;
}

const DEFAULTS: Required<AlerteRulesConfig> = {
  seuilCautionJours: 90,
  seuilCpi: 0.85,
  seuilSpi: 0.85,
  seuilReception: 95,
};

const GRAVITE_RANK: Record<WorkflowAlerte['priorite'], number> = {
  critique: 0, haute: 1, normale: 2,
};

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

function fmtFR(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

/**
 * Calcule toutes les alertes vives du portefeuille, triées par gravité puis ancienneté.
 * @param projets liste des projets du référentiel
 * @param now date de référence (défaut : maintenant)
 * @param cfg seuils paramétrables
 */
export function computeLiveAlertes(
  projets: Projet[],
  now: Date = new Date(),
  cfg: AlerteRulesConfig = {},
): WorkflowAlerte[] {
  const c = { ...DEFAULTS, ...cfg };
  const out: WorkflowAlerte[] = [];

  for (const p of projets) {
    if (p.statut === 'termine' || p.statut === 'archive') continue;
    const code = p.code || p.id.toUpperCase();
    const resp = p.chefProjet ? `Chef de projet ${p.chefProjet}` : 'Équipe projet';

    // ── 1. Tâches en retard (PL-03) ──────────────────────────────────────────
    const tachesRetard = (p.taches ?? []).filter(t =>
      t.statutTache !== 'termine' &&
      (t.avancement ?? 0) < 100 &&
      t.dateFin && new Date(t.dateFin) < now,
    );
    if (tachesRetard.length > 0) {
      const plusEnRetard = tachesRetard.reduce((a, b) =>
        new Date(a.dateFin) < new Date(b.dateFin) ? a : b);
      const jours = daysBetween(new Date(plusEnRetard.dateFin), now);
      out.push({
        id: `live-${p.id}-taches`,
        type: 'retard',
        projetCode: code,
        message: `${tachesRetard.length} tâche${tachesRetard.length > 1 ? 's' : ''} en retard — « ${plusEnRetard.nom} » dépassée de ${jours} j`,
        date: fmtFR(now),
        statut: 'nouvelle',
        destinataire: resp,
        priorite: tachesRetard.length >= 3 || jours > 60 ? 'haute' : 'normale',
      });
    }

    // ── 2. Jalon dépassé (jalon_retard) ──────────────────────────────────────
    const jalonsRetard = (p.jalons ?? []).filter(j =>
      !j.atteint && j.date && new Date(j.date) < now);
    if (jalonsRetard.length > 0) {
      const j0 = jalonsRetard.reduce((a, b) => new Date(a.date) < new Date(b.date) ? a : b);
      const jours = daysBetween(new Date(j0.date), now);
      out.push({
        id: `live-${p.id}-jalon`,
        type: 'retard',
        projetCode: code,
        message: `Jalon « ${j0.label} » dépassé de ${jours} j (prévu ${fmtFR(new Date(j0.date))})`,
        date: fmtFR(now),
        statut: 'nouvelle',
        destinataire: resp,
        priorite: jours > 30 ? 'haute' : 'normale',
      });
    }

    // ── 3. Dépassement budgétaire / CPI critique (budget_depassement) ────────
    const surBudget = p.budgetDecaisse > p.budget;
    if (surBudget || p.cpi < c.seuilCpi) {
      const depPct = p.budget > 0 ? Math.round((p.budgetDecaisse / p.budget - 1) * 100) : 0;
      out.push({
        id: `live-${p.id}-budget`,
        type: 'budget',
        projetCode: code,
        message: surBudget
          ? `Dépassement budgétaire : décaissé ${p.budgetDecaisse.toLocaleString('fr-FR')} M / budget ${p.budget.toLocaleString('fr-FR')} M (+${depPct}%) · CPI ${p.cpi.toFixed(2)}`
          : `Performance coût dégradée — CPI ${p.cpi.toFixed(2)} (< ${c.seuilCpi})`,
        date: fmtFR(now),
        statut: 'nouvelle',
        destinataire: resp,
        priorite: p.cpi < 0.80 || depPct > 5 ? 'critique' : 'haute',
      });
    }

    // ── 4. Retard planning — SPI critique ────────────────────────────────────
    if (p.spi < c.seuilSpi && jalonsRetard.length === 0 && tachesRetard.length === 0) {
      out.push({
        id: `live-${p.id}-spi`,
        type: 'incident_grave',
        projetCode: code,
        message: `Retard planning — SPI ${p.spi.toFixed(2)} (< ${c.seuilSpi}) · avancement ${p.avancement}% vs ${p.avancementPlanifie}% planifié`,
        date: fmtFR(now),
        statut: 'nouvelle',
        destinataire: resp,
        priorite: p.spi < 0.75 ? 'critique' : 'haute',
      });
    }

    // ── 5. Caution arrivant à échéance ───────────────────────────────────────
    if (p.dateFinCaution) {
      const fin = new Date(p.dateFinCaution);
      const reste = daysBetween(now, fin);
      if (reste >= 0 && reste <= c.seuilCautionJours) {
        out.push({
          id: `live-${p.id}-caution`,
          type: 'echeance_courrier',
          projetCode: code,
          message: `Caution de garantie expire dans ${reste} j (${fmtFR(fin)}) — renouvellement à anticiper`,
          date: fmtFR(now),
          statut: 'nouvelle',
          destinataire: resp,
          priorite: reste <= 30 ? 'critique' : 'haute',
        });
      }
    }

    // ── 6. Réception à préparer ──────────────────────────────────────────────
    const receptionFaite = (p.jalons ?? []).some(j =>
      /réception|reception/i.test(j.label) && j.atteint);
    if (p.avancement >= c.seuilReception && !receptionFaite) {
      out.push({
        id: `live-${p.id}-reception`,
        type: 'reception',
        projetCode: code,
        message: `Avancement ${p.avancement}% — réception provisoire à programmer`,
        date: fmtFR(now),
        statut: 'nouvelle',
        destinataire: resp,
        priorite: 'normale',
      });
    }
  }

  // Tri : gravité décroissante, puis projets les plus avancés/critiques en tête.
  return out.sort((a, b) => GRAVITE_RANK[a.priorite] - GRAVITE_RANK[b.priorite]);
}

/** Statut global trafic d'un projet (réutilise la logique centrale). */
export function statutTraffic(p: Pick<Projet, 'cpi' | 'spi' | 'avancement' | 'avancementPlanifie' | 'statutGlobal'>) {
  return p.statutGlobal ?? calculerStatutGlobal({
    cpi: p.cpi, spi: p.spi,
    avancement: p.avancement, avancementPlanifie: p.avancementPlanifie,
  });
}
