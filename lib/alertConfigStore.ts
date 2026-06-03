/**
 * alertConfigStore.ts — Configuration des canaux d'alerte (SIGEPP-DPE).
 *
 * Permet de paramétrer les canaux de notification (Email, SMS, WhatsApp,
 * notification interne, webhook/Teams) et, par type d'événement métier
 * (échéance décompte, dépassement budget, retard jalon, alerte SLA…),
 * de choisir quels canaux sont déclenchés et leur seuil.
 *
 * Persistance localStorage (clé `sigepp-alert-config`).
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type CanalId = 'email' | 'sms' | 'whatsapp' | 'interne' | 'webhook';

export interface CanalConfig {
  id: CanalId;
  label: string;
  actif: boolean;
  /** destinataire/endpoint par défaut (email, n° téléphone, URL webhook…) */
  cible: string;
  /** champ libre de configuration (clé API, identifiant expéditeur…) */
  parametre: string;
}

export type GraviteAlerte = 'info' | 'warning' | 'critique';

export interface RegleAlerte {
  id: string;
  label: string;
  description: string;
  gravite: GraviteAlerte;
  actif: boolean;
  /** canaux déclenchés pour cette règle */
  canaux: CanalId[];
  /** seuil numérique optionnel (jours avant échéance, % dépassement…) */
  seuil?: number;
  seuilUnite?: string;
}

interface AlertState {
  canaux: CanalConfig[];
  regles: RegleAlerte[];
  setCanal: (id: CanalId, patch: Partial<CanalConfig>) => void;
  toggleCanal: (id: CanalId) => void;
  setRegle: (id: string, patch: Partial<RegleAlerte>) => void;
  toggleRegle: (id: string) => void;
  toggleRegleCanal: (regleId: string, canal: CanalId) => void;
  addRegle: (regle: Omit<RegleAlerte, 'id'>) => void;
  removeRegle: (id: string) => void;
  resetConfig: () => void;
}

const DEFAULT_CANAUX: CanalConfig[] = [
  { id: 'email',    label: 'Email',                 actif: true,  cible: 'dpe-alertes@senelec.sn', parametre: 'SMTP SENELEC' },
  { id: 'sms',      label: 'SMS',                   actif: true,  cible: '+221 77 000 00 00',      parametre: 'Passerelle SMS' },
  { id: 'whatsapp', label: 'WhatsApp',              actif: false, cible: '+221 77 000 00 00',      parametre: 'WhatsApp Business API' },
  { id: 'interne',  label: 'Notification interne',  actif: true,  cible: 'Cloche SIGEPP',          parametre: '' },
  { id: 'webhook',  label: 'Webhook / Teams',       actif: false, cible: 'https://…/webhook',      parametre: 'Microsoft Teams' },
];

const DEFAULT_REGLES: RegleAlerte[] = [
  { id: 'decompte_echeance', label: 'Échéance décompte / facture',   description: 'Décompte arrivant à échéance dans le circuit de validation.', gravite: 'warning',  actif: true,  canaux: ['email', 'interne'],            seuil: 5,  seuilUnite: 'jours' },
  { id: 'budget_depassement', label: 'Dépassement budgétaire',        description: 'Décaissement dépassant le budget prévu d\'un seuil.',          gravite: 'critique', actif: true,  canaux: ['email', 'sms', 'interne'],     seuil: 5,  seuilUnite: '%' },
  { id: 'jalon_retard',       label: 'Retard sur jalon',              description: 'Jalon projet dépassant sa date prévue.',                       gravite: 'warning',  actif: true,  canaux: ['email', 'interne'],            seuil: 0,  seuilUnite: 'jours' },
  { id: 'sla_circuit',        label: 'SLA circuit dépassé',           description: 'Étape de circuit dépassant le délai SLA paramétré.',           gravite: 'critique', actif: true,  canaux: ['email', 'sms', 'whatsapp'],    seuil: 0,  seuilUnite: 'jours' },
  { id: 'reception_attente',  label: 'Réception en attente',          description: 'Procès-verbal de réception en attente de signature.',          gravite: 'info',     actif: true,  canaux: ['interne'] },
  { id: 'odm_validation',     label: 'ODM à valider',                 description: 'Ordre de mission en attente de validation hiérarchique.',      gravite: 'info',     actif: true,  canaux: ['email', 'interne'] },
];

export const useAlertConfig = create<AlertState>()(
  persist(
    (set) => ({
      canaux: DEFAULT_CANAUX.map(c => ({ ...c })),
      regles: DEFAULT_REGLES.map(r => ({ ...r, canaux: [...r.canaux] })),

      setCanal: (id, patch) => set(s => ({ canaux: s.canaux.map(c => c.id === id ? { ...c, ...patch } : c) })),
      toggleCanal: (id) => set(s => ({ canaux: s.canaux.map(c => c.id === id ? { ...c, actif: !c.actif } : c) })),

      setRegle: (id, patch) => set(s => ({ regles: s.regles.map(r => r.id === id ? { ...r, ...patch } : r) })),
      toggleRegle: (id) => set(s => ({ regles: s.regles.map(r => r.id === id ? { ...r, actif: !r.actif } : r) })),
      toggleRegleCanal: (regleId, canal) => set(s => ({
        regles: s.regles.map(r => r.id === regleId
          ? { ...r, canaux: r.canaux.includes(canal) ? r.canaux.filter(c => c !== canal) : [...r.canaux, canal] }
          : r),
      })),
      addRegle: (regle) => set(s => ({ regles: [...s.regles, { ...regle, id: `regle_${Date.now()}` }] })),
      removeRegle: (id) => set(s => ({ regles: s.regles.filter(r => r.id !== id) })),

      resetConfig: () => set({
        canaux: DEFAULT_CANAUX.map(c => ({ ...c })),
        regles: DEFAULT_REGLES.map(r => ({ ...r, canaux: [...r.canaux] })),
      }),
    }),
    { name: 'sigepp-alert-config' },
  ),
);

export const CANAL_META: Record<CanalId, { emoji: string }> = {
  email:    { emoji: '✉️' },
  sms:      { emoji: '📱' },
  whatsapp: { emoji: '🟢' },
  interne:  { emoji: '🔔' },
  webhook:  { emoji: '🔗' },
};
