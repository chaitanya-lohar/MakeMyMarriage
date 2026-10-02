import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from '../users/index.js';
import { AccessTokenGuard } from './api/access-token.guard.js';
import { AuthController } from './api/controllers/auth.controller.js';
import { PasswordHasher } from './application/services/password-hasher.service.js';
import { SessionIssuer } from './application/services/session-issuer.service.js';
import { TokenService } from './application/services/token.service.js';
import { LoginUseCase } from './application/use-cases/login.use-case.js';
import { LogoutUseCase } from './application/use-cases/logout.use-case.js';
import { RefreshSessionUseCase } from './application/use-cases/refresh-session.use-case.js';
import { RegisterUseCase } from './application/use-cases/register.use-case.js';
import { RequestPasswordResetUseCase } from './application/use-cases/request-password-reset.use-case.js';
import { ResetPasswordUseCase } from './application/use-cases/reset-password.use-case.js';
import { AuthSessionsRepository } from './infrastructure/repositories/auth-sessions.repository.js';
import { PasswordResetTokensRepository } from './infrastructure/repositories/password-reset-tokens.repository.js';
import {
  AuthSessionRecord,
  AuthSessionSchema,
} from './infrastructure/schemas/auth-session.schema.js';
import {
  PasswordResetTokenRecord,
  PasswordResetTokenSchema,
} from './infrastructure/schemas/password-reset-token.schema.js';

/**
 * Email/password authentication and sessions (decision 0015). Registers the global
 * AccessTokenGuard, so importing this module makes every route sign-in-only by default.
 */
@Module({
  imports: [
    UsersModule,
    MongooseModule.forFeature([
      { name: AuthSessionRecord.name, schema: AuthSessionSchema },
      { name: PasswordResetTokenRecord.name, schema: PasswordResetTokenSchema },
    ]),
  ],
  controllers: [AuthController],
  providers: [
    AuthSessionsRepository,
    PasswordResetTokensRepository,
    PasswordHasher,
    TokenService,
    SessionIssuer,
    RegisterUseCase,
    LoginUseCase,
    RefreshSessionUseCase,
    LogoutUseCase,
    RequestPasswordResetUseCase,
    ResetPasswordUseCase,
    { provide: APP_GUARD, useClass: AccessTokenGuard },
  ],
})
export class AuthModule {}
