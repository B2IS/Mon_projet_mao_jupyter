import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { OrgScopeService } from '../../common/security/org-scope.service';
import { AbacGuard } from '../../common/security/abac.guard';

/** document — org-scoped : héritage automatique de la sécurité via orgPath. */
@Controller('documents')
@UseGuards(AbacGuard)
export class GedController {
  constructor(private prisma: PrismaService, private scope: OrgScopeService) {}
  @Get()
  async list(@Req() req: any) {
    const where = await this.scope.pathFilter(req.userId);
    return this.prisma.document.findMany({ where, orderBy: { createdAt: 'desc' } });
  }
}
