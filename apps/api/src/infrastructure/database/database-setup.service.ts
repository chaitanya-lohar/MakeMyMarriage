import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';
import { AppConfig } from '../../config/app-config.js';
import { createDatabaseIndexes, migrateDatabase } from './database-setup.js';

/**
 * Local development and tests only (Database Design §30): at start-up, runs the pending data
 * migrations and then creates the indexes, in that order. Mongoose's own automatic index
 * build is off everywhere, because it would start as soon as a model is registered — before
 * a migration could write the data an index depends on. Staging and production run
 * `db:migrate` and then `db:indexes` instead, before deploying the new code.
 */
@Injectable()
export class DatabaseSetupService implements OnModuleInit {
  private readonly logger = new Logger('DatabaseSetup');

  constructor(
    private readonly config: AppConfig,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.config.mongo.autoIndex) return;
    const log = (message: string) => this.logger.log(message);
    await migrateDatabase(this.connection, log);
    await createDatabaseIndexes(this.connection, (message) => this.logger.debug(message));
  }
}
