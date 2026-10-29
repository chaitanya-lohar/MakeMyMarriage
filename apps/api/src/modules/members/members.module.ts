import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/index.js';
import { UsersModule } from '../users/index.js';
import { WeddingsModule } from '../weddings/index.js';
import { WorkspaceModule } from '../workspace/index.js';
import { MembersController } from './api/controllers/members.controller.js';
import { MembersService } from './application/services/members.service.js';

/**
 * Organizer and permission management (System Design §6, §7; decision 0034): the member
 * directory, roles and custom permissions, removal and the audit history.
 */
@Module({
  imports: [WorkspaceModule, UsersModule, WeddingsModule, AuditModule],
  controllers: [MembersController],
  providers: [MembersService],
  exports: [MembersService],
})
export class MembersModule {}
