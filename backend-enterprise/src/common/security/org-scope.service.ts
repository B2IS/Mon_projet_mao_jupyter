import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

/**
 * OrgScopeService — Moteur d'accès organisationnel (ABAC + Org Hierarchy).
 * -----------------------------------------------------------------------------
 * RÈGLE ABSOLUE (prompt) : un utilisateur voit SON unité + ses SOUS-unités,
 * jamais les unités parallèles. Exceptions : DPE et CSE (PMO Central) = tout ;
 * une cellule programme voit son périmètre programme.
 *
 * Tout objet métier portant `orgPath` est filtré par `pathFilter()` → l'héritage
 * de sécurité est automatique (projet caché ⇒ KPI, docs, contrats, IA cachés).
 */
@Injectable()
export class OrgScopeService {
  constructor(private readonly prisma: PrismaService) {}

  /** Chemins organisationnels visibles par l'utilisateur (préfixes de path). */
  async visiblePaths(userId: string): Promise<string[]> {
    const user = await this.prisma.appUser.findUnique({
      where: { id: userId },
      include: { orgUnit: true, affectations: true },
    });
    if (!user) return [];

    // DPE / CSE (PMO Central) → tout le référentiel.
    if (['DPE', 'CSE'].includes(user.orgUnit.code)) {
      const all = await this.prisma.orgUnit.findMany({ select: { path: true } });
      return all.map((o) => o.path);
    }

    // Sinon : mon unité + mes sous-unités + mes affectations secondaires.
    const basePaths = [user.orgUnit.path];
    if (user.affectations.length) {
      const units = await this.prisma.orgUnit.findMany({
        where: { id: { in: user.affectations.map((a) => a.orgUnitId) } },
        select: { path: true },
      });
      basePaths.push(...units.map((u) => u.path));
    }
    return basePaths;
  }

  /**
   * Construit un filtre Prisma sur `orgPath` : l'objet est visible SSI son path
   * est exactement un chemin visible OU une de ses sous-unités (frontière `.`).
   *
   * IMPORTANT (sécurité absolue) : on n'utilise JAMAIS un simple `startsWith(p)`
   * brut, qui ferait fuiter une unité parallèle dont le code serait un préfixe de
   * chaîne (ex. `DEP` ⊀ `DER` ici, mais la frontière `.` rend la règle inviolable
   * quels que soient les codes futurs). Sous-arbre = `path = p` OU `path LIKE p.%`.
   */
  async pathFilter(userId: string): Promise<{ OR: ({ orgPath: string } | { orgPath: { startsWith: string } })[] }> {
    const paths = await this.visiblePaths(userId);
    return {
      OR: paths.flatMap((p) => [{ orgPath: p }, { orgPath: { startsWith: p + '.' } }]),
    };
  }

  /** Un utilisateur peut-il voir un objet donné (par son orgPath) ? Frontière `.` stricte. */
  async canSee(userId: string, orgPath: string): Promise<boolean> {
    const paths = await this.visiblePaths(userId);
    return paths.some((p) => orgPath === p || orgPath.startsWith(p + '.'));
  }

  /** KPI consolidés DPE : réservés Directeur DPE + PMO Central (CSE). */
  async canSeeConsolidated(userId: string): Promise<boolean> {
    const user = await this.prisma.appUser.findUnique({
      where: { id: userId }, include: { orgUnit: true },
    });
    return !!user && ['DPE', 'CSE'].includes(user.orgUnit.code);
  }
}
