import { describe, expect, it } from 'vitest';
import {
  emptyTaskForm,
  formatHistoryTime,
  formatShortDate,
  formFromTask,
  errorsFromApi,
  historyText,
  toNewTaskPayload,
  toTaskChanges,
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

  it('fills from a task, with its assignees', () => {
    expect(formFromTask(task)).toMatchObject({
      title: 'Book mehendi artist',
      dueDate: '2027-02-05',
      eventId: 'e1',
      notes: '',
      assigneeIds: ['me'],
    });
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

  it('sends a new task in full, with nulls for empty fields', () => {
    const values = { ...emptyTaskForm(), title: '  Gifts  ', assigneeIds: ['me', 'p2'] };
    expect(toNewTaskPayload(values)).toEqual({
      title: 'Gifts',
      description: null,
      notes: null,
      status: 'TODO',
      priority: 'MEDIUM',
      dueDate: null,
      eventId: null,
      assigneeIds: ['me', 'p2'],
    });
    expect(toNewTaskPayload(emptyTaskForm()).assigneeIds).toEqual([]);
  });

  it('sends only the changed fields of an edit (review P7-M2)', () => {
    const loaded = formFromTask(task);
    expect(toTaskChanges(loaded, task)).toEqual({});
    expect(toTaskChanges({ ...loaded, title: ' Book henna artist ' }, task)).toEqual({
      title: 'Book henna artist',
    });
    expect(
      toTaskChanges({ ...loaded, notes: 'Two quotes in', dueDate: '', eventId: '' }, task),
    ).toEqual({ notes: 'Two quotes in', dueDate: null, eventId: null });
    // Status and assignees are left alone unless changed, so another tab's change survives.
    expect(toTaskChanges({ ...loaded, priority: 'URGENT' }, task)).not.toHaveProperty('status');
    expect(toTaskChanges({ ...loaded, priority: 'URGENT' }, task)).not.toHaveProperty(
      'assigneeIds',
    );
  });

  it('sends assignees only when the chosen members changed', () => {
    const shared = {
      ...task,
      assignees: [...task.assignees, { userId: 'p2', displayName: 'Arjun' }],
    };
    const loaded = formFromTask(shared);
    expect(toTaskChanges({ ...loaded, assigneeIds: ['p2', 'me'] }, shared)).toEqual({});
    expect(toTaskChanges({ ...loaded, assigneeIds: ['p2'] }, shared)).toEqual({
      assigneeIds: ['p2'],
    });
    const unassigned = { ...task, assignees: [] };
    expect(toTaskChanges({ ...formFromTask(unassigned), assigneeIds: ['me'] }, unassigned)).toEqual(
      {
        assigneeIds: ['me'],
      },
    );
  });

  it('rejects a title of only spaces, and maps API field errors', () => {
    expect(validateTaskForm({ ...emptyTaskForm(), title: '   \t ' }).title).toBe('Enter a title.');
    expect(
      errorsFromApi({
        title: ['Use 150 characters or fewer.', 'second'],
        dueDate: ['Enter a valid date.'],
        assigneeIds: ['ignored'],
        unknown: ['ignored'],
      }),
    ).toEqual({ title: 'Use 150 characters or fewer.', dueDate: 'Enter a valid date.' });
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

  it('writes the remaining history lines (review P7)', () => {
    const lines = (partial: Partial<ApiTaskActivity>) => historyText(activity(partial));
    expect(
      lines({ action: 'UPDATED', oldValue: { title: 'Henna' }, newValue: { title: 'Mehendi' } }),
    ).toEqual(['Meera Sharma renamed the task from "Henna" to "Mehendi"']);
    expect(
      lines({
        action: 'UPDATED',
        oldValue: { dueDate: null },
        newValue: { dueDate: '2027-02-05' },
      }),
    ).toEqual(['Meera Sharma set the due date to 5 Feb 2027']);
    expect(
      lines({
        action: 'UPDATED',
        oldValue: { dueDate: '2027-02-05' },
        newValue: { dueDate: null },
      }),
    ).toEqual(['Meera Sharma removed the due date']);
    expect(
      lines({ action: 'UPDATED', oldValue: {}, newValue: { fields: ['description'] } }),
    ).toEqual(['Meera Sharma edited the description']);
    expect(
      lines({
        action: 'EVENT_CHANGED',
        oldValue: { eventId: 'e1', eventName: 'Haldi' },
        newValue: { eventId: 'e2', eventName: 'Mehendi' },
      }),
    ).toEqual(['Meera Sharma moved the task from Haldi to Mehendi']);
    expect(
      lines({
        action: 'EVENT_CHANGED',
        oldValue: { eventId: 'e1', eventName: 'Haldi' },
        newValue: { eventId: null, eventName: null },
      }),
    ).toEqual(['Meera Sharma made this a whole-wedding task']);
    expect(
      lines({
        action: 'EVENT_CHANGED',
        oldValue: { eventId: 'e1', eventName: null },
        newValue: { eventId: 'e2', eventName: 'Mehendi' },
      }),
    ).toEqual(['Meera Sharma moved the task from a deleted event to Mehendi']);
    expect(lines({ action: 'ASSIGNEE_REMOVED', subjectName: 'Arjun Patel' })).toEqual([
      'Meera Sharma unassigned Arjun Patel',
    ]);
    expect(lines({ action: 'DELETED' })).toEqual(['Meera Sharma deleted the task']);
    expect(lines({ actorName: '', action: 'CREATED' })).toEqual(['Someone created the task']);
  });
});
