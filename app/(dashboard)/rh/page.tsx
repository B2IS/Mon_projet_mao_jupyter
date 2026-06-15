import Header from '@/components/layout/Header';
import RH from '@/components/dashboard/RH';

export const metadata = { title: 'Ressources Humaines' };
export default function Page() {
  return (
    <>
      <Header />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', minHeight: 0 }}>
        <RH />
      </main>
    </>
  );
}
