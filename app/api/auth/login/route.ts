import { NextRequest, NextResponse } from 'next/server';
import { findUser } from '@/lib/usersDb';
import { signToken } from '@/lib/jwt';
import { SESSION_COOKIE, SESSION_MAX_AGE } from '@/lib/authTypes';
import {
  checkRateLimit, rateLimitResponse, getClientIp,
  isValidEmail, isValidPassword,
} from '@/lib/apiAuth';

// ── Rate limit : 10 tentatives / 15 min par IP ───────────────────────────────
const RATE_OPTS = { max: 10, windowMs: 15 * 60 * 1000 };

export async function POST(req: NextRequest) {
  // 1. Rate limiting par IP
  const ip = getClientIp(req);
  const rl = checkRateLimit(`login:${ip}`, RATE_OPTS);
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  // 2. Parse body (taille max 4 Ko pour éviter DoS)
  const contentLength = Number(req.headers.get('content-length') ?? 0);
  if (contentLength > 4096) {
    return NextResponse.json({ error: 'Corps de requête trop volumineux.' }, { status: 413 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON invalide.' }, { status: 400 });
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400 });
  }

  const { email, password } = body as Record<string, unknown>;

  // 3. Validation serveur stricte
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: 'Email invalide.' }, { status: 400 });
  }
  if (!isValidPassword(password)) {
    return NextResponse.json({ error: 'Mot de passe invalide (4–128 caractères).' }, { status: 400 });
  }

  const emailLower = email.trim().toLowerCase();
  const pwdTrim    = (password as string).trim();

  // 4. Vérification en base — pas de backdoor domaine
  const found = findUser(emailLower, pwdTrim);
  if (!found) {
    // Délai constant pour éviter les timing attacks
    await new Promise(r => setTimeout(r, 200 + Math.random() * 100));
    return NextResponse.json({ error: 'Identifiants incorrects.' }, { status: 401 });
  }

  // 5. Émission du token
  const token = await signToken({ role: found.role, id: found.id, email: found.email });

  const res = NextResponse.json({
    user: {
      id:          found.id,
      prenom:      found.prenom,
      nom:         found.nom,
      email:       found.email,
      role:        found.role,
      direction:   found.direction,
      initials:    found.initials,
      avatarColor: found.avatarColor,
      poste:       (found as { poste?: string }).poste,
      departement: (found as { departement?: string }).departement,
      cellule:     (found as { cellule?: string }).cellule,
    },
  });

  res.cookies.set({
    name:     SESSION_COOKIE,
    value:    token,
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path:     '/',
    maxAge:   SESSION_MAX_AGE,
  });

  // Reset compteur pour cette IP en cas de succès
  checkRateLimit(`login:${ip}:reset`, { max: 0, windowMs: 1 });

  return res;
}
