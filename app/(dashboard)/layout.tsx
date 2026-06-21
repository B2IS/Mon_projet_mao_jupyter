'use client';

import Sidebar from '@/components/layout/Sidebar';
import TempsTracker from '@/components/layout/TempsTracker';
import AlertNotifier from '@/components/layout/AlertNotifier';
import MobileTopbar from '@/components/layout/MobileTopbar';
import { SidebarContext } from '@/lib/sidebarContext';
import { ProjectStoreProvider } from '@/lib/projectStore';
import { I18nProvider } from '@/lib/i18n/I18nContext';
import { Toaster } from 'react-hot-toast';
import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authStore';
import { canAccess } from '@/lib/authTypes';

function RBACGuard({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const route = '/' + pathname.split('/').filter(Boolean)[0];
  const denied = !!user && user.role !== 'ADMIN' && user.role !== 'AUDIT' && !canAccess(user.role, route);

  useEffect(() => {
    if (denied) router.replace('/tableau-de-bord');
  }, [denied, router]);

  if (denied) return null;
  return <>{children}</>;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <I18nProvider>
    <ProjectStoreProvider>
    <SidebarContext.Provider value={{
      open, toggle: () => setOpen(o => !o), close: () => setOpen(false),
      mobileOpen, openMobile: () => setMobileOpen(true), closeMobile: () => setMobileOpen(false),
    }}>
      <div className="app-shell">
        <TempsTracker />
        <AlertNotifier />
        <Sidebar />
        <div className="app-main">
          {/* Barre mobile — remplace le hamburger flottant sur toutes les pages */}
          <MobileTopbar />
          <RBACGuard>{children}</RBACGuard>
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
