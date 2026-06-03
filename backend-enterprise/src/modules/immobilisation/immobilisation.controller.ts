import { Controller, Get, Param, Req, UseGuards, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { OrgScopeService } from '../../common/security/org-scope.service';
import { AbacGuard } from '../../common/security/abac.guard';
import { AmortissementService } from './amortissement.service';

@Controller('immobilisations')
@UseGuards(AbacGuard)
export class ImmobilisationController {
  constructor(private prisma: PrismaService, private scope: OrgScopeService, private amort: AmortissementService) {}

  @Get()
  async list(@Req() req: any) {
    const where = await this.scope.pathFilter(req.userId);
    return this.prisma.immobilisation.findMany({ where, orderBy: { dateMiseService: 'desc' } });
  }

  @Get(':id/amortissement')
  async plan(@Param('id') id: string, @Req() req: any) {
    const immo = await this.prisma.immobilisation.findUnique({ where: { id } });
    if (!immo) throw new NotFoundException();
    if (!(await this.scope.canSee(req.userId, immo.orgPath))) throw new ForbiddenException();
    return this.amort.plan(Number(immo.valeurAcquisition), immo.dureeAmortissement, immo.dateMiseService ?? undefined);
  }
}
