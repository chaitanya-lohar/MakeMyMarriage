import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { getConnectionToken } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';
import { AppModule } from './app.module.js';
import { migrateDatabase } from './infrastructure/database/database-setup.js';

// Runs the pending data migrations (Database Design §30). Outside local and test the API
// never migrates itself, so run this against Atlas before db:indexes and before deploying
// the code that needs the migration:
//
//   pnpm --filter @makemymarriage/api build
//   MONGODB_URI="<atlas uri>" pnpm --filter @makemymarriage/api db:migrate
//
// Each migration runs once and is recorded in `schema_migrations`; a re-run applies only
// what is pending. A migration that finds inconsistent data stops, lists every case and
// changes nothing; resolve the cases by hand and run it again.
const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'log'] });
const logger = new Logger('DbMigrate');
try {
  const applied = await migrateDatabase(app.get<Connection>(getConnectionToken()), (message) =>
    logger.log(message),
  );
  logger.log(applied.length > 0 ? `applied ${applied.join(', ')}` : 'no pending migrations');
} catch (error) {
  logger.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await app.close();
}
