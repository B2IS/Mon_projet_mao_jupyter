import Header from '@/components/layout/Header';
import ImmobilisationsWorkspace from '@/components/dashboard/ImmobilisationsWorkspace';

export default function Page() {
  return (
    <>
      <Header />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', minHeight: 0 }}>
        <ImmobilisationsWorkspace section="receptions" />
      </main>
    </>
  );
}
