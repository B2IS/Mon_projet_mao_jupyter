import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { OrgScopeService } from '../../common/security/org-scope.service';
import { AbacGuard } from '../../common/security/abac.guard';

/**
 * KPI — double filtre : (1) org (pathFilter) ; (2) les KPI `consolide=true`
 * (indicateurs énergie consolidés DPE) ne sont visibles que par DPE/CSE.
 */
@Controller('kpi')
@UseGuards(AbacGuard)
export class KpiController {
  constructor(private prisma: PrismaService, private scope: OrgScopeService) {}

  @Get()
  async list(@Req() req: any) {
    const orgWhere = await this.scope.pathFilter(req.userId);
    const consolidated = await this.scope.canSeeConsolidated(req.userId);
    const where = consolidated ? orgWhere : { AND: [orgWhere, { consolide: false }] };
    return this.prisma.kpi.findMany({ where, orderBy: { code: 'asc' } });
  }
}
