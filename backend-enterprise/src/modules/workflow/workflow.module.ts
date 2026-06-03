import { Module } from '@nestjs/common';
import { WorkflowController } from './workflow.controller';
import { OrganisationModule } from '../organisation/organisation.module';
@Module({ imports: [OrganisationModule], controllers: [WorkflowController], providers: [] })
export class WorkflowModule {}
