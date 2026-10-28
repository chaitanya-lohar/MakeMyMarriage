import { Types } from 'mongoose';
import { describe, expect, it } from 'vitest';
import { findOwnerSeatProblems, type OwnerSeatRow } from './001-owner-seats.js';

const id = () => new Types.ObjectId();

function row(overrides: Partial<OwnerSeatRow> = {}): OwnerSeatRow {
  return {
    _id: id(),
    weddingId: id(),
    userId: id(),
    memberType: 'OWNER',
    role: 'OWNER',
    status: 'ACTIVE',
    ...overrides,
  };
}

describe('findOwnerSeatProblems (decision 0034 step 4)', () => {
  it('accepts one active owner per wedding, with or without a seat', () => {
    expect(findOwnerSeatProblems([row(), row(), row({ ownerSeat: 1 })])).toEqual([]);
  });

  it('accepts a wedding whose two owners already hold seats 1 and 2', () => {
    const weddingId = id();
    expect(
      findOwnerSeatProblems([row({ weddingId, ownerSeat: 1 }), row({ weddingId, ownerSeat: 2 })]),
    ).toEqual([]);
  });

  it('reports memberType and role disagreeing, both ways', () => {
    const problems = findOwnerSeatProblems([
      row({ role: 'ADMIN' }),
      row({ memberType: 'MEMBER', role: 'OWNER' }),
    ]);
    expect(problems).toHaveLength(2);
    expect(problems.every((problem) => problem.includes('disagree'))).toBe(true);
  });

  it('reports owner rows that are not ACTIVE', () => {
    const problems = findOwnerSeatProblems([
      row({ status: 'REVOKED' }),
      row({ status: 'INVITED' }),
    ]);
    expect(problems).toEqual([
      expect.stringContaining('status REVOKED'),
      expect.stringContaining('status INVITED'),
    ]);
  });

  it('reports a user with owner rows in several weddings', () => {
    const userId = id();
    const problems = findOwnerSeatProblems([row({ userId }), row({ userId })]);
    expect(problems).toEqual([expect.stringContaining(`user ${userId.toHexString()}`)]);
  });

  it('reports a wedding with two owner rows that need a seat, instead of choosing', () => {
    const weddingId = id();
    for (const seats of [
      [undefined, undefined],
      [1, undefined],
    ]) {
      const problems = findOwnerSeatProblems(
        seats.map((ownerSeat) => row({ weddingId, ...(ownerSeat && { ownerSeat }) })),
      );
      expect(problems).toEqual([expect.stringContaining('decided by hand')]);
    }
  });

  it('reports a wedding with more than two owner rows', () => {
    const weddingId = id();
    const problems = findOwnerSeatProblems([
      row({ weddingId, ownerSeat: 1 }),
      row({ weddingId, ownerSeat: 2 }),
      row({ weddingId }),
    ]);
    expect(problems).toEqual([expect.stringContaining('3 owner rows')]);
  });

  it('reports invalid, duplicate and misplaced seats', () => {
    const weddingId = id();
    const problems = findOwnerSeatProblems([
      row({ ownerSeat: 3 }),
      row({ weddingId, ownerSeat: 1 }),
      row({ weddingId, ownerSeat: 1 }),
      row({ memberType: 'MEMBER', role: 'ADMIN', ownerSeat: 2 }),
    ]);
    expect(problems).toEqual([
      expect.stringContaining('a MEMBER row holds ownerSeat'),
      expect.stringContaining('invalid ownerSeat 3'),
      expect.stringContaining('same ownerSeat'),
    ]);
  });

  it('reports every case at once', () => {
    const userId = id();
    const problems = findOwnerSeatProblems([
      row({ role: 'VIEWER' }),
      row({ status: 'REVOKED' }),
      row({ userId }),
      row({ userId }),
    ]);
    expect(problems).toHaveLength(3);
  });
});
