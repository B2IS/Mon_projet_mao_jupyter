import Header from '@/components/layout/Header';
import ReservationSalle from '@/components/dashboard/ReservationSalle';

export default function Page() {
  return (
    <>
      <Header />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', minHeight: 0 }}>
        <ReservationSalle />
      </main>
    </>
  );
}
