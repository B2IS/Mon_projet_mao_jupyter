/**
 * store.ts — État Immobilisations (actifs assemblés + PV de réception).
 * Persisté localStorage. Source unique pour les écrans Référentiel / Actifs /
 * Réceptions / Amortissements.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { assembler, type ActifStructure, type Localisation } from './assembleur';
import type { PVReception, MethodeAmort } from './amortissement';
import { getFamille } from './referentiel';

interface ImmoModuleState {
  actifs: ActifStructure[];
  pvs: PVReception[];

  assemblerActif: (p: { familleCode: string; numero: number; designation: string; localisation?: Localisation; valeurBordereau?: number; sourceBordereau?: string }) => ActifStructure | null;
  supprimerActif: (id: string) => void;

  creerPV: (p: Omit<PVReception, 'id'>) => PVReception;
  supprimerPV: (id: string) => void;
  pvDeActif: (actifId: string) => PVReception | undefined;

  seed: () => void;
}

let _seq = 0;
const uid = (p: string) => `${p}-${Date.now().toString(36)}-${(_seq++).toString(36)}`;

export const useImmoModule = create<ImmoModuleState>()(
  persist(
    (set, get) => ({
      actifs: [],
      pvs: [],

      assemblerActif: (p) => {
        const actif = assembler(p);
        if (actif) set(s => ({ actifs: [...s.actifs, actif] }));
        return actif;
      },
      supprimerActif: (id) => set(s => ({
        actifs: s.actifs.filter(a => a.id !== id),
        pvs: s.pvs.filter(v => v.actifId !== id),
      })),

      creerPV: (p) => {
        const pv: PVReception = { ...p, id: uid('pv') };
        set(s => ({ pvs: [...s.pvs.filter(v => v.actifId !== p.actifId), pv] }));
        return pv;
      },
      supprimerPV: (id) => set(s => ({ pvs: s.pvs.filter(v => v.id !== id) })),
      pvDeActif: (actifId) => get().pvs.find(v => v.actifId === actifId),

      seed: () => {
        if (get().actifs.length) return;
        const demo: { f: string; n: number; lib: string; loc: Localisation }[] = [
          { f: 'REEQ.COUP', n: 2, lib: 'REEQUIPEMENT ELECTRIQUE POSTES HTA/BT EN GIS COUPURE CHERIF LO', loc: { region: 'SAINT LOUIS', departement: 'TIVAOUANE', feeder: 'FEEDER SAINT LOUIS', poste: 'POSTE HTB/HTA THIONA 90 KV' } },
          { f: 'REEQ.COUP', n: 3, lib: 'REEQUIPEMENT ELECTRIQUE POSTES HTA/BT EN GIS COUPURE PAM ECOLE 15', loc: { region: 'SAINT LOUIS', departement: 'TIVAOUANE', feeder: 'FEEDER SAINT LOUIS' } },
          { f: 'REEQ.TE', n: 1, lib: 'REEQUIPEMENT ELECTRIQUE POSTES HTA/BT EN GIS TE PM Baobab', loc: { region: 'M’BOUR', departement: 'M’BOUR', feeder: 'FEEDER POPENGUINE' } },
          { f: 'PREFA.COUP', n: 1, lib: 'POSTE PREFABRIQUE EN COUPURE 30 KV RTS GANDON', loc: { region: 'SAINT LOUIS', departement: 'SAINT LOUIS', feeder: 'FEEDER SAINT LOUIS 1' } },
        ];
        const actifs: ActifStructure[] = [];
        for (const d of demo) {
          const a = assembler({ familleCode: d.f, numero: d.n, designation: d.lib, localisation: d.loc });
          if (a) actifs.push(a);
        }
        // PV de réception provisoire pour le 1er actif (reproduit le bordereau : 06/12/2019).
        const pvs: PVReception[] = actifs.length ? [{
          id: uid('pv'), numero: 'PV-2019-0142', actifId: actifs[0].id,
          dateReceptionProvisoire: '2019-12-06',
          dureeAmort: getFamille(actifs[0].familleCode)?.dureeAmort ?? 20,
          methode: 'lineaire' as MethodeAmort, valeurResiduelle: 0,
          signePar: 'Commission de réception DPE', dateSignature: '2019-12-06',
          observations: 'Réception provisoire — mise en service effective.',
        }] : [];
        set({ actifs, pvs });
      },
    }),
    { name: 'sigepp-immo-module' }
  )
);
