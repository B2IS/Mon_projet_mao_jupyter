import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { AttachementController } from './attachement.controller';
import { AttachementHandlers } from './commands/attachement.handlers';
import { OrganisationModule } from '../organisation/organisation.module';

@Module({
  imports: [CqrsModule, OrganisationModule],
  controllers: [AttachementController],
  providers: [...AttachementHandlers],
})
export class AttachementModule {}
