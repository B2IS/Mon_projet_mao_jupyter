import Bordereaux from '@/components/dashboard/Bordereaux';
export default function BordereauxPage() {
  return (
    <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', minHeight: 0 }}>
      <Bordereaux />
    </main>
  );
}
