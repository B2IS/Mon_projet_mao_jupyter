import Header from '@/components/layout/Header';
import Taches from '@/components/dashboard/Taches';
export default function Page() {
  return (
    <>
      <Header />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', minHeight: 0 }}>
        <Taches />
      </main>
    </>
  );
}
