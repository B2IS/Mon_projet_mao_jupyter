import Header from '@/components/layout/Header';
import Pointage from '@/components/dashboard/Pointage';

export default function Page() {
  return (
    <>
      <Header />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', minHeight: 0 }}>
        <Pointage />
      </main>
    </>
  );
}
