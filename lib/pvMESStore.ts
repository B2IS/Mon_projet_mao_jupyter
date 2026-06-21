/**
 * pvMESStore — store partagé Réceptions ↔ Structuration
 *
 * Source de vérité unique pour les PV Définitifs validés et leur date de
 * mise en service (dateMES). Réceptions écrit le statut/valeur ; Structuration
 * lit et permet de saisir/modifier la dateMES.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type StatutPVMES = 'valide' | 'en_cours' | 'rejete';

export interface PVMESRecord {
  id: string;
  ref: string;                  // ex. PVD-DER-2026-002
  projet: string;
  localite: string;
  entreprise: string;
  dateReception: string;        // date du PV de réception définitif
  dateMES: string;              // date de mise en service (saisie post-réception)
  valeurMES: number;            // FCFA
  categorie: string;
  statut: StatutPVMES;
  linked: boolean;              // lié à une fiche d'immobilisation
}

interface PVMESState {
  records: PVMESRecord[];
  setDateMES:    (id: string, dateMES: string)     => void;
  setValeurMES:  (id: string, valeurMES: number)   => void;
  setCategorie:  (id: string, categorie: string)   => void;
  setLinked:     (id: string, linked: boolean)     => void;
  setStatut:     (id: string, statut: StatutPVMES) => void;
  upsert:        (record: PVMESRecord)             => void;
}

const DEMO_RECORDS: PVMESRecord[] = [
  {
    id: 'pv1',
    ref: 'PVD-DER-2026-002',
    projet: 'Électrification Rurale 19 Localités — Thiès',
    localite: 'Thiès - 19 localités',
    entreprise: 'ELEC AFRIQUE SARL',
    dateReception: '2026-04-15',
    dateMES: '2026-05-01',
    valeurMES: 485_000_000,
    categorie: 'Réseau HTA/BT',
    statut: 'valide',
    linked: false,
  },
  {
    id: 'pv2',
    ref: 'PVD-CPBM-2026-001',
    projet: 'PASE — Accès électricité zones péri-urbaines',
    localite: 'Guédiawaye',
    entreprise: 'TRACTEBEL ENGIE',
    dateReception: '2026-03-22',
    dateMES: '2026-04-10',
    valeurMES: 620_000_000,
    categorie: 'Réseau BT péri-urbain',
    statut: 'valide',
    linked: true,
  },
  {
    id: 'pv3',
    ref: 'PVD-DEP-2026-003',
    projet: 'Réhabilitation Centrale Cap des Biches',
    localite: 'Dakar — Cap des Biches',
    entreprise: 'GE POWER AFRICA',
    dateReception: '2026-02-10',
    dateMES: '2026-03-01',
    valeurMES: 715_000_000,
    categorie: 'Production électrique',
    statut: 'valide',
    linked: true,
  },
  {
    id: 'pv4',
    ref: 'PVD-DIT-2026-004',
    projet: 'Déploiement compteurs AMI',
    localite: 'Dakar — Lot 1',
    entreprise: 'LANDIS+GYR',
    dateReception: '2026-05-18',
    dateMES: '',
    valeurMES: 245_000_000,
    categorie: 'Comptage / AMI',
    statut: 'en_cours',
    linked: false,
  },
  {
    id: 'pv5',
    ref: 'PVD-CPADERAU-2026-005',
    projet: 'PADERAU — Réseau HTA/BT zones rurales',
    localite: 'Saint-Louis',
    entreprise: 'EFACEC',
    dateReception: '2026-06-01',
    dateMES: '',
    valeurMES: 380_000_000,
    categorie: 'Réseau HTA/BT',
    statut: 'valide',
    linked: false,
  },
];

export const usePVMESStore = create<PVMESState>()(
  persist(
    (set) => ({
      records: DEMO_RECORDS,

      setDateMES:   (id, dateMES)   => set(s => ({ records: s.records.map(r => r.id === id ? { ...r, dateMES }   : r) })),
      setValeurMES: (id, valeurMES) => set(s => ({ records: s.records.map(r => r.id === id ? { ...r, valeurMES } : r) })),
      setCategorie: (id, categorie) => set(s => ({ records: s.records.map(r => r.id === id ? { ...r, categorie } : r) })),
      setLinked:    (id, linked)    => set(s => ({ records: s.records.map(r => r.id === id ? { ...r, linked }    : r) })),
      setStatut:    (id, statut)    => set(s => ({ records: s.records.map(r => r.id === id ? { ...r, statut }    : r) })),
      upsert: (record) => set(s => {
        const exists = s.records.some(r => r.id === record.id);
        return {
          records: exists
            ? s.records.map(r => r.id === record.id ? record : r)
            : [...s.records, record],
        };
      }),
    }),
    { name: 'sigep-pv-mes' }
  )
);
