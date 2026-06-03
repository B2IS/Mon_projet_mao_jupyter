import { Module } from '@nestjs/common';
import { MarcheController } from './marche.controller';
import { OrganisationModule } from '../organisation/organisation.module';

@Module({ imports: [OrganisationModule], controllers: [MarcheController], providers: [] })
export class MarcheModule {}
