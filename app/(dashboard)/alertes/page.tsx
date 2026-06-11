import Header from '@/components/layout/Header';
import Alertes from '@/components/dashboard/Alertes';

export default function AlertesPage() {
  return (
    <>
      <Header />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', minHeight: 0 }}>
        <Alertes />
      </main>
    </>
  );
}
