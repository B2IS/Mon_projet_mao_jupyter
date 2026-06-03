import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { OrgScopeService } from '../../common/security/org-scope.service';
import { AbacGuard } from '../../common/security/abac.guard';

@Controller('marches')
@UseGuards(AbacGuard)
export class MarcheController {
  constructor(private prisma: PrismaService, private scope: OrgScopeService) {}

  /** Tous les marchés visibles par l'utilisateur (héritage de sécurité via orgPath). */
  @Get()
  async list(@Req() req: any) {
    const where = await this.scope.pathFilter(req.userId);
    return this.prisma.marche.findMany({ where, orderBy: { numero: 'asc' } });
  }
}
