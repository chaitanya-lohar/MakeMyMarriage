import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { getConnectionToken } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';
import { AppModule } from './app.module.js';

// Creates the indexes of every collection (decision 0025). Outside local and test the API
// never builds indexes itself, so run this against Atlas before the first deployment and after
// any index change:
//
//   pnpm --filter @makemymarriage/api build
//   MONGODB_URI="<atlas uri>" pnpm --filter @makemymarriage/api db:indexes
//
// It only creates missing indexes; it never drops one.
const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'log'] });
const logger = new Logger('DbIndexes');
try {
  const connection = app.get<Connection>(getConnectionToken());
  for (const model of Object.values(connection.models)) {
    await model.createIndexes();
    logger.log(`${model.collection.collectionName}: indexes ready`);
  }
} finally {
  await app.close();
}
