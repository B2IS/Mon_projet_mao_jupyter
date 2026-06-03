import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma.service';
import { OrgScopeService } from '../../../common/security/org-scope.service';
import { SubmitAttachementCommand, ValidateAttachementCommand, RejectAttachementCommand } from './attachement.commands';

async function guard(prisma: PrismaService, scope: OrgScopeService, id: string, userId: string) {
  const att = await prisma.attachementPaiement.findUnique({ where: { id } });
  if (!att) throw new NotFoundException();
  if (!(await scope.canSee(userId, att.orgPath))) throw new ForbiddenException('Hors périmètre organisationnel');
  return att;
}

@CommandHandler(SubmitAttachementCommand)
export class SubmitHandler implements ICommandHandler<SubmitAttachementCommand> {
  constructor(private prisma: PrismaService, private scope: OrgScopeService) {}
  async execute(c: SubmitAttachementCommand) {
    await guard(this.prisma, this.scope, c.id, c.userId);
    // Domain event « AttachementSoumis » → à publier (outbox) pour workflow Camunda.
    return this.prisma.attachementPaiement.update({
      where: { id: c.id },
      data: { statut: 'soumis', soumisPar: c.userId, dateSoumission: new Date() },
    });
  }
}

@CommandHandler(ValidateAttachementCommand)
export class ValidateHandler implements ICommandHandler<ValidateAttachementCommand> {
  constructor(private prisma: PrismaService, private scope: OrgScopeService) {}
  async execute(c: ValidateAttachementCommand) {
    await guard(this.prisma, this.scope, c.id, c.userId);
    for (const a of c.ajustements ?? []) {
      await this.prisma.attachementLigne.update({ where: { id: a.ligneId }, data: { qteValidee: a.qteValidee } });
    }
    return this.prisma.attachementPaiement.update({
      where: { id: c.id }, data: { statut: 'valide', validePar: c.userId },
    });
  }
}

@CommandHandler(RejectAttachementCommand)
export class RejectHandler implements ICommandHandler<RejectAttachementCommand> {
  constructor(private prisma: PrismaService, private scope: OrgScopeService) {}
  async execute(c: RejectAttachementCommand) {
    await guard(this.prisma, this.scope, c.id, c.userId);
    return this.prisma.attachementPaiement.update({
      where: { id: c.id }, data: { statut: 'rejete', motifRejet: c.motif },
    });
  }
}

export const AttachementHandlers = [SubmitHandler, ValidateHandler, RejectHandler];
