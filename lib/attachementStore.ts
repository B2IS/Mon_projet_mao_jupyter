/**
 * attachementStore.ts — Attachements de paiement (BOQ quantités réalisées)
 * -----------------------------------------------------------------------------
 * L'ENTREPRISE soumet les quantités réalisées sur les articles du bordereau (BOQ).
 * Le CHEF DE PROJET valide (ou rejette) → l'attachement validé sert de base au
 * décompte / paiement. Montant = Σ (quantité réalisée × prix unitaire).
 * Persisté en localStorage, indexé par projet.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AttachementStatut = 'brouillon' | 'soumis' | 'valide' | 'rejete';

export interface LigneAttachement {
  id: string;
  designation: string;
  unite: string;
  prixUnitaire: number;     // FCFA — P.U. TOTAL (= Fourniture + Transport + Travaux si décomposé)
  // ── Décomposition du P.U. selon le modèle BOQ DPE (Bordereau des Quantités) ──
  puFourniture?: number;    // P.U. composante Fourniture
  puTransport?: number;     // P.U. composante Transport
  puTravaux?: number;       // P.U. composante Travaux
  lot?: string;             // lot/section BOQ (ex. EE, Appareillages, Téléconduite, Réseaux)
  qteContractuelle: number;
  qteRealisee: number;      // saisie par l'entreprise
  qteValidee?: number;      // ajustée/validée par le chef de projet
}

/** P.U. effectif d'une ligne : somme des composantes BOQ si décomposé, sinon prixUnitaire. */
export function puLigne(l: LigneAttachement): number {
  const dec = (l.puFourniture ?? 0) + (l.puTransport ?? 0) + (l.puTravaux ?? 0);
  return dec > 0 ? dec : l.prixUnitaire;
}

export interface Attachement {
  id: string;
  projetCode: string;
  numero: number;
  periode: string;
  entreprise: string;
  lignes: LigneAttachement[];
  statut: AttachementStatut;
  soumisPar?: string;
  validePar?: string;
  motifRejet?: string;
  dateSoumission?: string;
  historique: { etape: string; par: string; date: string }[];
}

/** Montant réalisé d'un attachement (quantités validées si présentes, sinon réalisées). */
export function montantAttachement(a: Attachement): number {
  return Math.round(a.lignes.reduce((s, l) => s + (l.qteValidee ?? l.qteRealisee) * puLigne(l), 0));
}

/** Récapitulatif BOQ par composante de coût (Fourniture / Transport / Travaux) sur le réalisé. */
export function recapComposantes(a: Attachement): { fourniture: number; transport: number; travaux: number; total: number } {
  const r = { fourniture: 0, transport: 0, travaux: 0, total: 0 };
  for (const l of a.lignes) {
    const q = l.qteValidee ?? l.qteRealisee;
    r.fourniture += q * (l.puFourniture ?? 0);
    r.transport  += q * (l.puTransport ?? 0);
    r.travaux    += q * (l.puTravaux ?? 0);
  }
  r.total = Math.round(r.fourniture + r.transport + r.travaux) || montantAttachement(a);
  r.fourniture = Math.round(r.fourniture); r.transport = Math.round(r.transport); r.travaux = Math.round(r.travaux);
  return r;
}

interface AttachementState {
  attachements: Attachement[];
  createAttachement: (a: Omit<Attachement, 'id' | 'statut' | 'historique'>) => string;
  updateAttachement: (id: string, patch: Partial<Attachement>) => void;
  updateLigne: (id: string, ligneId: string, patch: Partial<LigneAttachement>) => void;
  addLigne: (id: string, ligne: Omit<LigneAttachement, 'id'>) => void;
  removeLigne: (id: string, ligneId: string) => void;
  removeAttachement: (id: string) => void;
  soumettre: (id: string, par: string) => void;          // entreprise → chef de projet
  valider: (id: string, par: string) => void;            // chef de projet
  rejeter: (id: string, par: string, motif: string) => void;
}

const uid = (p: string) => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;

export const useAttachements = create<AttachementState>()(
  persist(
    (set) => ({
      attachements: [],
      createAttachement: (a) => {
        const id = uid('att');
        set(s => ({ attachements: [{ ...a, id, statut: 'brouillon', historique: [] }, ...s.attachements] }));
        return id;
      },
      updateAttachement: (id, patch) => set(s => ({ attachements: s.attachements.map(a => a.id === id ? { ...a, ...patch } : a) })),
      updateLigne: (id, lid, patch) => set(s => ({ attachements: s.attachements.map(a => a.id === id ? { ...a, lignes: a.lignes.map(l => l.id === lid ? { ...l, ...patch } : l) } : a) })),
      addLigne: (id, ligne) => set(s => ({ attachements: s.attachements.map(a => a.id === id ? { ...a, lignes: [...a.lignes, { ...ligne, id: uid('lg') }] } : a) })),
      removeLigne: (id, lid) => set(s => ({ attachements: s.attachements.map(a => a.id === id ? { ...a, lignes: a.lignes.filter(l => l.id !== lid) } : a) })),
      removeAttachement: (id) => set(s => ({ attachements: s.attachements.filter(a => a.id !== id) })),
      soumettre: (id, par) => set(s => ({ attachements: s.attachements.map(a => a.id === id ? { ...a, statut: 'soumis', soumisPar: par, dateSoumission: new Date().toISOString(), historique: [...a.historique, { etape: 'Soumis par l\'entreprise', par, date: new Date().toISOString() }] } : a) })),
      valider: (id, par) => set(s => ({ attachements: s.attachements.map(a => a.id === id ? { ...a, statut: 'valide', validePar: par, historique: [...a.historique, { etape: 'Validé (chef de projet)', par, date: new Date().toISOString() }] } : a) })),
      rejeter: (id, par, motif) => set(s => ({ attachements: s.attachements.map(a => a.id === id ? { ...a, statut: 'rejete', motifRejet: motif, historique: [...a.historique, { etape: 'Rejeté', par, date: new Date().toISOString() }] } : a) })),
    }),
    { name: 'sigepp-attachements' },
  ),
);
