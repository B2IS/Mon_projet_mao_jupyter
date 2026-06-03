import { Module } from '@nestjs/common';
import { CoreResolver } from './core.resolver';
import { OrganisationModule } from '../modules/organisation/organisation.module';
@Module({ imports: [OrganisationModule], providers: [CoreResolver] })
export class GraphqlCoreModule {}
