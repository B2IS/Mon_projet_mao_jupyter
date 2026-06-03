import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { OrgScopeService } from '../../common/security/org-scope.service';
import { AbacGuard } from '../../common/security/abac.guard';

@Controller('uagl')
@UseGuards(AbacGuard)
export class UaglController {
  constructor(private prisma: PrismaService, private scope: OrgScopeService) {}
  private async where(req: any) { return this.scope.pathFilter(req.userId); }

  @Get('missions')     async missions(@Req() r: any)     { return this.prisma.mission.findMany({ where: await this.where(r), orderBy: { dateDepart: 'desc' } }); }
  @Get('vehicules')    async vehicules(@Req() r: any)    { return this.prisma.vehicule.findMany({ where: await this.where(r), orderBy: { immat: 'asc' } }); }
  @Get('pointages')    async pointages(@Req() r: any)    { return this.prisma.pointage.findMany({ where: await this.where(r), orderBy: { date: 'desc' } }); }
  @Get('reservations') async reservations(@Req() r: any) { return this.prisma.reservation.findMany({ where: await this.where(r), orderBy: { debut: 'desc' } }); }
}
