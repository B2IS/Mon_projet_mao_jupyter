'use client';
import { useAutoTracker, useAutoProjectContext, useLoginPresenceDetection } from '@/lib/tempsTracker';
import { useAuth } from '@/lib/authStore';

/** Monté une fois dans le layout : suit le temps actif + détecte le projet courant. */
export default function TempsTracker() {
  const { user } = useAuth();
  useAutoTracker();                      // heartbeat : accumule le temps actif sur le projet courant
  useAutoProjectContext();               // bascule auto bureau/projet ↔ transverse selon la navigation
  useLoginPresenceDetection(user);       // détecte présence (bureau/terrain) à la connexion
  return null;
}
