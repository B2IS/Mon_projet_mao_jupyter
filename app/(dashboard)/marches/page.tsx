import Header from '@/components/layout/Header';
import Marches from '@/components/dashboard/Marches';

export const metadata = { title: 'Marchés & Contrats' };
export default function Page() {
  return (
    <>
      <Header />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', minHeight: 0 }}>
        <Marches />
      </main>
    </>
  );
}
