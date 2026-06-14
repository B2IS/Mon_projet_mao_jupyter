import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/jwt';
import { SESSION_COOKIE } from '@/lib/authTypes';
import { TEST_USERS } from '@/lib/usersDb';

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  }

  const claims = await verifyToken(token);
  if (!claims) {
    return NextResponse.json({ error: 'Token invalide ou expiré.' }, { status: 401 });
  }

  const found = TEST_USERS.find(u => u.id === claims.id || u.email.toLowerCase() === claims.email.toLowerCase());

  return NextResponse.json({
    user: found ? {
      id: found.id, prenom: found.prenom, nom: found.nom,
      email: found.email, role: found.role, direction: found.direction,
      initials: found.initials, avatarColor: found.avatarColor,
      poste: (found as { poste?: string }).poste,
      departement: (found as { departement?: string }).departement,
      cellule: (found as { cellule?: string }).cellule,
    } : { id: claims.id, email: claims.email, role: claims.role }
  });
}
