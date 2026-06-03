import Header from '@/components/layout/Header';
import EVM from '@/components/dashboard/EVM';
export default function Page() {
  return (
    <>
      <Header />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', minHeight: 0 }}>
        <EVM />
      </main>
    </>
  );
}
