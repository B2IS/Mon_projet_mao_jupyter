import { Module } from '@nestjs/common';
import { UaglController } from './uagl.controller';
import { OrganisationModule } from '../organisation/organisation.module';
@Module({ imports: [OrganisationModule], controllers: [UaglController], providers: [] })
export class UaglModule {}
