import { Module } from '@nestjs/common';
import { GisController } from './Gis.controller';
import { OrganisationModule } from '../organisation/organisation.module';

@Module({ imports: [OrganisationModule], controllers: [GisController], providers: [] })
export class GisModule {}
