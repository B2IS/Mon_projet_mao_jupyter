/**
 * tempsStore.ts — Gestion des temps & pointage UAGL + N+1
 * --------------------------------------------------------
 * Usage principal : permettre à l'UAGL et aux N+1 de suivre les temps
 * et pointages des ressources affectées aux projets/localités.
 *
 * Tracking réel :
 *   • PLATEFORME — temps actif passé sur SIGEPP, accumulé par projet (heartbeat 20s).
 *   • TERRAIN — pings GPS de l'app mobile matchés aux géofences des sites projet.
 *   • DÉCLARATIF — saisie manuelle dans la feuille de temps (vue N+1 + agent).
 *
 * Vue N+1 : tableau de bord de supervision — statuts présence, validations,
 * alertes absences, affectations par localité/projet (BEST, PADERAU, PASE2…).
 *
 * Persistance Zustand+localStorage + sync backend FastAPI (api/temps).
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Lieu = 'bureau' | 'terrain';
export type Categorie = 'Études & Conception' | 'Travaux terrain' | 'Réunions & Coordination' | 'Reporting & Admin' | 'Supervision' | 'Déplacement';

/** Statut de présence journalier d'une ressource UAGL */
export type StatutPresence = 'present' | 'terrain' | 'mission' | 'absent_justifie' | 'absent_non_justifie' | 'conge' | 'non_declare';

/** Ressource UAGL affectée à un projet/localité — vue N+1 */
export interface RessourceUAGL {
  id: string;
  nom: string;
  prenom: string;
  matricule: string;
  fonction: string;
  direction: string;         // DER / DEP / DIT / CPADERAU…
  projet: string;            // Projet d'affectation principal
  localite: string;          // Localité / zone d'intervention
  region: string;            // Région Sénégal
  nPlus1: string;            // Nom du N+1 direct
  statut: StatutPresence;    // Statut du jour
  heureArrivee?: string;     // HH:MM
  heureDepart?: string;
  tempsLoggeMin: number;     // Temps déclaré aujourd'hui
  dernierPingGPS?: string;   // Site dernier ping
  dernierPingHeure?: string;
  valideParN1: boolean;
  observationN1?: string;
  telephone?: string;
}

/** Rapport terrain photo — envoyé par chauffeur ou agent terrain */
export type EtatTravaux = 'normal' | 'incident' | 'retard' | 'non_conforme';
export interface RapportPhoto {
  id: string;
  ressourceId: string;
  ressourceNom: string;       // Prénom + Nom
  matricule: string;
  ts: number;                 // timestamp ms
  photoDataUrl: string;       // base64 data URL (vide si pas encore uploadé)
  caption: string;            // légende saisie
  localite: string;
  projet: string;
  lat?: number;
  lng?: number;
  etatTravaux: EtatTravaux;
  observations: string;
  // Résultat de l'analyse IA (simulée) — rempli après soumission
  iaTraite: boolean;
  iaExtraction?: {
    typeObservation: string;    // ex: "Pose de câble BT"
    etatDetecte: string;        // ex: "Travaux en cours — 60%"
    anomalies: string[];        // ex: ["EPI manquants", "Zone non balisée"]
    tauxAvancement?: number;    // 0–100
  };
  valideParN1: boolean;
}

export interface EntreeTemps {
  id: string; date: string; collaborateur: string; fonction: string;
  projet: string; categorie: Categorie; lieu: Lieu; localisation?: string;
  heureDebut: number; duree: number; productivite: number; facturable: boolean; tauxHoraire?: number;
}

/** Site géolocalisé d'un projet (géofence pour matcher les pings terrain). */
export interface SiteProjet { projet: string; lat: number; lng: number; rayonM: number; }

/** Ping GPS de l'app mobile, matché à un site projet. */
export interface PingGeo {
  id: string; ts: number; lat: number; lng: number;
  projet?: string; distanceM?: number; dansGeofence: boolean; dureeMin: number;
}

export const CATEGORIES: { cat: Categorie; productive: boolean; couleur: string }[] = [
  { cat: 'Études & Conception', productive: true, couleur: '#15803D' },
  { cat: 'Travaux terrain', productive: true, couleur: '#0E7490' },
  { cat: 'Supervision', productive: true, couleur: '#7C3AED' },
  { cat: 'Réunions & Coordination', productive: true, couleur: '#2563EB' },
  { cat: 'Reporting & Admin', productive: false, couleur: '#B45309' },
  { cat: 'Déplacement', productive: false, couleur: '#94A3B8' },
];
export const couleurCat = (c: Categorie) => CATEGORIES.find(x => x.cat === c)?.couleur ?? '#94A3B8';

