import Programmes from '@/components/dashboard/Programmes';

export const metadata = { title: 'Programmes' };
export default function ProgrammesPage() {
  return (
    <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', minHeight: 0 }}>
      <Programmes />
    </main>
  );
}
