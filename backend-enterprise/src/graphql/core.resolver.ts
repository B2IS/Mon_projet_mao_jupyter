import { Args, Query, Resolver, Context } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { OrgScopeService } from '../common/security/org-scope.service';
import { AbacGuard } from '../common/security/abac.guard';
import { OrgUnitGQL, ProjetGQL, KpiGQL, ScopeGQL } from './models';

/**
 * Résolveurs GraphQL ORG-AWARE : appliquent EXACTEMENT la même sécurité que REST/RLS
 * (OrgScopeService). Un objet hors périmètre n'est jamais renvoyé. KPI consolidés = DPE/CSE.
 */
@Resolver()
@UseGuards(AbacGuard)
export class CoreResolver {
  constructor(private prisma: PrismaService, private scope: OrgScopeService) {}

  private uid(ctx: any): string { return ctx?.req?.userId; }

  @Query(() => ScopeGQL)
  async meScope(@Context() ctx: any): Promise<ScopeGQL> {
    const uid = this.uid(ctx);
    return { visiblePaths: await this.scope.visiblePaths(uid), consolide: await this.scope.canSeeConsolidated(uid) };
  }

  @Query(() => [OrgUnitGQL])
  async orgTree(): Promise<OrgUnitGQL[]> {
    return this.prisma.orgUnit.findMany({ orderBy: { path: 'asc' } }) as any;
  }

  @Query(() => [ProjetGQL])
  async projets(@Context() ctx: any, @Args('programme', { nullable: true }) programme?: string): Promise<ProjetGQL[]> {
    const where = await this.scope.pathFilter(this.uid(ctx));
    const full = programme ? { AND: [where, { programme }] } : where;
    return this.prisma.projet.findMany({ where: full, orderBy: { createdAt: 'desc' } }) as any;
  }

  @Query(() => [KpiGQL])
  async kpi(@Context() ctx: any): Promise<KpiGQL[]> {
    const uid = this.uid(ctx);
    const org = await this.scope.pathFilter(uid);
    const where = (await this.scope.canSeeConsolidated(uid)) ? org : { AND: [org, { consolide: false }] };
    return this.prisma.kpi.findMany({ where, orderBy: { code: 'asc' } }) as any;
  }
}
