import { isValidObjectId, trusted, Types } from 'mongoose';

/** A position in a list ordered by `createdAt` then `_id`, both descending. */
export interface TimeCursor {
  createdAt: Date;
  id: string;
}

export function encodeTimeCursor(cursor: TimeCursor): string {
  return Buffer.from(JSON.stringify([cursor.createdAt.toISOString(), cursor.id])).toString(
    'base64url',
  );
}

/** The cursor's position, or null when it is not one this API issued. */
export function decodeTimeCursor(value: string): TimeCursor | null {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (
      Array.isArray(parsed) &&
      parsed.length === 2 &&
      typeof parsed[0] === 'string' &&
      typeof parsed[1] === 'string' &&
      isValidObjectId(parsed[1])
    ) {
      const createdAt = new Date(parsed[0]);
      if (!Number.isNaN(createdAt.getTime())) return { createdAt, id: parsed[1] };
    }
  } catch {
    // Falls through: malformed cursor.
  }
  return null;
}

/**
 * The filter for the entries after `cursor` in newest-first order. Operators are wrapped in
 * trusted(): the connection sanitizes filters (database.module).
 */
export function afterTimeCursor(cursor: TimeCursor): Record<string, unknown> {
  return {
    $or: [
      { createdAt: trusted({ $lt: cursor.createdAt }) },
      { createdAt: cursor.createdAt, _id: trusted({ $lt: new Types.ObjectId(cursor.id) }) },
    ],
  };
}
