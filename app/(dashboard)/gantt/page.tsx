import Gantt from '@/components/dashboard/Gantt';

/* La vue Gantt gère son propre header / toolbar style MS Project — pas de Header générique */
export default function Page() {
  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      overflowY: 'auto',
      height: '100%',
    }}>
      <Gantt />
    </div>
  );
}
