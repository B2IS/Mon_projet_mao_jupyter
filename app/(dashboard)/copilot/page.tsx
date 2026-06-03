import Header from '@/components/layout/Header';
import Copilot from '@/components/dashboard/Copilot';

export default function Page() {
  return (
    <>
      <Header />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', minHeight: 0 }}>
        <Copilot />
      </main>
    </>
  );
}
