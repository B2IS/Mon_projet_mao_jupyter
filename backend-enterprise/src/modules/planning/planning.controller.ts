import { Controller, Get, Param, Req, UseGuards, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { OrgScopeService } from '../../common/security/org-scope.service';
import { AbacGuard } from '../../common/security/abac.guard';
import { EvmService } from './evm.service';

@Controller('projets/:id/planning')
@UseGuards(AbacGuard)
export class PlanningController {
  constructor(private prisma: PrismaService, private scope: OrgScopeService, private evm: EvmService) {}

  @Get()
  async planning(@Param('id') id: string, @Req() req: any) {
    const projet = await this.prisma.projet.findUnique({ where: { id } });
    if (!projet || !(await this.scope.canSee(req.userId, projet.orgPath))) throw new ForbiddenException();
    const taches = await this.prisma.tache.findMany({ where: { projetId: id }, include: { affectations: true } });
    const evm = this.evm.compute(taches.map((t) => ({
      coutPrevu: Number(t.coutPrevu), coutReel: Number(t.coutReel), avancement: t.avancement,
    })));
    // détection surcharge ressources (Σ allocation > 100)
    const charge: Record<string, number> = {};
    taches.forEach((t) => t.affectations.forEach((a) => { charge[a.ressourceId] = (charge[a.ressourceId] ?? 0) + a.allocation; }));
    const surcharges = Object.entries(charge).filter(([, v]) => v > 100).map(([ressourceId, v]) => ({ ressourceId, charge: v }));
    return { taches, evm, surcharges };
  }
}
