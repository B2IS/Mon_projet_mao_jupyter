import Header from '@/components/layout/Header';
import GED from '@/components/dashboard/GED';

export const metadata = { title: 'Espace Documentaire' };
export default function Page() {
  return (
    <>
      <Header />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', minHeight: 0 }}>
        <GED />
      </main>
    </>
  );
}
