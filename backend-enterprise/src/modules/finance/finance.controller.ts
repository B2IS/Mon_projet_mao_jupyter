import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { OrgScopeService } from '../../common/security/org-scope.service';
import { AbacGuard } from '../../common/security/abac.guard';

@Controller('finances')
@UseGuards(AbacGuard)
export class FinanceController {
  constructor(private prisma: PrismaService, private scope: OrgScopeService) {}

  @Get('budgets')
  async budgets(@Req() req: any) {
    const where = await this.scope.pathFilter(req.userId);
    return this.prisma.budget.findMany({ where, orderBy: { annee: 'desc' } });
  }

  @Get('decaissements')
  async decaissements(@Req() req: any) {
    const where = await this.scope.pathFilter(req.userId);
    return this.prisma.decaissement.findMany({ where, orderBy: { date: 'desc' } });
  }

  /** Cashflow agrégé sur le périmètre visible (dotation / engagé / décaissé). */
  @Get('cashflow')
  async cashflow(@Req() req: any) {
    const where = await this.scope.pathFilter(req.userId);
    const budgets = await this.prisma.budget.findMany({ where });
    const tot = (k: 'dotation' | 'engage' | 'decaisse') =>
      Math.round(budgets.reduce((s, b) => s + Number(b[k]), 0));
    const dotation = tot('dotation'), engage = tot('engage'), decaisse = tot('decaisse');
    return {
      dotation, engage, decaisse,
      disponible: dotation - engage,
      tauxEngagement: dotation ? +(engage / dotation * 100).toFixed(1) : 0,
      tauxDecaissement: dotation ? +(decaisse / dotation * 100).toFixed(1) : 0,
    };
  }
}
