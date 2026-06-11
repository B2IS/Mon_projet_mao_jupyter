'use client';
import { useAutoTracker, useAutoProjectContext } from '@/lib/tempsTracker';

/** Monté une fois dans le layout : suit le temps actif + détecte le projet courant. */
export default function TempsTracker() {
  useAutoTracker();        // heartbeat : accumule le temps actif sur le projet courant
  useAutoProjectContext(); // bascule auto bureau/projet ↔ transverse selon la navigation
  return null;
}
