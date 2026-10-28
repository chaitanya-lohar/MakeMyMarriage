import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import mongoose from 'mongoose';
import { AppConfig } from '../../config/app-config.js';
import { DatabaseSetupService } from './database-setup.service.js';
import { TransactionRunner } from './transaction.js';

// Treat query filters as literal values so client input can never smuggle in
// MongoDB operators such as $where or $ne (Database Design §23). Code that needs an
// operator on a trusted value wraps it explicitly with mongoose.trusted().
mongoose.set('sanitizeFilter', true);
mongoose.set('strictQuery', true);

/**
 * MongoDB Atlas connection. Domain modules register their own schemas with
 * MongooseModule.forFeature() and expose data access only through repositories.
 * TransactionRunner is available everywhere for use-cases that span modules.
 * DatabaseSetupService migrates and indexes the database at start-up in local and test.
 */
@Global()
@Module({
  providers: [TransactionRunner, DatabaseSetupService],
  exports: [TransactionRunner],
  imports: [
    MongooseModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        uri: config.mongo.uri,
        // Never Mongoose's automatic build: indexes follow the data migrations
        // (DatabaseSetupService locally and in tests; db:migrate, db:indexes when deployed).
        autoIndex: false,
        autoCreate: config.mongo.autoIndex,
        serverSelectionTimeoutMS: 10_000,
      }),
    }),
  ],
})
export class DatabaseModule {}
