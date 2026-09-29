import { DynamicModule, Module } from '@nestjs/common';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { LoggerModule } from 'nestjs-pino';
import { resolveRequestId } from '../../common/http/request-id.js';
import { AppConfig } from '../../config/app-config.js';

export type ServiceRole = 'api' | 'worker';

interface RoutedRequest extends IncomingMessage {
  route?: { path?: string };
}

/**
 * Structured JSON logging (pino) with request IDs.
 *
 * Request logs record the route *template* (e.g. /api/v1/guest/invitations/:token),
 * never the raw URL, because guest invitation and QR URLs carry secret tokens.
 */
@Module({})
export class LoggingModule {
  static forRoot(service: ServiceRole): DynamicModule {
    return {
      module: LoggingModule,
      imports: [
        LoggerModule.forRootAsync({
          inject: [AppConfig],
          useFactory: (config: AppConfig) => ({
            pinoHttp: {
              level: config.log.level,
              base: { service, env: config.appEnv },
              genReqId: resolveRequestId,
              redact: {
                paths: [
                  'req.headers.authorization',
                  'req.headers.cookie',
                  'res.headers["set-cookie"]',
                ],
                censor: '[REDACTED]',
              },
              serializers: {
                req: (req: { id: unknown; method: string; raw: RoutedRequest }) => ({
                  id: req.id,
                  method: req.method,
                  route: req.raw.route?.path ?? '(unmatched)',
                }),
                res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
              },
              customLogLevel: (_req: IncomingMessage, res: ServerResponse, err?: Error) => {
                if (err || res.statusCode >= 500) return 'error';
                if (res.statusCode >= 400) return 'warn';
                return 'info';
              },
              autoLogging: {
                ignore: (req: IncomingMessage) => req.url?.startsWith('/health/') ?? false,
              },
              ...(config.log.pretty
                ? { transport: { target: 'pino-pretty', options: { singleLine: true } } }
                : {}),
            },
          }),
        }),
      ],
    };
  }
}
