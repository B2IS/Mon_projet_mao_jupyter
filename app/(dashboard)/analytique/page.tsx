import Header from '@/components/layout/Header';
import Analytique from '@/components/dashboard/Analytique';
export default function Page() {
  return (
    <>
      <Header />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', minHeight: 0 }}>
        <Analytique />
      </main>
    </>
  );
}
