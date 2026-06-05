/**
 * parapheurStore.ts — Dossiers de validation créés HORS du module Workflows
 * (ex. depuis un Courrier). Permet « ajouter un courrier en pièce jointe et
 * créer un workflow » : le dossier apparaît dans le parapheur (module Workflows).
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ParapheurPiece { nom: string; taille: string; ext: 'pdf' | 'docx' | 'xlsx' | 'png' | 'dwg'; url?: string }
export interface ParapheurHistorique { etape: string; acteur: string; date: string; commentaire?: string; decision?: 'approuve' | 'rejete' | 'delegue' }
/** Étape de circuit : destinataire + son rôle dans le traitement. */
export interface ParapheurEtape { ordre: number; role: string; acteurNom: string; acteurEmail: string; statut: 'en_attente' | 'fait' | 'rejete' }

export interface ParapheurDossier {
  id: string;
  type: string;          // 'courrier' | 'facture' | …
  reference: string;
  titre: string;
  projet: string;
  projetCode: string;
  soumetteur: string;
  dateCreation: string;
  dateLimite: string;
  priorite: 'urgent' | 'haute' | 'normale';
  statut: 'en_attente';
  etapeActuelle: string;
  nombreEtapes: number;
  etapeIndex: number;
  contexte: string;
  piecesJointes: ParapheurPiece[];
  historique: ParapheurHistorique[];
  slaHeures: number;
  heuresRestantes: number;
  source?: string;       // ex. « Courrier ENT-2026-0412 »
  etapes?: ParapheurEtape[];  // circuit : destinataires + rôles
}

interface ParapheurState {
  dossiers: ParapheurDossier[];
  addDossier: (d: ParapheurDossier) => void;
  removeDossier: (id: string) => void;
}

export const useParapheurStore = create<ParapheurState>()(
  persist(
    (set) => ({
      dossiers: [],
      addDossier: (d) => set(s => ({ dossiers: [d, ...s.dossiers.filter(x => x.id !== d.id)].slice(0, 200) })),
      removeDossier: (id) => set(s => ({ dossiers: s.dossiers.filter(x => x.id !== id) })),
    }),
    { name: 'sigepp-parapheur-dossiers' },
  ),
);
