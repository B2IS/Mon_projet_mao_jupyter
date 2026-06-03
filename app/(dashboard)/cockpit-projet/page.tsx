import CockpitProjet from '@/components/dashboard/CockpitProjet';
export default function CockpitProjetPage() {
  return (
    <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', minHeight: 0 }}>
      <CockpitProjet />
    </main>
  );
}
