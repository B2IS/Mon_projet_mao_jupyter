import type { Metadata } from 'next';
import './globals.css';
import ToastContainer from '@/components/ui/ToastContainer';
import { AuthProvider } from '@/lib/authStore';
import { SessionProvider } from 'next-auth/react';
import { auth } from '@/auth';

export const metadata: Metadata = {
  title: {
    template: '%s — SIGEP-DPE',
    default: 'SIGEP-DPE · Gouvernance & Pilotage de Projet',
  },
  description: 'SIGEP-DPE · Direction Principale Équipement SENELEC · PMO Multi-Projets · Portefeuille · Planification · Suivi-Évaluation',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Pre-populate session server-side → SessionProvider démarre en status='authenticated'
  // au lieu de 'loading', ce qui permet à AuthProvider de lire le user immédiatement.
  const session = await auth();

  return (
    <html lang="fr" style={{ height: '100%' }}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body style={{ height: '100%', margin: 0 }}>
        <SessionProvider session={session}>
          <AuthProvider>
            {children}
            <ToastContainer />
          </AuthProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
