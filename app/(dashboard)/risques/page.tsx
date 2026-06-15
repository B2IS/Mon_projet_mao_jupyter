import Header from '@/components/layout/Header';
import Risques from '@/components/dashboard/Risques';

export const metadata = { title: 'Registre des Risques' };
export default function Page() {
  return (
    <>
      <Header />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', minHeight: 0 }}>
        <Risques />
      </main>
    </>
  );
}
