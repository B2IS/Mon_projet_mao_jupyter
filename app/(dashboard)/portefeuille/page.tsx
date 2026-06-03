import Header from '@/components/layout/Header';
import Portefeuille from '@/components/dashboard/Portefeuille';
export default function Page() {
  return (
    <>
      <Header />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', minHeight: 0 }}>
        <Portefeuille />
      </main>
    </>
  );
}
