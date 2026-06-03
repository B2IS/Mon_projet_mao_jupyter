import { Module } from '@nestjs/common';
import { GedController } from './Ged.controller';
import { OrganisationModule } from '../organisation/organisation.module';

@Module({ imports: [OrganisationModule], controllers: [GedController], providers: [] })
export class GedModule {}
