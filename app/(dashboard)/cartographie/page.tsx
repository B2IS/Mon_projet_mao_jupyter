'use client';

import dynamic from 'next/dynamic';
import Header from '@/components/layout/Header';

// Leaflet touche `window` à l'évaluation du module → chargement client uniquement
// (ssr:false) pour éviter l'erreur de prérendu statique « window is not defined ».
const Cartographie = dynamic(() => import('@/components/dashboard/Cartographie'), {
  ssr: false,
  loading: () => (
    <div style={{ padding: 24, color: '#64748B', fontSize: 14 }}>Chargement de la cartographie…</div>
  ),
});

export default function Page() {
  return (
    <>
      <Header />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', minHeight: 0 }}>
        <Cartographie />
      </main>
    </>
  );
}