/** Distance haversine en mètres. */
export function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Matche une position au site projet le plus proche (dans le géofence si possible). */
export function matchSite(lat: number, lng: number, sites: SiteProjet[]): { site?: SiteProjet; distanceM: number; dansGeofence: boolean } {
  let best: SiteProjet | undefined, bestD = Infinity;
  for (const s of sites) {
    const d = haversineM(lat, lng, s.lat, s.lng);
    if (d < bestD) { bestD = d; best = s; }
  }
  return { site: best, distanceM: Math.round(bestD), dansGeofence: !!best && bestD <= best.rayonM };
}

const SITES_SEED: SiteProjet[] = [
  { projet: 'PASE2 — Postes GIS', lat: 14.7900, lng: -16.9300, rayonM: 4000 },    // Thiès
  { projet: 'PASE2 — Postes GIS', lat: 14.4200, lng: -17.0000, rayonM: 4000 },    // Mbour/Saly
  { projet: 'PADERAU — HTA/BT Sud', lat: 12.8800, lng: -15.5500, rayonM: 5000 },  // Kolda
  { projet: 'PADERAU — HTA/BT Sud', lat: 12.5681, lng: -16.2719, rayonM: 5000 },  // Ziguinchor
  { projet: 'BEST — Banlieue BT', lat: 14.7600, lng: -17.3900, rayonM: 3000 },    // Pikine/Guédiawaye
  { projet: 'PADAES — Accès Universel', lat: 15.3833, lng: -15.3000, rayonM: 6000 }, // Linguère/Touba
];

interface TempsState {
  entrees: EntreeTemps[];
  // ── Vue N+1 / UAGL ──
  ressourcesUAGL: RessourceUAGL[];
  rapportsPhoto: RapportPhoto[];
  // ── tracking ──
  sites: SiteProjet[];
  projetActif: string;
  repartition: Record<string, number>; // projet → secondes plateforme accumulées
  pingsGeo: PingGeo[];
  derniereActivite: number;
  // ── heures supplémentaires ──
  justificatifsHS: JustificatifHS[];

  ajouter: (e: Omit<EntreeTemps, 'id'>) => void;
  supprimer: (id: string) => void;
  seed: () => void;
  // tracking
  setProjetActif: (p: string) => void;
  marquerActivite: () => void;
  tick: (secondes: number) => void;
  pointerGeo: (lat: number, lng: number, dureeMin?: number) => PingGeo;
  // N+1 / UAGL
  validerTemps: (id: string, obs?: string) => void;
  mettreAJourStatut: (id: string, statut: StatutPresence, obs?: string) => void;
  // Rapports photo (chauffeurs / agents terrain)
  ajouterRapportPhoto: (r: Omit<RapportPhoto, 'id' | 'iaTraite' | 'valideParN1'>) => void;
  validerRapportPhoto: (id: string) => void;
  // HS
  ajouterJustificatif: (j: Omit<JustificatifHS, 'id'>) => void;
  approuverJustificatif: (id: string, approbateur: string) => void;
  supprimerJustificatif: (id: string) => void;
}

let _seq = 0;
const uid = () => `t-${Date.now().toString(36)}-${(_seq++).toString(36)}`;
const today = () => new Date().toISOString().slice(0, 10);

