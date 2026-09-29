import { Body, Controller, Get, HttpStatus, type INestApplication, Post } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { IsEmail, IsInt, Min } from 'class-validator';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureHttpApp } from '../src/bootstrap/configure-http-app.js';
import { AppException } from '../src/common/errors/app.exception.js';
import { startTestEnvironment, type TestEnvironment } from './support/test-environment.js';

// Test-only fixtures that exercise the global pipeline (validation, envelope, errors).
// They are registered in this test module only and never ship in the application.
class ProbeDto {
  @IsEmail()
  email!: string;

  @IsInt()
  @Min(1)
  count!: number;
}

@Controller('__probe__')
class ProbeController {
  @Post('echo')
  echo(@Body() body: ProbeDto): ProbeDto {
    return body;
  }

  @Get('domain-error')
  domainError(): never {
    throw new AppException({
      code: 'GUEST_EVENT_NOT_FOUND',
      message: 'The requested guest-event relationship was not found.',
      status: HttpStatus.NOT_FOUND,
    });
  }

  @Get('crash')
  crash(): never {
    throw new Error('database password is hunter2');
  }
}

describe('HTTP foundation', () => {
  let env: TestEnvironment;
  let app: INestApplication;

  beforeAll(async () => {
    env = await startTestEnvironment();
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [ProbeController],
    }).compile();
    app = moduleRef.createNestApplication({ bufferLogs: true });
    configureHttpApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    await env?.stop();
  });

  describe('health', () => {
    it('reports liveness outside the /api/v1 prefix without an envelope', async () => {
      const res = await request(app.getHttpServer()).get('/health/live').expect(200);
      expect(res.body).toEqual({ status: 'ok' });
    });

    it('reports readiness of MongoDB and Redis', async () => {
      const res = await request(app.getHttpServer()).get('/health/ready').expect(200);
      expect(res.body).toEqual({ status: 'ok', checks: { mongodb: 'up', redis: 'up' } });
    });
  });

  describe('request IDs', () => {
    it('generates a request ID and returns it in the header and error body', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/unknown-route').expect(404);
      const requestId = res.headers['x-request-id'];
      expect(requestId).toMatch(/^req_[a-f0-9]{32}$/);
      expect(res.body.error.requestId).toBe(requestId);
    });

    it('accepts a well-formed upstream request ID', async () => {
      const res = await request(app.getHttpServer())
        .get('/health/live')
        .set('x-request-id', 'req_fromproxy_12345');
      expect(res.headers['x-request-id']).toBe('req_fromproxy_12345');
    });

    it('replaces a malformed upstream request ID', async () => {
      const res = await request(app.getHttpServer())
        .get('/health/live')
        .set('x-request-id', 'bad id <script>');
      expect(res.headers['x-request-id']).toMatch(/^req_[a-f0-9]{32}$/);
    });
  });

  describe('response envelope', () => {
    it('wraps successful responses in { data, meta }', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/__probe__/echo')
        .send({ email: 'guest@example.com', count: 4 })
        .expect(201);
      expect(res.body.data).toEqual({ email: 'guest@example.com', count: 4 });
      expect(res.body.meta.requestId).toBe(res.headers['x-request-id']);
      expect(new Date(res.body.meta.timestamp).toISOString()).toBe(res.body.meta.timestamp);
    });
  });

  describe('error contract', () => {
    it('reports field-level validation failures', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/__probe__/echo')
        .send({ email: 'not-an-email', count: 0 })
        .expect(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
      expect(Object.keys(res.body.error.details.fields).sort()).toEqual(['count', 'email']);
    });

    it('rejects properties that are not part of the DTO', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/__probe__/echo')
        .send({ email: 'guest@example.com', count: 1, isAdmin: true })
        .expect(400);
      expect(res.body.error.details.fields).toHaveProperty('isAdmin');
    });

    it('rejects malformed JSON bodies', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/__probe__/echo')
        .set('content-type', 'application/json')
        .send('{"email":')
        .expect(400);
      expect(res.body.error.code).toBe('BAD_REQUEST');
    });

    it('renders domain exceptions with their own code', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/__probe__/domain-error')
        .expect(404);
      expect(res.body.error).toMatchObject({
        code: 'GUEST_EVENT_NOT_FOUND',
        message: 'The requested guest-event relationship was not found.',
        details: {},
      });
    });

    it('hides internal details of unexpected errors', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/__probe__/crash').expect(500);
      expect(res.body.error.code).toBe('INTERNAL_ERROR');
      expect(JSON.stringify(res.body)).not.toContain('hunter2');
      expect(res.body.error).not.toHaveProperty('stack');
    });
  });

  it('sets security headers', async () => {
    const res = await request(app.getHttpServer()).get('/health/live');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers).not.toHaveProperty('x-powered-by');
  });
});
