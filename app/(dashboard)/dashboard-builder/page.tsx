import Header from '@/components/layout/Header';
import DashboardBuilder from '@/components/dashboard/DashboardBuilder';

export default function Page() {
  return (
    <>
      <Header />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', minHeight: 0 }}>
        <DashboardBuilder />
      </main>
    </>
  );
}
