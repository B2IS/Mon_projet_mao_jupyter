import { Module } from '@nestjs/common';
import { FinanceController } from './finance.controller';
import { OrganisationModule } from '../organisation/organisation.module';
@Module({ imports: [OrganisationModule], controllers: [FinanceController], providers: [] })
export class FinanceModule {}
