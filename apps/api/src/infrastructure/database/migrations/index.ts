import { ownerSeatsMigration } from './001-owner-seats.js';
import type { Migration } from './migration.js';

/** Every data migration, in order (Database Design §30). Append only; never reorder. */
export const MIGRATIONS: readonly Migration[] = [ownerSeatsMigration];

export { MigrationDataError, type Migration } from './migration.js';
export { pendingMigrations, runPendingMigrations, SCHEMA_MIGRATIONS } from './migration-runner.js';
