import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { OrganisationModule } from '../organisation/organisation.module';
@Module({ imports: [OrganisationModule], controllers: [AiController], providers: [] })
export class AiModule {}