// ── Données UAGL — Agents réels DPE (fichier personnel 10-03-2026) ─────────
const RESSOURCES_UAGL_SEED: RessourceUAGL[] = [
  { id: 'u1', nom: 'SAGNA SAGNA', prenom: 'Genevieve B.', matricule: 'M06231',
    fonction: 'Chef UAGL / DPD', direction: 'DER',
    projet: 'BEST — Lot 1 Ziguinchor/Sedhiou', localite: 'Ziguinchor', region: 'Ziguinchor',
    nPlus1: 'Maodo SENE', statut: 'terrain', heureArrivee: '07:45', tempsLoggeMin: 295,
    dernierPingGPS: 'Reseau BT Ziguinchor Sud', dernierPingHeure: '10:15',
    valideParN1: false, telephone: '+221 77 000 62 31' },
  { id: 'u2', nom: 'DIA', prenom: 'Tidiane Elhadj', matricule: 'M07055',
    fonction: 'Chef UAGL / DPT', direction: 'DER',
    projet: 'BEST — Lot 3 Kedougou', localite: 'Kedougou', region: 'Kedougou',
    nPlus1: 'Becegade AMAR', statut: 'terrain', heureArrivee: '07:30', tempsLoggeMin: 330,
    dernierPingGPS: 'Poste HTA Kedougou Ville', dernierPingHeure: '11:05',
    valideParN1: false, telephone: '+221 77 000 70 55' },
  { id: 'u3', nom: 'BADIANE', prenom: 'Ngalandou', matricule: 'M05010',
    fonction: 'Controleur de Projet / DPT', direction: 'DER',
    projet: 'PADERAU — HTA/BT Tambacounda', localite: 'Tambacounda', region: 'Tambacounda',
    nPlus1: 'Maodo SENE', statut: 'present', heureArrivee: '08:00', heureDepart: '17:00',
    tempsLoggeMin: 420, valideParN1: true, observationN1: 'Temps valide — supervision travaux ligne HTA' },
  { id: 'u4', nom: 'KANE', prenom: 'Fatimata', matricule: 'M05351',
    fonction: 'Controleur de Projet / DPT', direction: 'DER',
    projet: 'BEST — Lot 2 Kolda', localite: 'Kolda', region: 'Kolda',
    nPlus1: 'Maodo SENE', statut: 'terrain', heureArrivee: '08:00', tempsLoggeMin: 265,
    dernierPingGPS: 'Reseau BT Kolda Centre', dernierPingHeure: '10:30',
    valideParN1: false, telephone: '+221 77 000 53 51' },
  { id: 'u5', nom: 'THIAM', prenom: 'Mbathio Maguette', matricule: 'M06042',
    fonction: 'Controleur / DPD', direction: 'DER',
    projet: 'BEST — Lot 1 Ziguinchor/Sedhiou', localite: 'Sedhiou', region: 'Sedhiou',
    nPlus1: 'Maodo SENE', statut: 'non_declare', tempsLoggeMin: 0,
    valideParN1: false, telephone: '+221 77 000 60 42' },
  { id: 'u6', nom: 'SECK', prenom: 'Issa', matricule: 'M06153',
    fonction: 'Controleur / DPD', direction: 'DER',
    projet: 'BEST — Lot 2 Kolda', localite: 'Velingara', region: 'Kolda',
    nPlus1: 'Maodo SENE', statut: 'absent_justifie', tempsLoggeMin: 0,
    valideParN1: true, observationN1: 'Maladie — certificat medical fourni' },
  { id: 'u7', nom: 'DIACK', prenom: 'Ibrahima', matricule: 'M06731',
    fonction: 'Assistant de Projet / DPD', direction: 'DER',
    projet: 'BEST — Lot 3 Kedougou', localite: 'Saraya', region: 'Kedougou',
    nPlus1: 'Becegade AMAR', statut: 'terrain', heureArrivee: '07:15', tempsLoggeMin: 375,
    dernierPingGPS: 'Site BT Saraya', dernierPingHeure: '10:47',
    valideParN1: false, telephone: '+221 77 000 67 31' },
  { id: 'u8', nom: 'NIANG', prenom: 'Sada', matricule: 'M06791',
    fonction: 'Assistant de Projet / DPD', direction: 'DER',
    projet: 'PADERAU — HTA/BT Kaolack', localite: 'Kaolack', region: 'Kaolack',
    nPlus1: 'Modou NDIAYE', statut: 'mission', heureArrivee: '06:45', tempsLoggeMin: 480,
    dernierPingGPS: 'Poste Source Kaolack', dernierPingHeure: '14:30', valideParN1: true },
  { id: 'u9', nom: 'SY', prenom: 'Amadou Cire Alioune', matricule: 'M07801',
    fonction: 'Controleur / DPD', direction: 'DER',
    projet: 'BEST — Lot 1 Ziguinchor/Sedhiou', localite: 'Bignona', region: 'Ziguinchor',
    nPlus1: 'Maodo SENE', statut: 'absent_non_justifie', tempsLoggeMin: 0,
    valideParN1: false, observationN1: 'Absent sans declaration — relance envoyee 08h30' },
  { id: 'u10', nom: 'BA', prenom: 'Demba', matricule: 'M06202',
    fonction: 'Chauffeur / DPD', direction: 'DER',
    projet: 'BEST — Lot 1 Ziguinchor/Sedhiou', localite: 'Ziguinchor', region: 'Ziguinchor',
    nPlus1: 'Maodo SENE', statut: 'terrain', heureArrivee: '06:30', tempsLoggeMin: 390,
    dernierPingGPS: 'Axe Ziguinchor-Sedhiou', dernierPingHeure: '11:20',
    valideParN1: false, telephone: '+221 76 000 62 02' },
  { id: 'u11', nom: 'AW', prenom: 'Malick', matricule: 'M07478',
    fonction: 'Chauffeur / CPADERAU', direction: 'CPADERAU',
    projet: 'PADERAU — HTA/BT Tambacounda', localite: 'Goudiry', region: 'Tambacounda',
    nPlus1: 'Anna Chantal WONE', statut: 'conge', tempsLoggeMin: 0,
    valideParN1: true, observationN1: 'Conge annuel approuve — retour 15/06/2026' },
  { id: 'u12', nom: 'DIOP', prenom: 'Omar', matricule: 'M06461',
    fonction: 'Chauffeur / DPD', direction: 'DER',
    projet: 'BEST — Lot 2 Kolda', localite: 'Medina Yoro Foula', region: 'Kolda',
    nPlus1: 'Maodo SENE', statut: 'present', heureArrivee: '08:30', tempsLoggeMin: 270,
    valideParN1: false },
];

