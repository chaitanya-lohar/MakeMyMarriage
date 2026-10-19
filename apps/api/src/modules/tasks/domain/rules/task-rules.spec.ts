import { describe, expect, it } from 'vitest';
import {
  addDays,
  DEFAULT_LIST_STATUSES,
  isDueToday,
  isOverdue,
  PRIORITY_RANK,
  TaskStatus,
} from './task-rules.js';

describe('task rules (decision 0026)', () => {
  const today = '2027-02-09';

  it('is overdue only after the due date, and never when closed (0026 #8)', () => {
    expect(isOverdue('2027-02-08', TaskStatus.Todo, today)).toBe(true);
    expect(isOverdue('2027-02-08', TaskStatus.Blocked, today)).toBe(true);
    expect(isOverdue('2027-02-09', TaskStatus.Todo, today)).toBe(false);
    expect(isOverdue('2027-02-10', TaskStatus.Todo, today)).toBe(false);
    expect(isOverdue('2027-02-01', TaskStatus.Completed, today)).toBe(false);
    expect(isOverdue('2027-02-01', TaskStatus.Cancelled, today)).toBe(false);
    expect(isOverdue(null, TaskStatus.Todo, today)).toBe(false);
  });

  it('is due today on the due date unless closed', () => {
    expect(isDueToday('2027-02-09', TaskStatus.InProgress, today)).toBe(true);
    expect(isDueToday('2027-02-09', TaskStatus.Completed, today)).toBe(false);
    expect(isDueToday('2027-02-08', TaskStatus.Todo, today)).toBe(false);
  });

  it('adds calendar days across month and year ends', () => {
    expect(addDays('2027-02-25', 7)).toBe('2027-03-04');
    expect(addDays('2028-02-25', 7)).toBe('2028-03-03');
    expect(addDays('2026-12-29', 7)).toBe('2027-01-05');
  });

  it('lists every status but Cancelled by default and ranks Urgent first', () => {
    expect(DEFAULT_LIST_STATUSES).not.toContain(TaskStatus.Cancelled);
    expect(DEFAULT_LIST_STATUSES).toHaveLength(4);
    expect(PRIORITY_RANK.URGENT).toBeGreaterThan(PRIORITY_RANK.HIGH);
    expect(PRIORITY_RANK.MEDIUM).toBeGreaterThan(PRIORITY_RANK.LOW);
  });
});
