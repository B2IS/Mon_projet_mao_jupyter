import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { OrgScopeService } from '../../common/security/org-scope.service';
import { AbacGuard } from '../../common/security/abac.guard';

/**
 * Low-Code Studio — création sans développement de formulaires, dashboards et
 * rapports (schémas JSON). Les définitions portant un orgPath héritent de la
 * sécurité org ; celles à orgPath null sont globales (catalogue partagé).
 */
@Controller('lowcode')
@UseGuards(AbacGuard)
export class LowcodeController {
  constructor(private prisma: PrismaService, private scope: OrgScopeService) {}

  /** Visible si global (orgPath null) OU dans le périmètre de l'utilisateur. */
  private async scoped(req: any) {
    const f = await this.scope.pathFilter(req.userId);
    return { OR: [{ orgPath: null }, ...f.OR] };
  }

  @Get('forms')       async forms(@Req() r: any)      { return this.prisma.formDef.findMany({ where: await this.scoped(r) }); }
  @Post('forms')      createForm(@Body() b: any)      { return this.prisma.formDef.create({ data: b }); }
  @Get('dashboards')  async dashboards(@Req() r: any) { return this.prisma.dashboardDef.findMany({ where: await this.scoped(r) }); }
  @Post('dashboards') createDashboard(@Body() b: any) { return this.prisma.dashboardDef.create({ data: b }); }
  @Get('reports')     async reports(@Req() r: any)    { return this.prisma.reportDef.findMany({ where: await this.scoped(r) }); }
  @Post('reports')    createReport(@Body() b: any)    { return this.prisma.reportDef.create({ data: b }); }
}
