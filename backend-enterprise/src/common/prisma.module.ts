import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * PrismaModule — @Global : une SEULE instance PrismaService (un seul pool de connexions)
 * partagée par tous les bounded contexts. Évite la multiplication des connexions et
 * garantit un point unique pour la stratégie RLS / transactions.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
