'use client';

import Sidebar from '@/components/layout/Sidebar';
import { SidebarContext } from '@/lib/sidebarContext';
import { ProjectStoreProvider } from '@/lib/projectStore';
import { I18nProvider } from '@/lib/i18n/I18nContext';
import { Toaster } from 'react-hot-toast';
import { useState } from 'react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(true);

  // AuthProvider est fourni par le layout racine (app/layout.tsx) : un seul
  // contexte partagé, l'état de connexion persiste donc à la navigation /login → dashboard.
  return (
    <I18nProvider>
    <ProjectStoreProvider>
    <SidebarContext.Provider value={{ open, toggle: () => setOpen(o => !o), close: () => setOpen(false) }}>
      <div className="app-shell">
        <Sidebar />
        <div className="app-main">
          {children}
        </div>
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: '#fff',
              color: '#1E293B',
              border: '1px solid #E2E8F0',
              fontSize: 13,
              borderRadius: 8,
              boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
            },
            success: { iconTheme: { primary: '#F37021', secondary: '#fff' } },
            error:   { iconTheme: { primary: '#EF3340', secondary: '#fff' } },
          }}
        />
      </div>
    </SidebarContext.Provider>
    </ProjectStoreProvider>
    </I18nProvider>
  );
}