export const useTempsStore = create<TempsState>()(
  persist(
    (set, get) => ({
      entrees: [],
      ressourcesUAGL: [],
      rapportsPhoto: [],
      sites: SITES_SEED,
      projetActif: 'PASE2 — Postes GIS',
      repartition: {},
      pingsGeo: [],
      derniereActivite: Date.now(),
      justificatifsHS: [],

      ajouter: (e) => set(s => ({ entrees: [...s.entrees, { ...e, id: uid() }] })),
      supprimer: (id) => set(s => ({ entrees: s.entrees.filter(x => x.id !== id) })),

      validerTemps: (id, obs) => set(s => ({
        ressourcesUAGL: s.ressourcesUAGL.map(r => r.id === id ? { ...r, valideParN1: true, observationN1: obs ?? r.observationN1 } : r),
      })),
      mettreAJourStatut: (id, statut, obs) => set(s => ({
        ressourcesUAGL: s.ressourcesUAGL.map(r => r.id === id ? { ...r, statut, observationN1: obs ?? r.observationN1 } : r),
      })),
      ajouterRapportPhoto: (r) => set(s => ({
        rapportsPhoto: [{ ...r, id: uid(), iaTraite: false, valideParN1: false }, ...s.rapportsPhoto],
      })),
      validerRapportPhoto: (id) => set(s => ({
        rapportsPhoto: s.rapportsPhoto.map(r => r.id === id ? { ...r, valideParN1: true } : r),
      })),

      setProjetActif: (p) => set({ projetActif: p }),
      marquerActivite: () => set({ derniereActivite: Date.now() }),
      tick: (secondes) => set(s => ({
        repartition: { ...s.repartition, [s.projetActif]: (s.repartition[s.projetActif] ?? 0) + secondes },
      })),
      pointerGeo: (lat, lng, dureeMin = 0) => {
        const { sites } = get();
        const m = matchSite(lat, lng, sites);
        const ping: PingGeo = {
          id: uid(), ts: Date.now(), lat, lng,
          projet: m.dansGeofence ? m.site?.projet : undefined,
          distanceM: m.distanceM, dansGeofence: m.dansGeofence, dureeMin,
        };
        set(s => ({ pingsGeo: [ping, ...s.pingsGeo].slice(0, 200) }));
        // Une présence terrain confirmée alimente aussi le journal des temps.
        if (m.dansGeofence && m.site && dureeMin > 0) {
          get().ajouter({
            date: today(), collaborateur: 'Moi (mobile)', fonction: 'Terrain',
            projet: m.site.projet, categorie: 'Travaux terrain', lieu: 'terrain',
            localisation: `≈ ${m.distanceM} m du site`, heureDebut: new Date().getHours(),
            duree: dureeMin, productivite: 85, facturable: false,
          });
        }
        return ping;
      },
      ajouterJustificatif: (j) => set(s => ({
        justificatifsHS: [...s.justificatifsHS, { ...j, id: uid() }],
      })),
      approuverJustificatif: (id, approbateur) => set(s => ({
        justificatifsHS: s.justificatifsHS.map(j =>
          j.id === id ? { ...j, approuve: true, approbateurNom: approbateur, dateApprobation: today() } : j,
        ),
      })),
      supprimerJustificatif: (id) => set(s => ({
        justificatifsHS: s.justificatifsHS.filter(j => j.id !== id),
      })),

      seed: () => {
        // If UAGL resources are missing (new field), populate them even if entrees exist.
        if (!get().ressourcesUAGL.length) {
          set({ ressourcesUAGL: RESSOURCES_UAGL_SEED });
        }
        if (get().entrees.length) return;
        const d = today();
        const mk = (collaborateur: string, fonction: string, projet: string, categorie: Categorie, lieu: Lieu, heureDebut: number, duree: number, productivite: number, facturable: boolean, localisation?: string, tauxHoraire?: number): EntreeTemps =>
          ({ id: uid(), date: d, collaborateur, fonction, projet, categorie, lieu, localisation, heureDebut, duree, productivite, facturable, tauxHoraire });
        set({
          ressourcesUAGL: RESSOURCES_UAGL_SEED,
          repartition: { 'PASE2 — Postes GIS': 9300, 'PADERAU — HTA/BT Sud': 5400, 'BEST — Banlieue BT': 2700 },
          entrees: [
            mk('Cheikh FALL', 'Ingénieur conseil', 'PASE2 — Postes GIS', 'Études & Conception', 'bureau', 8, 95, 92, true, undefined, 45000),
            mk('Cheikh FALL', 'Ingénieur conseil', 'PASE2 — Postes GIS', 'Supervision', 'terrain', 10, 130, 88, true, 'Poste Thiona 90 kV — Thiès', 45000),
            mk('Cheikh FALL', 'Ingénieur conseil', 'PASE2 — Postes GIS', 'Reporting & Admin', 'bureau', 15, 60, 40, true, undefined, 45000),
            mk('Margot LY', 'Expert GP', 'PADERAU — HTA/BT Sud', 'Réunions & Coordination', 'bureau', 9, 75, 78, false),
            mk('Margot LY', 'Expert GP', 'PADERAU — HTA/BT Sud', 'Études & Conception', 'bureau', 11, 120, 90, false),
            mk('Équipe Terrain DPD', 'Équipe terrain', 'BEST — Banlieue BT', 'Travaux terrain', 'terrain', 8, 240, 85, false, 'Feeder Mbour — Saly'),
            mk('Équipe Terrain DPD', 'Équipe terrain', 'BEST — Banlieue BT', 'Déplacement', 'terrain', 13, 50, 20, false, 'Axe Mbour-Thiès'),
            mk('Ngalandou BADIANE', 'Contrôleur', 'PASE2 — Postes GIS', 'Supervision', 'terrain', 9, 150, 80, false, 'Poste Diass'),
            mk('Ngalandou BADIANE', 'Contrôleur', 'PASE2 — Postes GIS', 'Reporting & Admin', 'bureau', 14, 90, 55, false),
            mk('Cabinet ICE', 'Ingénieur conseil', 'PADERAU — HTA/BT Sud', 'Études & Conception', 'bureau', 8, 180, 94, true, undefined, 60000),
            mk('Cabinet ICE', 'Ingénieur conseil', 'PADERAU — HTA/BT Sud', 'Réunions & Coordination', 'bureau', 16, 60, 70, true, undefined, 60000),
          ],
        });
      },
    }),
    { name: 'sigepp-temps' }
  )
);

