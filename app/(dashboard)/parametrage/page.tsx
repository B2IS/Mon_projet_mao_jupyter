'use client';
/**
 * parametrage/page.tsx — Préférences & Profil personnel
 * Accessible à tous les agents DPE (UNIVERSAL via moduleAccess).
 * Les admin voient /administration pour la gestion système.
 */
import Header from '@/components/layout/Header';
import Parametrage from '@/components/dashboard/Parametrage';

export default function Page() {
  return (
    <>
      <Header />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', minHeight: 0 }}>
        <Parametrage />
      </main>
    </>
  );
}
