import { MongoMemoryReplSet } from 'mongodb-memory-server';

/**
 * Integration-test infrastructure:
 * - MongoDB: an in-memory single-node replica set per test file (transactions work).
 * - Redis: a real server from REDIS_URL. Defaults to database 15 on localhost so
 *   tests never share keys or queues with a locally running dev worker.
 */
export const TEST_REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379/15';

export interface TestEnvironment {
  mongo: MongoMemoryReplSet;
  stop(): Promise<void>;
}

export async function startTestEnvironment(
  overrides: Record<string, string> = {},
): Promise<TestEnvironment> {
  const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });

  Object.assign(process.env, {
    NODE_ENV: 'test',
    APP_ENV: 'test',
    MONGODB_URI: mongo.getUri('makemymarriage_test'),
    REDIS_URL: TEST_REDIS_URL,
    LOG_LEVEL: 'silent',
    OPENAPI_DOCS_ENABLED: 'false',
    JWT_ACCESS_SECRET: 'integration-test-secret-at-least-32-characters',
    ...overrides,
  });

  return {
    mongo,
    stop: async () => {
      await mongo.stop();
    },
  };
}
