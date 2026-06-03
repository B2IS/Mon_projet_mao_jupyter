import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { OrgScopeService } from '../../common/security/org-scope.service';
import { AbacGuard } from '../../common/security/abac.guard';

/** risque — org-scoped : héritage automatique de la sécurité via orgPath. */
@Controller('risques')
@UseGuards(AbacGuard)
export class RisqueController {
  constructor(private prisma: PrismaService, private scope: OrgScopeService) {}
  @Get()
  async list(@Req() req: any) {
    const where = await this.scope.pathFilter(req.userId);
    return this.prisma.risque.findMany({ where, orderBy: { impact: 'desc' } });
  }
}
