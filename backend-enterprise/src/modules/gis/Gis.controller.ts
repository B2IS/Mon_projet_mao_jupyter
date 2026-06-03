import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { OrgScopeService } from '../../common/security/org-scope.service';
import { AbacGuard } from '../../common/security/abac.guard';

/** site — org-scoped : héritage automatique de la sécurité via orgPath. */
@Controller('sites')
@UseGuards(AbacGuard)
export class GisController {
  constructor(private prisma: PrismaService, private scope: OrgScopeService) {}
  @Get()
  async list(@Req() req: any) {
    const where = await this.scope.pathFilter(req.userId);
    return this.prisma.site.findMany({ where, orderBy: { nom: 'asc' } });
  }
}
