import { Module } from '@nestjs/common';
import { LowcodeController } from './lowcode.controller';
import { OrganisationModule } from '../organisation/organisation.module';
@Module({ imports: [OrganisationModule], controllers: [LowcodeController], providers: [] })
export class LowcodeModule {}
