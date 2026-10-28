import type { mongo } from 'mongoose';
import type { Migration } from './migration.js';

export const SCHEMA_MIGRATIONS = 'schema_migrations';

/** One `schema_migrations` record: the migration's name and when it completed. */
interface SchemaMigrationRecord {
  _id: string;
  appliedAt: Date;
}

const NAME = /^\d{3}-[a-z0-9]+(?:-[a-z0-9]+)*$/;

function checkOrder(migrations: readonly Migration[]): void {
  migrations.forEach((migration, index) => {
    if (!NAME.test(migration.name)) throw new Error(`Invalid migration name ${migration.name}`);
    const previous = migrations[index - 1];
    if (previous && previous.name >= migration.name) {
      throw new Error(`Migrations out of order: ${previous.name} before ${migration.name}`);
    }
  });
}

/** The migrations not yet recorded in `schema_migrations`, in order. */
export async function pendingMigrations(
  db: mongo.Db,
  migrations: readonly Migration[],
): Promise<Migration[]> {
  checkOrder(migrations);
  const applied = await db
    .collection<SchemaMigrationRecord>(SCHEMA_MIGRATIONS)
    .find({}, { projection: { _id: 1 } })
    .toArray();
  const done = new Set(applied.map((record) => record._id));
  return migrations.filter((migration) => !done.has(migration.name));
}

/**
 * Runs the pending migrations in order (Database Design §30) and records each one when it
 * completes, so it runs once and a re-run is safe. The first failure stops the run; the
 * failed migration and those after it stay pending.
 */
export async function runPendingMigrations(
  db: mongo.Db,
  migrations: readonly Migration[],
  log: (message: string) => void,
): Promise<string[]> {
  const pending = await pendingMigrations(db, migrations);
  for (const migration of pending) {
    log(`${migration.name}: running`);
    await migration.up(db, (message) => log(`${migration.name}: ${message}`));
    await db
      .collection<SchemaMigrationRecord>(SCHEMA_MIGRATIONS)
      .updateOne(
        { _id: migration.name },
        { $setOnInsert: { appliedAt: new Date() } },
        { upsert: true },
      );
    log(`${migration.name}: applied`);
  }
  return pending.map((migration) => migration.name);
}
