/**
 * suivi-temps/page.tsx — Suivi des heures aligné sur le BULLETIN D'HEURES SUPPLÉMENTAIRES
 * officiel SENELEC/DPE : multiplicateurs (1 / 1.15 / 1.4 / 1.6 / 2), panier, sujétion,
 * prime de conduite, déplacement (D1/D2/D3), imputation ODM/projet, total pondéré calculé.
 * (Réutilise le module Pointage, déjà conforme au modèle réel.)
 */
import Header from '@/components/layout/Header';
import Pointage from '@/components/dashboard/Pointage';

export default function SuiviTempsPage() {
  return (
    <>
      <Header />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', minHeight: 0 }}>
        <Pointage />
      </main>
    </>
  );
}
