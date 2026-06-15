import type { DefaultSession } from 'next-auth';
import type { RoleCode } from '@/lib/authTypes';

declare module 'next-auth' {
  interface Session {
    user: DefaultSession['user'] & {
      id:           string;
      role:         RoleCode;
      direction?:   string;
      initials?:    string;
      avatarColor?: string;
      prenom?:      string;
      nom?:         string;
      poste?:       string;
      departement?: string;
      cellule?:     string;
    };
  }

  interface User {
    role?:        RoleCode;
    direction?:   string;
    initials?:    string;
    avatarColor?: string;
    prenom?:      string;
    nom?:         string;
    poste?:       string;
    departement?: string;
    cellule?:     string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role?:        RoleCode;
    direction?:   string;
    initials?:    string;
    avatarColor?: string;
    prenom?:      string;
    nom?:         string;
    poste?:       string;
    departement?: string;
    cellule?:     string;
  }
}
