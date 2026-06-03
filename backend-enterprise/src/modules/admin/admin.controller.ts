import { Body, Controller, Get, Post, Put, Param, Req, UseGuards } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { OrgScopeService } from '../../common/security/org-scope.service';
import { AbacGuard } from '../../common/security/abac.guard';

/**
 * Administration — configuration de la plateforme. Les PERMISSIONS ne sont jamais
 * saisies : elles sont CALCULÉES par l'organisation (poste + affectation). L'admin
 * gère le catalogue (rôles, modules, paramètres) et les délégations (bornées org+durée).
 */
@Controller('admin')
@UseGuards(AbacGuard)
export class AdminController {
  constructor(private prisma: PrismaService, private scope: OrgScopeService) {}

  @Get('roles')     roles()    { return this.prisma.role.findMany({ orderBy: { niveau: 'asc' } }); }
  @Get('modules')   modules()  { return this.prisma.moduleDef.findMany({ orderBy: { ordre: 'asc' } }); }
  @Get('settings')  settings() { return this.prisma.appSetting.findMany(); }

  @Put('settings/:key')
  setSetting(@Param('key') key: string, @Body() b: { value: string; scope?: string }) {
    return this.prisma.appSetting.upsert({
      where: { key }, update: { value: b.value, scope: b.scope ?? 'global' },
      create: { key, value: b.value, scope: b.scope ?? 'global' },
    });
  }

  /** Délégations visibles dans le périmètre org de l'utilisateur. */
  @Get('delegations')
  async delegations(@Req() req: any) {
    const where = await this.scope.pathFilter(req.userId);
    return this.prisma.delegation.findMany({ where, orderBy: { debut: 'desc' } });
  }

  @Post('delegations')
  createDelegation(@Body() b: any) {
    return this.prisma.delegation.create({ data: b });
  }
}
