import Header from '@/components/layout/Header';
import CanevasDocuments from '@/components/dashboard/CanevasDocuments';

export default function Page() {
  return (
    <>
      <Header />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', minHeight: 0 }}>
        <CanevasDocuments />
      </main>
    </>
  );
}
