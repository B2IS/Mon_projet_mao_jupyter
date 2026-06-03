import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { OrgScopeService } from '../../common/security/org-scope.service';
import { AbacGuard } from '../../common/security/abac.guard';

/**
 * Projets — HÉRITENT de la sécurité organisationnelle : un projet n'est renvoyé
 * que si son orgPath appartient au périmètre de l'utilisateur (filtrage automatique).
 * Si un projet est caché, ses KPI/docs/contrats/IA le sont aussi (même filtre).
 */
@Controller('projets')
@UseGuards(AbacGuard)
export class ProjetController {
  constructor(private prisma: PrismaService, private scope: OrgScopeService) {}

  @Get()
  async list(@Req() req: any) {
    const filter = await this.scope.pathFilter(req.userId);
    return this.prisma.projet.findMany({ where: filter, orderBy: { createdAt: 'desc' } });
  }
}
