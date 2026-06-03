import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { OrganisationModule } from '../organisation/organisation.module';
@Module({ imports: [OrganisationModule], controllers: [AdminController], providers: [] })
export class AdminModule {}
