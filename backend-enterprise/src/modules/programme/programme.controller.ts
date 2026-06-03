import { Controller, Get, UseGuards } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { AbacGuard } from '../../common/security/abac.guard';

@Controller('programmes')
@UseGuards(AbacGuard)
export class ProgrammeController {
  constructor(private prisma: PrismaService) {}
  @Get()
  list() { return this.prisma.programme.findMany({ orderBy: { code: 'asc' } }); }
}
