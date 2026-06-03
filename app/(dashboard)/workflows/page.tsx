import Header from '@/components/layout/Header';
import Workflows from '@/components/dashboard/Workflows';
export default function Page() {
  return (
    <>
      <Header />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', minHeight: 0 }}>
        <Workflows />
      </main>
    </>
  );
}
