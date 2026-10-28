import type { mongo } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';
import { MigrationDataError, type Migration } from './migration.js';
import { pendingMigrations, runPendingMigrations } from './migration-runner.js';

/** A `schema_migrations` collection in memory — all the runner touches. */
function fakeDb(applied: string[] = []) {
  const records = new Map(applied.map((name) => [name, new Date()]));
  const db = {
    collection: () => ({
      find: () => ({
        toArray: () => Promise.resolve([...records.keys()].map((_id) => ({ _id }))),
      }),
      updateOne: (filter: { _id: string }) => {
        if (!records.has(filter._id)) records.set(filter._id, new Date());
        return Promise.resolve();
      },
    }),
  } as unknown as mongo.Db;
  return { db, records };
}

/** A migration whose `up` is a spy, returned separately so tests never detach a method. */
function migration(name: string, run: Migration['up'] = () => Promise.resolve()) {
  const up = vi.fn(run);
  return { migration: { name, up } satisfies Migration, up };
}

const silent = () => {};

describe('migration runner (Database Design §30)', () => {
  it('runs pending migrations in order and records each', async () => {
    const order: string[] = [];
    const { migration: first } = migration('001-first', () => {
      order.push('001');
      return Promise.resolve();
    });
    const { migration: second } = migration('002-second', () => {
      order.push('002');
      return Promise.resolve();
    });
    const { db, records } = fakeDb();

    await expect(runPendingMigrations(db, [first, second], silent)).resolves.toEqual([
      '001-first',
      '002-second',
    ]);
    expect(order).toEqual(['001', '002']);
    expect([...records.keys()]).toEqual(['001-first', '002-second']);
  });

  it('skips recorded migrations, so a re-run is safe', async () => {
    const { migration: first, up } = migration('001-first');
    const { db } = fakeDb(['001-first']);
    await expect(runPendingMigrations(db, [first], silent)).resolves.toEqual([]);
    expect(up).not.toHaveBeenCalled();
  });

  it('stops at a failure and leaves it and the later ones pending', async () => {
    const { migration: failing } = migration('001-first', () =>
      Promise.reject(new MigrationDataError('001-first', ['a problem'])),
    );
    const { migration: later, up: laterUp } = migration('002-second');
    const { db, records } = fakeDb();

    await expect(runPendingMigrations(db, [failing, later], silent)).rejects.toThrow(
      /001-first stopped without changing anything: 1 inconsistent case/,
    );
    expect(laterUp).not.toHaveBeenCalled();
    expect(records.size).toBe(0);
    expect((await pendingMigrations(db, [failing, later])).map((m) => m.name)).toEqual([
      '001-first',
      '002-second',
    ]);
  });

  it('refuses badly named or unordered migrations', async () => {
    const { db } = fakeDb();
    await expect(pendingMigrations(db, [migration('owner-seats').migration])).rejects.toThrow(
      /name/,
    );
    await expect(
      pendingMigrations(db, [migration('002-b').migration, migration('001-a').migration]),
    ).rejects.toThrow(/out of order/);
  });
});
