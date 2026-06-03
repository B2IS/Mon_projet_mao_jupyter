import Header from '@/components/layout/Header';
import Receptions from '@/components/dashboard/Receptions';
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
