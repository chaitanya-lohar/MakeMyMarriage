import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WeddingAccessGuard } from './api/wedding-access.guard.js';
import { MembershipsService } from './application/services/memberships.service.js';
import { WeddingMembershipsRepository } from './infrastructure/repositories/wedding-memberships.repository.js';
import {
  WeddingMembershipRecord,
  WeddingMembershipSchema,
} from './infrastructure/schemas/wedding-membership.schema.js';

/** Wedding memberships and the access check for wedding routes (System Design §6). */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WeddingMembershipRecord.name, schema: WeddingMembershipSchema },
    ]),
  ],
  providers: [WeddingMembershipsRepository, MembershipsService, WeddingAccessGuard],
  exports: [MembershipsService, WeddingAccessGuard],
})
export class WorkspaceModule {}
