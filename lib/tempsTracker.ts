'use client';
/**
 * tempsTracker.ts — Moteur de suivi du temps (RescueTime-like) + géoloc terrain.
 * ----------------------------------------------------------------------------
 * • useAutoTracker() : heartbeat plateforme. Tant que l'onglet est VISIBLE et que
 *   l'utilisateur est ACTIF (souris/clavier/scroll récents), on accumule le temps
 *   sur le projet actif (store.tick). Inactif > IDLE ⇒ pause automatique.
 * • capturerPositionTerrain() : lit la position GPS (app mobile activée) et la
 *   matche au site du projet (haversine + géofence) via store.pointerGeo.
 *
 * Synchronisation backend Django (apps/temps) en best-effort (non bloquante).
 */

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useTempsStore, type PingGeo, type Lieu } from './tempsStore';
import toast from 'react-hot-toast';

const HEARTBEAT_S = 20;        // fréquence du heartbeat
const IDLE_MS = 90_000;        // au-delà ⇒ inactif (pause)
const ACTIVITY_THROTTLE = 4000;

/** Libellé du « contexte hors-projet » (direction, admin, portefeuille…). */
export const CONTEXTE_TRANSVERSE = 'Transverse — Direction & Admin';

/** Routes considérées comme un poste de travail PROJET : le temps actif y est
 *  attribué au projet ouvert (le composant écran appelle setProjetActif). */
const ROUTES_PROJET = ['/cockpit-projet', '/gantt', '/gestion-projet', '/evm', '/wbs', '/taches'];

/** POST best-effort vers le backend (ignore les échecs : app offline-first). */
async function sync(path: string, body: unknown) {
  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('sigepp_access') : null;
    const base = process.env.NEXT_PUBLIC_DJANGO_API_URL ?? 'http://localhost:8000/api';
    await fetch(`${base}${path}`, {
      method: 'POST', keepalive: true,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    });
  } catch { /* silencieux */ }
}

/** Hook global : à monter une fois dans le layout dashboard. */
export function useAutoTracker() {
  const lastActivity = useRef<number>(Date.now());
  const lastMark = useRef<number>(0);

  useEffect(() => {
    const onActivity = () => {
      const now = Date.now();
      if (now - lastMark.current > ACTIVITY_THROTTLE) { lastMark.current = now; }
      lastActivity.current = now;
    };
    const evs: (keyof DocumentEventMap)[] = ['mousemove', 'keydown', 'scroll', 'click', 'pointerdown'];
    evs.forEach(e => document.addEventListener(e, onActivity, { passive: true }));

    const id = window.setInterval(() => {
      const visible = document.visibilityState === 'visible';
      const actif = Date.now() - lastActivity.current < IDLE_MS;
      if (visible && actif) {
        const { projetActif, tick } = useTempsStore.getState();
        tick(HEARTBEAT_S);
        void sync('/temps/heartbeat/', { projet: projetActif, secondes: HEARTBEAT_S });
      }
    }, HEARTBEAT_S * 1000);

    return () => {
      window.clearInterval(id);
      evs.forEach(e => document.removeEventListener(e, onActivity));
    };
  }, []);
}

/**
 * Détection AUTOMATIQUE du contexte projet (façon RescueTime).
 * Sur un écran « poste de travail projet » (cockpit, gantt…), c'est l'écran qui
 * fixe le projet actif (setProjetActif) → le temps s'y impute. Sur les autres
 * écrans (tableau de bord, admin, portefeuille…), le temps bascule sur un
 * bucket transverse « Direction & Admin ». À monter une fois dans le layout.
 */
export function useAutoProjectContext() {
  const pathname = usePathname();
  useEffect(() => {
    const estRouteProjet = ROUTES_PROJET.some(r => pathname?.startsWith(r));
    if (!estRouteProjet) {
      // Hors poste de travail projet → temps transverse (direction / admin).
      useTempsStore.getState().setProjetActif(CONTEXTE_TRANSVERSE);
    }
    // Sur une route projet : on laisse l'écran (cockpit/gantt) fixer le projet.
  }, [pathname]);
}

/**
 * Suivi TERRAIN automatique : tant qu'il est actif, relève la position GPS à
 * intervalle régulier et impute automatiquement la durée au projet dont le
 * géofence contient la position. Renvoie une fonction d'arrêt.
 */
