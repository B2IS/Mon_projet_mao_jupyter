/**
 * meetingRoomStore.ts — Réservation de salles de réunion
 * -----------------------------------------------------------------------------
 * Les demandes de réservation sont adressées aux assistantes de direction,
 * secrétaires et à l'UAGL, qui valident ou refusent. Détection des conflits
 * (même salle, créneaux qui se chevauchent). Persisté en localStorage.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ReservationStatut = 'demande' | 'confirmee' | 'refusee' | 'annulee';

export interface SalleReunion {
  id: string;
  nom: string;
  capacite: number;
  localisation: string;
  equipements: string[];
  actif: boolean;
}

export interface Reservation {
  id: string;
  salleId: string;
  objet: string;
  date: string;        // YYYY-MM-DD
  heureDebut: string;  // HH:MM
  heureFin: string;    // HH:MM
  demandeur: string;
  demandeurEmail: string;
  participants: number;
  statut: ReservationStatut;
  destinataire: string; // 'Assistantes de direction' | 'Secrétariat' | 'UAGL'
  traitePar?: string;
  motifRefus?: string;
  createdAt: string;
}

interface MeetingRoomState {
  salles: SalleReunion[];
  reservations: Reservation[];
  addSalle: (s: Omit<SalleReunion, 'id'>) => void;
  updateSalle: (id: string, patch: Partial<SalleReunion>) => void;
  removeSalle: (id: string) => void;
  demander: (r: Omit<Reservation, 'id' | 'statut' | 'createdAt'>) => { ok: boolean; conflit?: Reservation };
  confirmer: (id: string, par: string) => void;
  refuser: (id: string, par: string, motif: string) => void;
  annuler: (id: string) => void;
  /** Détecte un conflit pour une salle + créneau (hors réservations refusées/annulées). */
  conflit: (salleId: string, date: string, hd: string, hf: string, excludeId?: string) => Reservation | undefined;
}

const DEFAULT_SALLES: SalleReunion[] = [
  { id: 'S1', nom: 'Salle du Conseil — DPE', capacite: 20, localisation: 'Siège DPE — R+3', equipements: ['Vidéoprojecteur', 'Visioconférence', 'Tableau'], actif: true },
  { id: 'S2', nom: 'Salle de Réunion DER', capacite: 12, localisation: 'Siège DPE — R+2', equipements: ['Écran TV', 'Tableau'], actif: true },
  { id: 'S3', nom: 'Salle de Réunion DPD', capacite: 10, localisation: 'Siège DPE — R+2', equipements: ['Écran TV'], actif: true },
  { id: 'S4', nom: 'Salle de Formation', capacite: 30, localisation: 'Siège DPE — RDC', equipements: ['Vidéoprojecteur', 'Sonorisation', 'Tableau'], actif: true },
];

const DESTINATAIRES = ['Assistantes de direction', 'Secrétariat', 'UAGL'];
export { DESTINATAIRES };

function overlap(hd1: string, hf1: string, hd2: string, hf2: string): boolean {
  return hd1 < hf2 && hd2 < hf1;
}

export const useMeetingRoom = create<MeetingRoomState>()(
  persist(
    (set, get) => ({
      salles: DEFAULT_SALLES.map(s => ({ ...s })),
      reservations: [],

      addSalle: (s) => set(st => ({ salles: [...st.salles, { ...s, id: `S${Date.now().toString(36)}` }] })),
      updateSalle: (id, patch) => set(st => ({ salles: st.salles.map(s => s.id === id ? { ...s, ...patch } : s) })),
      removeSalle: (id) => set(st => ({ salles: st.salles.filter(s => s.id !== id) })),

      conflit: (salleId, date, hd, hf, excludeId) =>
        get().reservations.find(r =>
          r.id !== excludeId && r.salleId === salleId && r.date === date &&
          (r.statut === 'demande' || r.statut === 'confirmee') &&
          overlap(hd, hf, r.heureDebut, r.heureFin)),

      demander: (r) => {
        const c = get().conflit(r.salleId, r.date, r.heureDebut, r.heureFin);
        if (c) return { ok: false, conflit: c };
        const full: Reservation = { ...r, id: `R${Date.now().toString(36)}`, statut: 'demande', createdAt: new Date().toISOString() };
        set(st => ({ reservations: [full, ...st.reservations] }));
        return { ok: true };
      },
      confirmer: (id, par) => set(st => ({ reservations: st.reservations.map(r => r.id === id ? { ...r, statut: 'confirmee', traitePar: par } : r) })),
      refuser: (id, par, motif) => set(st => ({ reservations: st.reservations.map(r => r.id === id ? { ...r, statut: 'refusee', traitePar: par, motifRefus: motif } : r) })),
      annuler: (id) => set(st => ({ reservations: st.reservations.map(r => r.id === id ? { ...r, statut: 'annulee' } : r) })),
    }),
    { name: 'sigepp-meeting-rooms' },
  ),
);
