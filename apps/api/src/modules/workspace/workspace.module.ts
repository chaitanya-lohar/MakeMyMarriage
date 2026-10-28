import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditModule } from '../audit/index.js';
import { PermissionGuard } from './api/permission.guard.js';
import { WeddingAccessGuard } from './api/wedding-access.guard.js';
import { MembershipsService } from './application/services/memberships.service.js';
import { PermissionService } from './application/services/permission.service.js';
import { WeddingMembershipsRepository } from './infrastructure/repositories/wedding-memberships.repository.js';
import {
  WeddingMembershipRecord,
  WeddingMembershipSchema,
} from './infrastructure/schemas/wedding-membership.schema.js';

/**
 * Wedding memberships, permission evaluation and the access and permission checks for
 * wedding routes (System Design §6, §7.7).
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WeddingMembershipRecord.name, schema: WeddingMembershipSchema },
    ]),
    AuditModule,
  ],
  providers: [
    WeddingMembershipsRepository,
    MembershipsService,
    PermissionService,
    WeddingAccessGuard,
    PermissionGuard,
  ],
  exports: [MembershipsService, PermissionService, WeddingAccessGuard, PermissionGuard],
})
export class WorkspaceModule {}