export function demarrerSuiviTerrainAuto(
  intervalMin = 5,
  onPing?: (p: PingGeo) => void,
): () => void {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return () => {};
  const releve = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        // n'impute la durée que si on est réellement dans un géofence projet
        const ping = useTempsStore.getState().pointerGeo(latitude, longitude, intervalMin);
        void sync('/temps/ping/', { lat: latitude, lng: longitude, duree_min: ping.dansGeofence ? intervalMin : 0 });
        onPing?.(ping);
      },
      () => { /* position indisponible : on réessaiera au prochain tick */ },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  };
  releve(); // premier relevé immédiat
  const id = window.setInterval(releve, intervalMin * 60_000);
  return () => window.clearInterval(id);
}

/** Capture la position GPS courante et la matche au site projet. */
export function capturerPositionTerrain(dureeMin = 0): Promise<{ ping: PingGeo } | { erreur: string }> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve({ erreur: 'Géolocalisation indisponible sur cet appareil.' });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const ping = useTempsStore.getState().pointerGeo(latitude, longitude, dureeMin);
        void sync('/temps/ping/', { lat: latitude, lng: longitude, duree_min: dureeMin });
        resolve({ ping });
      },
      (err) => resolve({ erreur: err.message || 'Position refusée.' }),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
    );
  });
}

/** Simule un pointage depuis un site connu (démo, machine hors Sénégal). */
export function pointerDepuisSite(lat: number, lng: number, dureeMin = 30): PingGeo {
  const ping = useTempsStore.getState().pointerGeo(lat, lng, dureeMin);
  void sync('/temps/ping/', { lat, lng, duree_min: dureeMin });
  return ping;
}

/** Interface minimale de l'utilisateur reçu de l'authStore (évite une dépendance circulaire). */
interface UserMinimal { id: string; prenom: string; nom: string; role: string; }

/**
 * Détecte la présence à la connexion via GPS (bureau ↔ terrain) et enregistre
 * une entrée de session dans le store. Doit être monté avec l'utilisateur courant.
 */
export function useLoginPresenceDetection(user: UserMinimal | null) {
  const prevId = useRef<string | null>(null);

  useEffect(() => {
    const uid = user?.id ?? null;
    if (uid === prevId.current) return;
    prevId.current = uid;
    if (!uid || !user) return; // déconnexion — rien à faire

    const now = new Date();
    const heureDebut = now.getHours();
    const nom = `${user.prenom} ${user.nom}`;

    function enregistrer(lieu: Lieu, projet: string, localisation: string) {
      useTempsStore.getState().ajouter({
        date: now.toISOString().slice(0, 10),
        collaborateur: nom,
        fonction: user!.role,
        projet,
        categorie: lieu === 'terrain' ? 'Travaux terrain' : 'Reporting & Admin',
        lieu,
        localisation,
        heureDebut,
        duree: 0,
        productivite: 0.8,
        facturable: false,
      });
      if (lieu === 'terrain') {
        toast.success(`Terrain détecté — ${projet}`, { icon: '📍', duration: 5000 });
      } else {
        toast.success('Suivi démarré — Bureau', { icon: '🏢', duration: 4000 });
      }
    }

    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          const ping = useTempsStore.getState().pointerGeo(latitude, longitude, 0);
          const lieu: Lieu = ping.dansGeofence ? 'terrain' : 'bureau';
          const projet = (ping.dansGeofence && ping.projet) ? ping.projet : useTempsStore.getState().projetActif;
          if (ping.dansGeofence && ping.projet) useTempsStore.getState().setProjetActif(ping.projet);
          enregistrer(lieu, projet, ping.dansGeofence ? `Géofence — ${ping.projet}` : 'Bureau / Siège');
          void sync('/temps/session-start/', { lieu, projet, lat: latitude, lng: longitude });
        },
        () => {
          enregistrer('bureau', useTempsStore.getState().projetActif, 'Bureau / Siège');
        },
        { enableHighAccuracy: false, timeout: 8_000, maximumAge: 0 },
      );
    } else {
      enregistrer('bureau', useTempsStore.getState().projetActif, 'Bureau / Siège');
    }
  }, [user]);
}
