import { Body, Controller, Get, Param, Post, Req, UseGuards, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { OrgScopeService } from '../../common/security/org-scope.service';
import { AbacGuard } from '../../common/security/abac.guard';
import { AGENTS } from './agents.registry';

/**
 * AI Center — agents org-secured. Chaque agent ne raisonne que sur le périmètre
 * autorisé du demandeur : on calcule visiblePaths() et on restreint le contexte RAG.
 * (Le LLM/LangGraph/RAG est branché côté infra ; ici = orchestration + sécurité.)
 */
@Controller('ai')
@UseGuards(AbacGuard)
export class AiController {
  constructor(private prisma: PrismaService, private scope: OrgScopeService) {}

  @Get('agents')
  agents() { return AGENTS.map(({ key, label }) => ({ key, label })); }

  @Post('agents/:agent/ask')
  async ask(@Param('agent') agent: string, @Req() req: any, @Body() body: { question: string }) {
    const def = AGENTS.find((a) => a.key === agent);
    if (!def) throw new NotFoundException('agent inconnu');
    if (def.consolidated && !(await this.scope.canSeeConsolidated(req.userId)))
      throw new ForbiddenException('agent consolidé réservé DPE/PMO');
    // Contexte RAG borné par la sécurité organisationnelle :
    const paths = await this.scope.visiblePaths(req.userId);
    const contextDocs = await this.prisma.document.findMany({
      where: { OR: paths.map((p) => ({ orgPath: { startsWith: p } })) }, take: 20, select: { id: true, nom: true, ocrText: true },
    });
    return {
      agent: def.label,
      scope: paths,
      retrieved: contextDocs.length,
      answer: `[${def.label}] réponse ancrée sur ${contextDocs.length} document(s) de votre périmètre. (Brancher LangGraph/RAG ici — la sécurité org est déjà appliquée.)`,
      question: body?.question,
    };
  }

  /** Migration IA (HITL) : extraction → proposition de fiche projet, validation humaine requise. */
  @Post('migration/analyze')
  async migration(@Body() body: { filename: string; text?: string }) {
    return {
      statut: 'proposition',
      requiresHumanValidation: true,
      detected: { direction: null, departement: null, programme: null, bailleur: null },
      proposition: { ficheProjet: {}, wbs: [], planning: [], budget: [], risques: [], kpi: [] },
      note: 'Extraction OCR/NLP à brancher (pipeline AI Engine). Validation humaine obligatoire avant création.',
    };
  }
}
