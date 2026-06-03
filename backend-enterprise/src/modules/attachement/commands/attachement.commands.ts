export class SubmitAttachementCommand {
  constructor(public readonly id: string, public readonly userId: string) {}
}
export class ValidateAttachementCommand {
  constructor(public readonly id: string, public readonly userId: string,
              public readonly ajustements?: { ligneId: string; qteValidee: number }[]) {}
}
export class RejectAttachementCommand {
  constructor(public readonly id: string, public readonly userId: string, public readonly motif: string) {}
}
