import { Suspense } from 'react';
import Springboard from '@/components/dashboard/Springboard';

export const metadata = { title: 'Portail de Pilotage — SIGEP' };

export default function SpringboardPage() {
  return (
    <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', minHeight: 0 }}>
      <Suspense fallback={null}>
        <Springboard />
      </Suspense>
    </main>
  );
}
