'use client';
/**
 * /copilot — Redirigé vers /agents-ia (onglet Copilot déjà intégré dans le Centre IA).
 * Cette page ne devrait plus être accessible depuis le sidebar, mais on la garde
 * pour éviter les 404 sur les liens partagés existants.
 */
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CopilotRedirectPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/agents-ia?tab=copilot'); }, [router]);
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B', fontSize: 14 }}>
      Redirection vers le Centre IA…
    </div>
  );
}
