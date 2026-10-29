import type { mongo } from 'mongoose';

/**
 * A versioned data migration (Database Design §30). Migrations work on the raw collections,
 * not on the current schemas, so they keep meaning what they meant when they were written.
 * `up` must be safe to run again, and must check before it writes: when the data is
 * inconsistent it throws MigrationDataError and changes nothing.
 */
export interface Migration {
  /** `NNN-kebab-name`; the `_id` of its `schema_migrations` record. Never renamed. */
  readonly name: string;
  up(db: mongo.Db, log: (message: string) => void): Promise<void>;
}

/** Inconsistent data found by a migration: every case is reported, nothing was changed. */
export class MigrationDataError extends Error {
  constructor(
    readonly migration: string,
    readonly problems: readonly string[],
  ) {
    super(
      `Migration ${migration} stopped without changing anything: ${problems.length} ` +
        `inconsistent case(s) must be resolved by hand (decision 0004):\n` +
        problems.map((problem) => `  - ${problem}`).join('\n'),
    );
    this.name = 'MigrationDataError';
  }
}
