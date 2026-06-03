import { Module } from '@nestjs/common';
import { RisqueController } from './Risque.controller';
import { OrganisationModule } from '../organisation/organisation.module';

@Module({ imports: [OrganisationModule], controllers: [RisqueController], providers: [] })
export class RisqueModule {}
