'use client';
/**
 * AlertNotifier — alimente la boîte « Mes notifications » automatiquement.
 * ----------------------------------------------------------------------------
 * • Génère une notification interne pour CHAQUE alerte critique ET haute du portefeuille
 *   (déduplication par ref = id d'alerte → pas de doublon au rechargement / mode strict).
 * • Pas de notifications de démonstration : seules les alertes issues des données réelles
 *   sont poussées dans la boîte de réception.
 * Monté une fois dans le layout dashboard.
 */
import { useEffect } from 'react';
import { useProjectStore } from '@/lib/projectStore';
import { useAuth } from '@/lib/authStore';
import { useNotificationStore } from '@/lib/notificationStore';
import { computeLiveAlertes } from '@/lib/alertEngine';

export default function AlertNotifier() {
  const projets = useProjectStore().projets;
  const { user } = useAuth();
  const inbox = useNotificationStore(s => s.inbox);
  const pushInbox = useNotificationStore(s => s.pushInbox);

  useEffect(() => {
    const email = (user?.email || '').toLowerCase().trim();
    if (!email) return;

    const myRefs = new Set(inbox.filter(n => n.recipientEmail === email).map(n => n.ref));

    // Notification interne par alerte critique ou haute (déduplication par ref).
    const alertes = computeLiveAlertes(projets).filter(a =>
      a.priorite === 'critique' || a.priorite === 'haute',
    );
    alertes.slice(0, 40).forEach(a => {
      if (!myRefs.has(a.id)) {
        pushInbox({
          recipientEmail: email,
          title: `${a.priorite === 'critique' ? '🔴 Alerte critique' : '🟠 Alerte haute'} — ${a.projetCode}`,
          message: a.message,
          type: a.priorite === 'critique' ? 'error' : 'warning',
          link: `/cockpit-projet?code=${encodeURIComponent(a.projetCode)}`,
          source: "Moteur d'alertes",
          ref: a.id,
        });
        myRefs.add(a.id);
      }
    });
  }, [projets, user?.email, inbox, pushInbox]);

  return null;
}
