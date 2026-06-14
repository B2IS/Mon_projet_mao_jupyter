import { NextResponse } from 'next/server';
import { findUser } from '@/lib/usersDb';
import { signToken } from '@/lib/jwt';
import { SESSION_COOKIE, SESSION_MAX_AGE } from '@/lib/authTypes';

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.email || !body?.password) {
    return NextResponse.json({ error: 'Email et mot de passe requis.' }, { status: 400 });
  }

  const emailLower = (body.email as string).trim().toLowerCase();
  const pwdTrim    = (body.password as string).trim();

  const found = findUser(emailLower, pwdTrim);

  // Allow any @dpe.sn / @senelec.sn / @enerticai.com domain as DIR_DPE fallback
  const isTrustedDomain =
    emailLower.endsWith('@dpe.sn') ||
    emailLower.endsWith('@senelec.sn') ||
    emailLower.endsWith('@enerticai.com');

  const sessionUser = found ?? (isTrustedDomain
    ? { id: 'legacy', email: emailLower, role: 'DIR_DPE' as const, prenom: emailLower.split('@')[0].split('.')[0], nom: 'SENELEC', initials: emailLower.substring(0,2).toUpperCase(), avatarColor: '#0E3460', direction: 'DPE', password: pwdTrim }
    : null
  );

  if (!sessionUser) {
    return NextResponse.json({ error: 'Identifiants incorrects.' }, { status: 401 });
  }

  const token = await signToken({ role: sessionUser.role, id: sessionUser.id, email: sessionUser.email });

  const res = NextResponse.json({
    user: {
      id: sessionUser.id,
      prenom: sessionUser.prenom,
      nom: sessionUser.nom,
      email: sessionUser.email,
      role: sessionUser.role,
      direction: sessionUser.direction,
      initials: sessionUser.initials,
      avatarColor: sessionUser.avatarColor,
      poste: (sessionUser as { poste?: string }).poste,
      departement: (sessionUser as { departement?: string }).departement,
      cellule: (sessionUser as { cellule?: string }).cellule,
    }
  });

  res.cookies.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });

  return res;
}
