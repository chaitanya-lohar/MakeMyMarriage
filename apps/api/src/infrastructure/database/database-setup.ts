import type { Connection, mongo } from 'mongoose';
import { MIGRATIONS, pendingMigrations, runPendingMigrations } from './migrations/index.js';

type Log = (message: string) => void;

function databaseOf(connection: Connection): mongo.Db {
  if (!connection.db) throw new Error('The MongoDB connection is not open');
  return connection.db;
}

/** Runs the pending data migrations (Database Design §30); returns the names applied. */
export function migrateDatabase(connection: Connection, log: Log): Promise<string[]> {
  return runPendingMigrations(databaseOf(connection), MIGRATIONS, log);
}

/**
 * Creates the missing indexes of every registered model; never drops one. Refuses while a
 * migration is pending, because an index may depend on the data a migration writes — the
 * owner-seat index on the owner-seat backfill (decision 0034).
 */
export async function createDatabaseIndexes(connection: Connection, log: Log): Promise<void> {
  const pending = await pendingMigrations(databaseOf(connection), MIGRATIONS);
  if (pending.length > 0) {
    throw new Error(
      `Run db:migrate first; pending migrations: ${pending.map((m) => m.name).join(', ')}`,
    );
  }
  for (const model of Object.values(connection.models)) {
    await model.createIndexes();
    log(`${model.collection.collectionName}: indexes ready`);
  }
}
