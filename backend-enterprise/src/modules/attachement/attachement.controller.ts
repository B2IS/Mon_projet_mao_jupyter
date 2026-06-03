import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { PrismaService } from '../../common/prisma.service';
import { OrgScopeService } from '../../common/security/org-scope.service';
import { AbacGuard } from '../../common/security/abac.guard';
import { SubmitAttachementCommand, ValidateAttachementCommand, RejectAttachementCommand } from './commands/attachement.commands';

/** Montant réalisé = Σ (qteValidee ?? qteRealisee) × prixUnitaire. */
function montant(lignes: any[]): number {
  return Math.round(lignes.reduce((s, l) => s + Number(l.qteValidee ?? l.qteRealisee) * Number(l.prixUnitaire), 0));
}

@Controller('attachements')
@UseGuards(AbacGuard)
export class AttachementController {
  constructor(private prisma: PrismaService, private scope: OrgScopeService, private bus: CommandBus) {}

  @Get()
  async list(@Req() req: any) {
    const where = await this.scope.pathFilter(req.userId);
    const items = await this.prisma.attachementPaiement.findMany({ where, include: { lignes: true } });
    return items.map((a) => ({ ...a, montant: montant(a.lignes) }));
  }

  @Post(':id/submit')
  submit(@Param('id') id: string, @Req() req: any) {
    return this.bus.execute(new SubmitAttachementCommand(id, req.userId));
  }

  @Post(':id/validate')
  validate(@Param('id') id: string, @Req() req: any, @Body() body: { ajustements?: { ligneId: string; qteValidee: number }[] }) {
    return this.bus.execute(new ValidateAttachementCommand(id, req.userId, body?.ajustements));
  }

  @Post(':id/reject')
  reject(@Param('id') id: string, @Req() req: any, @Body() body: { motif: string }) {
    return this.bus.execute(new RejectAttachementCommand(id, req.userId, body?.motif));
  }
}