// ── Sélecteurs / KPIs ───────────────────────────────────────────────────────
export function fmtDuree(min: number): string {
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return h > 0 ? `${h}h ${m.toString().padStart(2, '0')}m` : `${m}m`;
}

export function kpis(entrees: EntreeTemps[]) {
  const total = entrees.reduce((s, e) => s + e.duree, 0);
  const prodPondere = total ? entrees.reduce((s, e) => s + e.productivite * e.duree, 0) / total : 0;
  const terrain = entrees.filter(e => e.lieu === 'terrain').reduce((s, e) => s + e.duree, 0);
  const facturableMin = entrees.filter(e => e.facturable).reduce((s, e) => s + e.duree, 0);
  const montantFacturable = entrees.filter(e => e.facturable).reduce((s, e) => s + (e.tauxHoraire ?? 0) * (e.duree / 60), 0);
  return {
    totalMin: total, pulse: Math.round(prodPondere), terrainMin: terrain, bureauMin: total - terrain,
    facturableMin, montantFacturable, nbCollaborateurs: new Set(entrees.map(e => e.collaborateur)).size,
  };
}

export function parCategorie(entrees: EntreeTemps[]) {
  const map = new Map<Categorie, number>();
  for (const e of entrees) map.set(e.categorie, (map.get(e.categorie) ?? 0) + e.duree);
  const total = entrees.reduce((s, e) => s + e.duree, 0) || 1;
  return [...map.entries()].map(([cat, min]) => ({ cat, min, pct: Math.round((min / total) * 100), couleur: couleurCat(cat) }))
    .sort((a, b) => b.min - a.min);
}

