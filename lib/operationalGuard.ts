/**
 * operationalGuard.ts — Verrou « lecture seule » opérationnel (défense en profondeur).
 * -----------------------------------------------------------------------------
 * RÈGLE MÉTIER : l'édition opérationnelle (planning, tâches, WBS, ressources,
 * baseline, terrain) s'arrête au niveau DÉPARTEMENT & CHEF DE CELLULE (niveau 2)
 * + l'équipe projet. Les niveaux 0 (DPE / PMO Central) et 1 (directeurs d'unité)
 * consultent en LECTURE SEULE.
 *
 * Plutôt que de garder chaque bouton (fragile, oubli possible), on neutralise les
 * ACTIONS MUTANTES directement à la frontière du store : un Proxy renvoie un no-op
 * (avec retour visuel toast) pour toute action de mutation quand l'utilisateur est
 * en lecture seule. Garantie : aucune écriture ne peut passer, quelle que soit l'UI.
 */
import toast from 'react-hot-toast';

/** Actions mutantes du projectStore (cf. lib/projectStore.tsx). Sur-lister est sûr. */
const MUTATING_ACTIONS = new Set<string>([
  'createProjet', 'updateProjet', 'deleteProjet',
  'createTache', 'updateTache', 'deleteTache', 'reorderTaches',
  'createRessource', 'updateRessource', 'deleteRessource',
  'assignRessource', 'updateAssignation', 'removeAssignation',
  'addJalon', 'updateJalon', 'removeJalon',
  'updatePhase', 'updateAvancement', 'saveBaseline',
]);

let lastToast = 0;
function readOnlyNotice() {
  const now = Date.now();
  if (now - lastToast > 1500) {            // anti-spam si plusieurs appels rapprochés
    lastToast = now;
    toast('🔒 Lecture seule — l’édition opérationnelle est réservée au niveau département / chef de cellule et à l’équipe projet.',
      { duration: 3500, icon: undefined });
  }
}

/**
 * Renvoie le store tel quel, ou une version « lecture seule » où toute action
 * mutante est neutralisée (no-op + toast). Usage :
 *   const store = readOnlyGuard(useProjectStore(), readOnly);
 */
export function readOnlyGuard<T extends object>(store: T, readOnly: boolean): T {
  if (!readOnly) return store;
  return new Proxy(store, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value === 'function' && MUTATING_ACTIONS.has(String(prop))) {
        return (..._args: unknown[]) => { readOnlyNotice(); };
      }
      return value;
    },
  });
}
