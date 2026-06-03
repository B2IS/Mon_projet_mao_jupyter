import { Module } from '@nestjs/common';
import { ImmobilisationController } from './immobilisation.controller';
import { AmortissementService } from './amortissement.service';
import { OrganisationModule } from '../organisation/organisation.module';
@Module({ imports: [OrganisationModule], controllers: [ImmobilisationController], providers: [AmortissementService] })
export class ImmobilisationModule {}
