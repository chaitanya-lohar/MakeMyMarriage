import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import mongoose from 'mongoose';
import { AppConfig } from '../../config/app-config.js';

// Treat query filters as literal values so client input can never smuggle in
// MongoDB operators such as $where or $ne (Database Design §23). Code that needs an
// operator on a trusted value wraps it explicitly with mongoose.trusted().
mongoose.set('sanitizeFilter', true);
mongoose.set('strictQuery', true);

/**
 * MongoDB Atlas connection. Domain modules register their own schemas with
 * MongooseModule.forFeature() and expose data access only through repositories.
 */
@Module({
  imports: [
    MongooseModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        uri: config.mongo.uri,
        autoIndex: config.mongo.autoIndex,
        autoCreate: config.mongo.autoIndex,
        serverSelectionTimeoutMS: 10_000,
      }),
    }),
  ],
})
export class DatabaseModule {}
