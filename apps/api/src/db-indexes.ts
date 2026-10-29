import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { getConnectionToken } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';
import { AppModule } from './app.module.js';
import { createDatabaseIndexes } from './infrastructure/database/database-setup.js';

// Creates the indexes of every collection (decision 0025). Outside local and test the API
// never builds indexes itself, so run this against Atlas before the first deployment and after
// any index change — always after db:migrate (Database Design §30):
//
//   pnpm --filter @makemymarriage/api build
//   MONGODB_URI="<atlas uri>" pnpm --filter @makemymarriage/api db:migrate
//   MONGODB_URI="<atlas uri>" pnpm --filter @makemymarriage/api db:indexes
//
// It only creates missing indexes; it never drops one. It refuses while a migration is
// pending, since an index may depend on the data a migration writes.
const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'log'] });
const logger = new Logger('DbIndexes');
try {
  await createDatabaseIndexes(app.get<Connection>(getConnectionToken()), (message) =>
    logger.log(message),
  );
} finally {
  await app.close();
}
