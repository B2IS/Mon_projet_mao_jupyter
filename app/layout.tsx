import type { Metadata } from 'next';
import './globals.css';
import ToastContainer from '@/components/ui/ToastContainer';
import { AuthProvider } from '@/lib/authStore';

export const metadata: Metadata = {
  title: 'SIGEPP-DPE — Système Intégré de Gouvernance, d\'Exécution et de Pilotage de Projet',
  description: 'SIGEPP-DPE · Direction Principale Équipement SENELEC · PMO Multi-Projets · Portefeuille · Planification · Suivi-Évaluation',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" style={{ height: '100%' }}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body style={{ height: '100%', margin: 0 }}>
        <AuthProvider>
          {children}
          <ToastContainer />
        </AuthProvider>
      </body>
    </html>
  );
}
