import Header from '@/components/layout/Header';
import ConstructeurIndicateurs from '@/components/dashboard/ConstructeurIndicateurs';

export default function Page() {
  return (
    <>
      <Header />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', minHeight: 0 }}>
        <ConstructeurIndicateurs />
      </main>
    </>
  );
}
