import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { AllExceptionsFilter } from './common/errors/all-exceptions.filter.js';
import { ResponseEnvelopeInterceptor } from './common/http/response-envelope.interceptor.js';
import { createValidationPipe } from './common/http/validation.pipe.js';
import { CoreModule } from './core.module.js';
import { AuthModule } from './modules/auth/index.js';
import { DashboardModule } from './modules/dashboard/index.js';
import { EventsModule } from './modules/events/index.js';
import { ExpensesModule } from './modules/expenses/index.js';
import { GuestsModule } from './modules/guests/index.js';
import { InvitationsModule } from './modules/invitations/index.js';
import { TasksModule } from './modules/tasks/index.js';
import { UsersModule } from './modules/users/index.js';
import { WeddingsModule } from './modules/weddings/index.js';
import { WorkspaceModule } from './modules/workspace/index.js';
import { HealthController } from './platform/health/health.controller.js';
import { HealthModule } from './platform/health/health.module.js';

/**
 * Root module of the HTTP API runtime. Domain modules are imported here as they are
 * implemented. AuthModule makes every route sign-in-only unless marked @Public().
 */
@Module({
  imports: [
    CoreModule.forRoot('api'),
    HealthModule,
    UsersModule,
    AuthModule,
    WorkspaceModule,
    WeddingsModule,
    EventsModule,
    GuestsModule,
    InvitationsModule,
    TasksModule,
    ExpensesModule,
    DashboardModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_PIPE, useFactory: createValidationPipe },
    { provide: APP_INTERCEPTOR, useClass: ResponseEnvelopeInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
