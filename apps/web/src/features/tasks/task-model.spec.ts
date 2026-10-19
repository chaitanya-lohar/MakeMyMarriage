import { describe, expect, it } from 'vitest';
import {
  emptyTaskForm,
  formatHistoryTime,
  formatShortDate,
  formFromTask,
  historyText,
  toTaskPayload,
  validateTaskForm,
  type ApiTask,
  type ApiTaskActivity,
} from './task-model';

const task: ApiTask = {
  id: 't1',
  title: 'Book mehendi artist',
  description: 'Both hands and feet',
  notes: null,
  status: 'IN_PROGRESS',
  priority: 'HIGH',
  dueDate: '2027-02-05',
  eventId: 'e1',
  eventName: 'Mehendi',
  assignees: [{ userId: 'me', displayName: 'Meera Sharma' }],
  isOverdue: true,
  isDueToday: false,
  createdAt: '2027-02-01T03:40:00.000Z',
  updatedAt: '2027-02-03T13:10:00.000Z',
};

function activity(partial: Partial<ApiTaskActivity>): ApiTaskActivity {
  return {
    id: 'a1',
    action: 'CREATED',
    actorUserId: 'me',
    actorName: 'Meera Sharma',
    subjectName: null,
    oldValue: null,
    newValue: null,
    createdAt: '2027-02-03T13:10:00.000Z',
    ...partial,
  };
}

describe('task form', () => {
  it('starts as To do, Medium, whole wedding, optionally with a preset event', () => {
    expect(emptyTaskForm()).toMatchObject({ status: 'TODO', priority: 'MEDIUM', eventId: '' });
    expect(emptyTaskForm('e1').eventId).toBe('e1');
  });

  it('fills from a task, with "assign to me" for the signed-in member', () => {
    expect(formFromTask(task, 'me')).toMatchObject({
      title: 'Book mehendi artist',
      dueDate: '2027-02-05',
      eventId: 'e1',
      notes: '',
      assignToMe: true,
    });
    expect(formFromTask(task, 'someone-else').assignToMe).toBe(false);
  });

  it('validates like the API: title required and ≤150, texts ≤1,000, real dates', () => {
    const values = {
      ...emptyTaskForm(),
      title: ' ',
      description: 'x'.repeat(1001),
      dueDate: '2027-02-30',
    };
    expect(validateTaskForm(values)).toEqual({
      title: 'Enter a title.',
      description: 'Keep it under 1,000 characters.',
      dueDate: 'Enter a valid date.',
    });
    expect(validateTaskForm({ ...emptyTaskForm(), title: 'x'.repeat(151) }).title).toBe(
      'Use 150 characters or fewer.',
    );
    expect(validateTaskForm({ ...emptyTaskForm(), title: 'Fine' })).toEqual({});
  });

  it('sends nulls for empty fields and the full assignee set', () => {
    const values = { ...emptyTaskForm(), title: '  Gifts  ', assignToMe: true };
    expect(toTaskPayload(values, 'me')).toEqual({
      title: 'Gifts',
      description: null,
      notes: null,
      status: 'TODO',
      priority: 'MEDIUM',
      dueDate: null,
      eventId: null,
      assigneeIds: ['me'],
    });
    // Unticking keeps anyone else who is assigned.
    const shared = {
      ...task,
      assignees: [...task.assignees, { userId: 'p2', displayName: 'Arjun' }],
    };
    expect(
      toTaskPayload({ ...formFromTask(shared, 'me'), assignToMe: false }, 'me', shared).assigneeIds,
    ).toEqual(['p2']);
  });
});

describe('task display', () => {
  it('formats due dates and history times as the designs show them', () => {
    expect(formatShortDate('2027-02-05')).toBe('5 Feb 2027');
    expect(formatHistoryTime('2027-02-03T13:10:00.000Z')).toBe('3 Feb 2027, 6:40 pm');
  });

  it('writes a line for each kind of history entry', () => {
    expect(historyText(activity({}))).toEqual(['Meera Sharma created the task']);
    expect(
      historyText(
        activity({
          action: 'STATUS_CHANGED',
          oldValue: { status: 'TODO' },
          newValue: { status: 'IN_PROGRESS' },
        }),
      ),
    ).toEqual(['Meera Sharma changed the status from To do to In progress']);
    expect(
      historyText(
        activity({
          action: 'UPDATED',
          oldValue: { dueDate: '2027-02-08', priority: 'MEDIUM' },
          newValue: { dueDate: '2027-02-05', priority: 'HIGH', fields: ['notes'] },
        }),
      ),
    ).toEqual([
      'Meera Sharma changed the priority from Medium to High',
      'Meera Sharma changed the due date from 8 Feb 2027 to 5 Feb 2027',
      'Meera Sharma edited the notes',
    ]);
    expect(
      historyText(
        activity({
          action: 'EVENT_CHANGED',
          oldValue: { eventId: null, eventName: null },
          newValue: { eventId: 'e1', eventName: 'Mehendi' },
        }),
      ),
    ).toEqual(['Meera Sharma linked the task to Mehendi']);
    expect(historyText(activity({ action: 'EVENT_DELETED', oldValue: { eventId: 'e1' } }))).toEqual(
      ['The event was deleted, so this became a whole-wedding task'],
    );
    expect(
      historyText(activity({ action: 'ASSIGNEE_ADDED', subjectName: 'Meera Sharma' })),
    ).toEqual(['Meera Sharma assigned Meera Sharma']);
  });
});
