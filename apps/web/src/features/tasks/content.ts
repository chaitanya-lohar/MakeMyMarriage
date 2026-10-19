/**
 * Tasks copy (Stitch "P7 · T1–T7", corrections in decision 0027).
 * DRAFT WORDING — awaiting product-owner approval (0027). Guarded by content.spec.ts.
 */

export const statusLabels = {
  TODO: 'To do',
  IN_PROGRESS: 'In progress',
  BLOCKED: 'Blocked',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
} as const;

export const priorityLabels = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  URGENT: 'Urgent',
} as const;

export const tasksPage = {
  title: 'Tasks',
  subtitle: 'Everything to do for your wedding, in one place.',
  add: 'Add task',
  search: 'Search tasks by title',
  filters: 'Filters',
  statusFilter: 'Status',
  allExceptCancelled: 'All except Cancelled',
  priorityFilter: 'Priority',
  allPriorities: 'All',
  eventFilter: 'Event',
  allEvents: 'All events',
  wholeWedding: 'Whole wedding',
  overdueOnly: 'Overdue only',
  assignedToMe: 'Assigned to me',
  clearFilters: 'Clear filters',
  apply: 'Apply',
  clear: 'Clear',
  columns: {
    title: 'Task',
    event: 'Event',
    status: 'Status',
    priority: 'Priority',
    dueDate: 'Due date',
    assignee: 'Assignee',
  },
  overdue: 'Overdue',
  dueToday: 'Due today',
  noDueDate: 'No due date',
  noAssignee: 'No one assigned',
  loadMore: 'Load more',
  loadingMore: 'Loading…',
  showing: { one: 'Showing 1 task', other: 'Showing {count} tasks' },
  emptyTitle: 'No tasks yet',
  emptyBody: 'Add your first task to start planning.',
  emptyAdd: 'Add a task',
  noResultsTitle: 'No tasks match your filters',
  noResultsBody: 'Try changing or clearing the filters.',
  loading: 'Loading your tasks…',
  loadError: "We couldn't load your tasks. Please try again.",
  loadMoreError: "We couldn't load more tasks. Please try again.",
  retry: 'Try again',
  deleted: 'Task deleted',
};

export const taskFields = {
  title: { label: 'Title', placeholder: 'e.g. Book mehendi artist' },
  description: { label: 'Description (optional)', placeholder: 'Add details' },
  event: {
    label: 'Event (optional)',
    fromEventHint: 'You can change the event or choose Whole wedding.',
  },
  dueDate: { label: 'Due date (optional)' },
  priority: { label: 'Priority' },
  status: { label: 'Status' },
  assignee: { label: 'Assignee', assignToMe: 'Assign to me ({name})' },
  notes: {
    label: 'Notes (optional)',
    placeholder: 'Anything to remember',
    hint: 'Only visible to people managing this wedding',
  },
};

export const taskForm = {
  back: 'Tasks',
  addTitle: 'Add task',
  addSubtitle: 'Add something that needs doing for your wedding or one of its events.',
  editTitle: 'Edit task',
  editSubtitle: 'Update the details, status or who is doing it.',
  save: 'Save task',
  saveChanges: 'Save changes',
  saving: 'Saving…',
  cancel: 'Cancel',
  serverError: "We couldn't save the task. Please try again.",
};

export const taskErrors = {
  title: 'Enter a title.',
  titleTooLong: 'Use 150 characters or fewer.',
  tooLong: 'Keep it under {max} characters.',
  dueDate: 'Enter a valid date.',
};

export const taskDetail = {
  back: 'Tasks',
  due: 'Due {date}',
  changeStatus: 'Status: {status}',
  edit: 'Edit',
  delete: 'Delete task',
  details: 'Details',
  event: 'Event',
  dueDate: 'Due date',
  priority: 'Priority',
  assignee: 'Assignee',
  description: 'Description',
  notes: 'Notes',
  none: 'Not added',
  unassign: 'Unassign',
  assignToMe: 'Assign to me',
  cancelledNote:
    "Cancelled tasks are hidden from the list unless you filter by Cancelled, and aren't counted on the dashboard.",
  history: 'History',
  historyEmpty: 'No history yet.',
  updateError: "We couldn't update the task. Please try again.",
};

/** History lines; {actor} is the person who made the change. */
export const historyLines = {
  created: '{actor} created the task',
  status: '{actor} changed the status from {from} to {to}',
  title: '{actor} renamed the task from "{from}" to "{to}"',
  priority: '{actor} changed the priority from {from} to {to}',
  dueDate: '{actor} changed the due date from {from} to {to}',
  dueDateAdded: '{actor} set the due date to {to}',
  dueDateRemoved: '{actor} removed the due date',
  description: '{actor} edited the description',
  notes: '{actor} edited the notes',
  eventLinked: '{actor} linked the task to {to}',
  eventMoved: '{actor} moved the task from {from} to {to}',
  eventUnlinked: '{actor} made this a whole-wedding task',
  eventDeleted: 'The event was deleted, so this became a whole-wedding task',
  assigned: '{actor} assigned {subject}',
  unassigned: '{actor} unassigned {subject}',
  deleted: '{actor} deleted the task',
  aDeletedEvent: 'a deleted event',
};

export const deleteTask = {
  title: 'Delete this task?',
  body: '"{title}" will be removed from your tasks and dashboard. This can\'t be undone.',
  confirm: 'Delete task',
  cancel: 'Keep task',
  deleting: 'Deleting…',
  error: "We couldn't delete the task. Please try again.",
};

export const taskNotAvailable = {
  title: "This task isn't available",
  body: 'It may have been deleted, or the link is wrong.',
  back: 'Back to tasks',
};

/** The dashboard Tasks card (Stitch "P7 · T6"; the rest of the dashboard is unchanged). */
export const dashboardTasks = {
  title: 'Tasks',
  viewAll: 'View all tasks',
  pending: 'Pending',
  blocked: 'Blocked',
  completed: 'Completed',
  overdue: 'Overdue',
  overlapNote: 'Overdue tasks are also counted as Pending or Blocked.',
  upcomingTitle: 'Upcoming tasks',
  noUpcoming: 'Nothing due in the next seven days.',
  emptyTitle: 'No tasks yet',
  emptyBody: 'Add your first task to start planning.',
  add: 'Add a task',
};

/** The event screen shortcut (Stitch "P7 · T7"). */
export const eventTaskShortcut = 'Add task for this event';
