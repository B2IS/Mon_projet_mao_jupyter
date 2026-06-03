import Header from '@/components/layout/Header';
import Risques from '@/components/dashboard/Risques';
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
