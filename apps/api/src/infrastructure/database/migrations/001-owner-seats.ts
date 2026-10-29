import type { mongo } from 'mongoose';
import { MigrationDataError, type Migration } from './migration.js';

// The values as they were when this migration was written (Database Design §7.2); a
// migration never follows later changes to the application constants.
const MEMBERSHIPS = 'wedding_memberships';
const OWNER = 'OWNER';
const ACTIVE = 'ACTIVE';
const SEATS: readonly unknown[] = [1, 2];
const NAME = '001-owner-seats';

export const OWNER_SEAT_INDEX = 'owner_seat_per_wedding';
export const OWNER_SEAT_INDEX_KEY = { weddingId: 1, ownerSeat: 1 } as const;
export const OWNER_SEAT_INDEX_OPTIONS = {
  name: OWNER_SEAT_INDEX,
  unique: true,
  partialFilterExpression: { memberType: OWNER },
} as const;

/** The fields of a `wedding_memberships` row the owner-seat checks read. */
export interface OwnerSeatRow {
  _id: mongo.ObjectId;
  weddingId: mongo.ObjectId;
  userId: mongo.ObjectId;
  memberType: string;
  role: string;
  status: string;
  ownerSeat?: unknown;
}

const describeRow = (row: OwnerSeatRow) =>
  `membership ${row._id.toHexString()} (wedding ${row.weddingId.toHexString()}, ` +
  `user ${row.userId.toHexString()})`;

/**
 * The inconsistent cases of decision 0034 step 4 among the rows that are, claim to be or
 * look like owner rows. Empty when the backfill may run. Pure, so it is unit-tested.
 *
 * - memberType and role disagree (OWNER ⇔ OWNER, Database Design §7.2);
 * - an owner row that is not ACTIVE;
 * - a user with owner rows in several weddings;
 * - a wedding with more than one owner row — unless every one of them already holds a
 *   distinct valid seat, which only a completed backfill or later Phase 10 code writes;
 * - a seat that is not 1 or 2, a seat held twice in a wedding, or a seat on a non-owner row.
 */
export function findOwnerSeatProblems(rows: readonly OwnerSeatRow[]): string[] {
  const problems: string[] = [];
  const owners = rows.filter((row) => row.memberType === OWNER);

  for (const row of rows) {
    if ((row.memberType === OWNER) !== (row.role === OWNER)) {
      problems.push(
        `${describeRow(row)}: memberType ${row.memberType} and role ${row.role} disagree`,
      );
    }
    if (row.memberType !== OWNER && row.ownerSeat !== undefined) {
      problems.push(`${describeRow(row)}: a ${row.memberType} row holds ownerSeat`);
    }
  }

  for (const row of owners) {
    if (row.status !== ACTIVE) {
      problems.push(`${describeRow(row)}: owner row has status ${row.status}, not ACTIVE`);
    }
    if (row.ownerSeat !== undefined && !SEATS.includes(row.ownerSeat)) {
      problems.push(`${describeRow(row)}: invalid ownerSeat ${JSON.stringify(row.ownerSeat)}`);
    }
  }

  for (const [userId, userOwners] of groupBy(owners, (row) => row.userId.toHexString())) {
    if (userOwners.length > 1) {
      const weddings = userOwners.map((row) => row.weddingId.toHexString()).join(', ');
      problems.push(`user ${userId} has owner rows in ${userOwners.length} weddings: ${weddings}`);
    }
  }

  for (const [weddingId, weddingOwners] of groupBy(owners, (row) => row.weddingId.toHexString())) {
    if (weddingOwners.length > SEATS.length) {
      problems.push(
        `wedding ${weddingId} has ${weddingOwners.length} owner rows; at most two are allowed`,
      );
      continue;
    }
    const seats = weddingOwners.map((row) => row.ownerSeat);
    if (seats.some((seat, index) => seat !== undefined && seats.indexOf(seat) !== index)) {
      problems.push(`wedding ${weddingId}: two owner rows hold the same ownerSeat`);
    } else if (weddingOwners.length > 1 && seats.includes(undefined)) {
      const ids = weddingOwners.map((row) => row._id.toHexString()).join(', ');
      problems.push(
        `wedding ${weddingId} has ${weddingOwners.length} owner rows (${ids}) without seats; ` +
          'which owner takes which seat must be decided by hand',
      );
    }
  }
  return problems;
}

function groupBy<T>(items: readonly T[], key: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) groups.set(key(item), [...(groups.get(key(item)) ?? []), item]);
  return groups;
}

/**
 * Migration 001 — owner seats (decision 0034, Database Design §7.2, §30). Gives every
 * existing OWNER row seat 1, then creates the `owner_seat_per_wedding` index that limits a
 * wedding to two owners (P10-5).
 */
export const ownerSeatsMigration: Migration = {
  name: NAME,

  async up(db, log) {
    const memberships = db.collection<OwnerSeatRow>(MEMBERSHIPS);

    // 1. Identify the owner rows, and every row that claims or holds an owner's attributes.
    const rows = await memberships
      .find(
        { $or: [{ memberType: OWNER }, { role: OWNER }, { ownerSeat: { $exists: true } }] },
        {
          projection: {
            weddingId: 1,
            userId: 1,
            memberType: 1,
            role: 1,
            status: 1,
            ownerSeat: 1,
          },
        },
      )
      .toArray();

    // 3–4. Validate before writing anything; report every case, never fix one silently.
    const problems = findOwnerSeatProblems(rows);
    if (problems.length > 0) throw new MigrationDataError(NAME, problems);

    // 2. Backfill. Each wedding has one owner row today; it takes seat 1.
    const backfilled = await memberships.updateMany(
      { memberType: OWNER, ownerSeat: { $exists: false } },
      { $set: { ownerSeat: 1 } },
    );
    log(`seat 1 given to ${backfilled.modifiedCount} owner row(s)`);

    // 5. The index, now that every owner row has a distinct seat.
    await memberships.createIndex(OWNER_SEAT_INDEX_KEY, OWNER_SEAT_INDEX_OPTIONS);
    log(`index ${OWNER_SEAT_INDEX} ready`);

    // 6. Verify: every owner row has a seat, and no other row has one.
    const [ownersWithoutSeat, othersWithSeat] = await Promise.all([
      memberships.countDocuments({ memberType: OWNER, ownerSeat: { $nin: [1, 2] } }),
      memberships.countDocuments({ memberType: { $ne: OWNER }, ownerSeat: { $exists: true } }),
    ]);
    if (ownersWithoutSeat > 0 || othersWithSeat > 0) {
      throw new Error(
        `${NAME} verification failed: ${ownersWithoutSeat} owner row(s) without a seat, ` +
          `${othersWithSeat} non-owner row(s) with one`,
      );
    }
  },
};
