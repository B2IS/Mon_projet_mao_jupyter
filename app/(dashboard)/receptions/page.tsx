import Header from '@/components/layout/Header';
import Receptions from '@/components/dashboard/Receptions';

export const metadata = { title: 'PV Réceptions' };
export default function Page() {
  return (
    <>
      <Header />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', minHeight: 0 }}>
        <Receptions />
      </main>
    </>
  );
}
