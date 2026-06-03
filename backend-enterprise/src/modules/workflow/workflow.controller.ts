import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { OrgScopeService } from '../../common/security/org-scope.service';
import { AbacGuard } from '../../common/security/abac.guard';

/**
 * Workflows (Camunda 8) — défs versionnées ; les instances héritent de la sécurité
 * via orgPath ; candidateGroup dérivé de l'organisation + rôle d'étape.
 */
@Controller('workflows')
@UseGuards(AbacGuard)
export class WorkflowController {
  constructor(private prisma: PrismaService, private scope: OrgScopeService) {}

  @Get('definitions')
  defs() { return this.prisma.workflowDef.findMany({ where: { actif: true }, orderBy: [{ cle: 'asc' }, { version: 'desc' }] }); }

  // ── Workflow Studio : créer / versionner / simuler (configurable, versionné, auditable) ──

  /** Créer une définition (ou première version d'une clé). */
  @Post('definitions')
  createDef(@Body() b: { cle: string; libelle: string; bpmnXml?: string }) {
    return this.prisma.workflowDef.create({ data: { cle: b.cle, libelle: b.libelle, bpmnXml: b.bpmnXml, version: 1 } });
  }

  /** Publier une NOUVELLE VERSION d'une clé existante (versioning immuable). */
  @Post('definitions/:cle/version')
  async newVersion(@Param('cle') cle: string, @Body() b: { libelle?: string; bpmnXml?: string }) {
    const last = await this.prisma.workflowDef.findFirst({ where: { cle }, orderBy: { version: 'desc' } });
    return this.prisma.workflowDef.create({
      data: { cle, libelle: b.libelle ?? last?.libelle ?? cle, bpmnXml: b.bpmnXml ?? last?.bpmnXml, version: (last?.version ?? 0) + 1 },
    });
  }

  /** Simulation à blanc : déroule les étapes sans persister d'instance. */
  @Post('definitions/:cle/simulate')
  async simulate(@Param('cle') cle: string) {
    const def = await this.prisma.workflowDef.findFirst({ where: { cle, actif: true }, orderBy: { version: 'desc' } });
    if (!def) return { error: 'workflow_def introuvable' };
    const etapes = ['besoin', 'opportunite', 'aps', 'apd', 'bit', 'dao', 'ao', 'contrat', 'execution', 'reception', 'immobilisation', 'cloture'];
    return { cle, version: def.version, simulation: etapes.map((e, i) => ({ ordre: i + 1, etape: e })) };
  }

  @Get('instances')
  async instances(@Req() req: any) {
    const where = await this.scope.pathFilter(req.userId);
    return this.prisma.workflowInstance.findMany({ where, orderBy: { createdAt: 'desc' } });
  }

  /** Instancier un process (à brancher sur Zeebe/Camunda 8 : createProcessInstance). */
  @Post(':cle/start')
  async start(@Param('cle') cle: string, @Req() req: any, @Body() body: { objetType: string; objetId: string; orgPath: string }) {
    const def = await this.prisma.workflowDef.findFirst({ where: { cle, actif: true }, orderBy: { version: 'desc' } });
    if (!def) return { error: 'workflow_def introuvable' };
    return this.prisma.workflowInstance.create({
      data: { defId: def.id, orgPath: body.orgPath, objetType: body.objetType, objetId: body.objetId, etape: 'demarrage' },
    });
  }
}
