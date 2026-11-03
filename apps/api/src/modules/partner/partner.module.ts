import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MembersModule } from '../members/index.js';
import { UsersModule } from '../users/index.js';
import { WeddingsModule } from '../weddings/index.js';
import { WorkspaceModule } from '../workspace/index.js';
import {
  PartnerController,
  PartnerInvitationResponseController,
} from './api/controllers/partner.controller.js';
import { PartnerService } from './application/services/partner.service.js';
import { PartnerConnectionsRepository } from './infrastructure/repositories/partner-connections.repository.js';
import {
  PartnerConnectionRecord,
  PartnerConnectionSchema,
} from './infrastructure/schemas/partner-connection.schema.js';

/**
 * Partner connection (System Design §6, §8; decision 0038): the partner invitation, the
 * connection and leaving. There is no separate sharing module — partners share the wedding.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PartnerConnectionRecord.name, schema: PartnerConnectionSchema },
    ]),
    WorkspaceModule,
    MembersModule,
    UsersModule,
    WeddingsModule,
  ],
  controllers: [PartnerController, PartnerInvitationResponseController],
  providers: [PartnerService, PartnerConnectionsRepository],
})
export class PartnerModule {}
