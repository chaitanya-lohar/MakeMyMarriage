import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { AllExceptionsFilter } from './common/errors/all-exceptions.filter.js';
import { ResponseEnvelopeInterceptor } from './common/http/response-envelope.interceptor.js';
import { createValidationPipe } from './common/http/validation.pipe.js';
import { CoreModule } from './core.module.js';
import { HealthController } from './platform/health/health.controller.js';
import { HealthModule } from './platform/health/health.module.js';

/**
 * Root module of the HTTP API runtime. Domain modules (Auth, Weddings, …) are
 * imported here as they are implemented.
 */
@Module({
  imports: [CoreModule.forRoot('api'), HealthModule],
  controllers: [HealthController],
  providers: [
    { provide: APP_PIPE, useFactory: createValidationPipe },
    { provide: APP_INTERCEPTOR, useClass: ResponseEnvelopeInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
