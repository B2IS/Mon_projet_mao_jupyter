import { redirect } from 'next/navigation';

/** Redirect vers le module unifié Temps & Activités */
export default function SuiviTempsPage() {
  redirect('/gestion-temps');
}