export function parHeure(entrees: EntreeTemps[]) {
  const arr = Array.from({ length: 24 }, () => 0);
  for (const e of entrees) { let restant = e.duree, h = e.heureDebut; while (restant > 0 && h < 24) { const part = Math.min(60, restant); arr[h] += part; restant -= part; h++; } }
  return arr;
}

export function parCollaborateur(entrees: EntreeTemps[]) {
  const map = new Map<string, EntreeTemps[]>();
  for (const e of entrees) { const a = map.get(e.collaborateur) ?? []; a.push(e); map.set(e.collaborateur, a); }
  return [...map.entries()].map(([nom, es]) => {
    const k = kpis(es);
    return { nom, fonction: es[0].fonction, totalMin: k.totalMin, pulse: k.pulse, facturable: es.some(e => e.facturable), montant: k.montantFacturable, terrainMin: k.terrainMin };
  }).sort((a, b) => b.totalMin - a.totalMin);
}

/** Répartition du temps PLATEFORME (secondes → minutes) par projet, triée. */
export function repartitionTriee(rep: Record<string, number>) {
  const total = Object.values(rep).reduce((s, v) => s + v, 0) || 1;
  return Object.entries(rep)
    .map(([projet, sec]) => ({ projet, min: Math.round(sec / 60), pct: Math.round((sec / total) * 100) }))
    .sort((a, b) => b.min - a.min);
}

// ── Heures supplémentaires ──────────────────────────────────────────────────

export const SEUIL_JOURNALIER_MIN = 480; // 8 h

export type TypeHS = 'TERRAIN' | 'URGENCE' | 'REUNION' | 'ASTREINTE' | 'AUTRE';
export const TYPE_HS_LABELS: Record<TypeHS, string> = {
  TERRAIN:   'Présence terrain',
  URGENCE:   'Urgence / incident',
  REUNION:   'Réunion exceptionnelle',
  ASTREINTE: 'Astreinte',
  AUTRE:     'Autre',
};

export interface JustificatifHS {
  id: string;
  date: string;
  collaborateur: string;
  mle?: string;
  fonction: string;
  projet: string;
  heuresOrdMin: number;   // portion ordinaire (≤ seuil)
  heuresSupMin: number;   // portion supplémentaire
  motif: string;
  typeHS: TypeHS;
  odmRef?: string;        // référence ODM lié (ex. "ODM N°3 - 2026")
  approuve: boolean;
  approbateurNom?: string;
  dateApprobation?: string;
}

/** Détecte les dépassements journaliers à partir du journal des entrées. */
export function detecterHeuresSup(
  entrees: EntreeTemps[],
  seuilMin = SEUIL_JOURNALIER_MIN,
): { collab: string; date: string; totalMin: number; supMin: number; projets: string[]; fonction: string }[] {
  const map = new Map<string, { collab: string; date: string; totalMin: number; projets: Set<string>; fonction: string }>();
  for (const e of entrees) {
    const key = `${e.collaborateur}|${e.date}`;
    const v = map.get(key) ?? { collab: e.collaborateur, date: e.date, totalMin: 0, projets: new Set<string>(), fonction: e.fonction };
    v.totalMin += e.duree;
    v.projets.add(e.projet);
    map.set(key, v);
  }
  return [...map.values()]
    .filter(v => v.totalMin > seuilMin)
    .map(v => ({ collab: v.collab, date: v.date, totalMin: v.totalMin, supMin: v.totalMin - seuilMin, projets: [...v.projets], fonction: v.fonction }))
    .sort((a, b) => b.supMin - a.supMin);
}

