'use client';

import dynamic from 'next/dynamic';
import Header from '@/components/layout/Header';

// Leaflet touche `window` à l'évaluation du module → chargement client uniquement
// (ssr:false) pour éviter l'erreur de prérendu statique « window is not defined ».
const PatrimoineSIG = dynamic(() => import('@/components/dashboard/PatrimoineSIG'), {
  ssr: false,
  loading: () => (
    <div style={{ padding: 24, color: '#64748B', fontSize: 14 }}>Chargement du patrimoine SIG…</div>
  ),
});

export default function Page() {
  return (
    <>
      <Header />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', minHeight: 0 }}>
        <PatrimoineSIG />
      </main>
    </>
  );
}
