import Header from '@/components/layout/Header';
import Terrain from '@/components/dashboard/Terrain';
export default function Page() {
  return (
    <>
      <Header />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', minHeight: 0 }}>
        <Terrain />
      </main>
    </>
  );
}
