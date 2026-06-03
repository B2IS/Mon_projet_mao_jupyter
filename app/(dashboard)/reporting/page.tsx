import Header from '@/components/layout/Header';
import Reporting from '@/components/dashboard/Reporting';
export default function Page() {
  return (
    <>
      <Header />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', minHeight: 0 }}>
        <Reporting />
      </main>
    </>
  );
}
