import Gantt from '@/components/dashboard/Gantt';

export const metadata = { title: 'Planning Gantt' };

/* Planning Gantt — toolbar autonome, sans Header générique */
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
