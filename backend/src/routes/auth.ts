import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../../src/config/config';
import { AuthError, ValidationError } from '../../../src/utils/exception';

const router = Router();

interface User {
  id: string;
  initials: string;
  name: string;
  email: string;
  role: string;
  status: string;
  lastLogin: string;
  passwordHash: string;
}

// En production : stocker dans la base de données avec bcrypt
const USERS: User[] = [
  { id: '1', initials: 'AD', name: 'A. Diop',    email: 'a.diop@enertic.sn',    role: 'Administrateur', status: 'active', lastLogin: '15/05/2026 14:25', passwordHash: 'admin123' },
  { id: '2', initials: 'IN', name: 'I. Ndiaye',  email: 'i.ndiaye@enertic.sn',  role: 'Superviseur',    status: 'active', lastLogin: '15/05/2026 14:18', passwordHash: 'admin123' },
  { id: '3', initials: 'MF', name: 'M. Fall',    email: 'm.fall@enertic.sn',    role: 'Opérateur',      status: 'active', lastLogin: '15/05/2026 14:05', passwordHash: 'admin123' },
  { id: '4', initials: 'BS', name: 'B. Sarr',    email: 'b.sarr@enertic.sn',    role: 'Opérateur',      status: 'active', lastLogin: '15/05/2026 13:47', passwordHash: 'admin123' },
  { id: '5', initials: 'FC', name: 'F. Camara',  email: 'f.camara@enertic.sn',  role: 'Analyste',       status: 'active', lastLogin: '15/05/2026 13:31', passwordHash: 'admin123' },
];

router.post('/login', (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return next(new ValidationError('Email et mot de passe requis'));
  }

  const user = USERS.find(u => u.email === email);
  if (!user || user.passwordHash !== password) {
    return next(new AuthError('Identifiants invalides'));
  }

  const payload = { sub: user.id, email: user.email, role: user.role };
  const token   = jwt.sign(payload, config.auth.jwtSecret, { expiresIn: config.auth.jwtExpiresIn as jwt.SignOptions['expiresIn'] });

  const { passwordHash: _, ...safeUser } = user;
  return res.json({ token, user: safeUser });
});

router.get('/users', (_req, res) => {
  res.json({
    total:  24,
    active: 20,
    users:  USERS.map(({ passwordHash: _, ...u }) => u),
    roles: [
      { name: 'Administrateur', users: 3,  permissions: 128, description: 'Accès total au système' },
      { name: 'Superviseur',    users: 6,  permissions: 86,  description: 'Supervision et gestion' },
      { name: 'Opérateur',      users: 10, permissions: 42,  description: 'Exploitation quotidienne' },
      { name: 'Analyste',       users: 3,  permissions: 36,  description: 'Analyse et rapports' },
      { name: 'Invité',         users: 2,  permissions: 8,   description: 'Accès en lecture seule' },
    ],
  });
});

export default router;
