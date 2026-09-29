import { Injectable, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { createServer, type Server } from 'node:http';
import { PinoLogger } from 'nestjs-pino';
import { AppConfig } from '../config/app-config.js';
import { HealthService } from '../platform/health/health.service.js';

/**
 * Minimal HTTP listener so container platforms can probe the worker, which has no
 * API surface of its own. Serves only /health/live and /health/ready.
 */
@Injectable()
export class WorkerHealthServer implements OnApplicationBootstrap, OnApplicationShutdown {
  private server: Server | undefined;

  constructor(
    private readonly config: AppConfig,
    private readonly health: HealthService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(WorkerHealthServer.name);
  }

  async onApplicationBootstrap(): Promise<void> {
    this.server = createServer((req, res) => {
      const respond = (status: number, body: unknown): void => {
        res.writeHead(status, { 'content-type': 'application/json' });
        res.end(JSON.stringify(body));
      };

      if (req.method !== 'GET') return respond(405, { status: 'error' });
      if (req.url === '/health/live') return respond(200, { status: 'ok' });
      if (req.url === '/health/ready') {
        this.health.readiness().then(
          (report) => respond(report.status === 'ok' ? 200 : 503, report),
          () => respond(503, { status: 'error' }),
        );
        return;
      }
      respond(404, { status: 'error' });
    });

    const port = this.config.worker.healthPort;
    await new Promise<void>((resolve) => this.server?.listen(port, resolve));
    this.logger.info({ port }, 'Worker health server listening');
  }

  async onApplicationShutdown(): Promise<void> {
    const server = this.server;
    if (!server) return;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}
