import Header from '@/components/layout/Header';
import GestionTemps from '@/components/dashboard/GestionTemps';

export default function Page() {
  return (
    <>
      <Header />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', minHeight: 0 }}>
        <GestionTemps />
      </main>
    </>
  );
}
