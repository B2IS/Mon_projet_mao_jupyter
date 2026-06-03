import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { OrgScopeService } from '../../common/security/org-scope.service';
import { AbacGuard } from '../../common/security/abac.guard';

/** Référentiel organisationnel — cœur du système (organization-driven). */
@Controller('org')
@UseGuards(AbacGuard)
export class OrganisationController {
  constructor(private prisma: PrismaService, private scope: OrgScopeService) {}

  /** Arbre organisationnel complet (DPE > Direction > Département > Service). */
  @Get('tree')
  async tree() {
    return this.prisma.orgUnit.findMany({ orderBy: { path: 'asc' } });
  }

  /** Mon périmètre : unités visibles par l'utilisateur courant (règle ABAC). */
  @Get('me/scope')
  async myScope(@Req() req: any) {
    const paths = await this.scope.visiblePaths(req.userId);
    const units = await this.prisma.orgUnit.findMany({
      where: { OR: paths.map((p) => ({ path: { startsWith: p } })) },
      orderBy: { path: 'asc' },
    });
    return { userId: req.userId, visiblePaths: paths, units };
  }
}
