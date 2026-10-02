import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MeController } from './api/controllers/me.controller.js';
import { UsersService } from './application/services/users.service.js';
import { UsersRepository } from './infrastructure/repositories/users.repository.js';
import { UserRecord, UserSchema } from './infrastructure/schemas/user.schema.js';

/** User accounts (Database Design §6.1) and the current-user endpoint. */
@Module({
  imports: [MongooseModule.forFeature([{ name: UserRecord.name, schema: UserSchema }])],
  controllers: [MeController],
  providers: [UsersRepository, UsersService],
  exports: [UsersService],
})
export class UsersModule {}
