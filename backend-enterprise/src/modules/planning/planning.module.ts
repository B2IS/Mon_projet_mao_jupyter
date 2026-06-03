import { Module } from '@nestjs/common';
import { PlanningController } from './planning.controller';
import { EvmService } from './evm.service';
import { OrganisationModule } from '../organisation/organisation.module';

@Module({ imports: [OrganisationModule], controllers: [PlanningController], providers: [EvmService] })
export class PlanningModule {}
