import { Module } from '@nestjs/common';
import { KpiController } from './kpi.controller';
import { OrganisationModule } from '../organisation/organisation.module';
@Module({ imports: [OrganisationModule], controllers: [KpiController], providers: [] })
export class KpiModule {}
