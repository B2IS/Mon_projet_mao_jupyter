import { Module } from '@nestjs/common';
import { ProjetController } from './projet.controller';
import { OrganisationModule } from '../organisation/organisation.module';

@Module({
  imports: [OrganisationModule],
  controllers: [ProjetController],
  providers: [],
})
export class ProjetModule {}
