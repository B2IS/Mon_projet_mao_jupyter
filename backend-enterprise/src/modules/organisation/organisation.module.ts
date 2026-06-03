import { Module } from '@nestjs/common';
import { OrganisationController } from './organisation.controller';
import { OrgScopeService } from '../../common/security/org-scope.service';

@Module({
  controllers: [OrganisationController],
  providers: [OrgScopeService],
  exports: [OrgScopeService],
})
export class OrganisationModule {}
