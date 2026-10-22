/**
 * Expenses copy (Stitch "P8 · E1–E8", corrections in decision 0029).
 * DRAFT WORDING — awaiting product-owner approval (0029). Guarded by content.spec.ts.
 */

/** The fixed categories (0010 #7), in the order the forms list them. */
export const categoryLabels = {
  VENUE: 'Venue',
  CATERING: 'Catering',
  DECORATION: 'Decoration',
  PHOTOGRAPHY: 'Photography',
  CLOTHING: 'Clothing',
  JEWELLERY: 'Jewellery',
  MAKEUP: 'Makeup',
  ENTERTAINMENT: 'Entertainment',
  INVITATIONS: 'Invitations',
  GIFTS: 'Gifts',
  MISCELLANEOUS: 'Miscellaneous',
} as const;

/** Calculated from the payments (0028 #7); no Cancelled (0018). */
export const paymentStatusLabels = {
  PENDING: 'Pending',
  PARTIALLY_PAID: 'Partially paid',
  PAID: 'Paid',
} as const;

export const methodLabels = {
  CASH: 'Cash',
  UPI: 'UPI',
  BANK_TRANSFER: 'Bank transfer',
  CARD: 'Card',
  CHEQUE: 'Cheque',
  OTHER: 'Other',
} as const;

export const expensesPage = {
  title: 'Expenses',
  add: 'Add an expense',
  totals: { total: 'Total', paid: 'Paid', pending: 'Pending', caption: 'For the expenses shown' },
  search: 'Search by title',
  filters: 'Filters',
  categoryFilter: 'Category',
  allCategories: 'All categories',
  eventFilter: 'Event',
  allEvents: 'All events',
  wholeWedding: 'Whole wedding',
  statusFilter: 'Payment status',
  allStatuses: 'All statuses',
  clearFilters: 'Clear filters',
  apply: 'Apply',
  columns: {
    title: 'Title',
    category: 'Category',
    event: 'Event',
    amount: 'Amount',
    paid: 'Paid',
    pending: 'Pending',
    status: 'Status',
    date: 'Date',
  },
  loadMore: 'Load more',
  loadingMore: 'Loading…',
  showing: { one: 'Showing 1 expense', other: 'Showing {count} expenses' },
  emptyTitle: 'No expenses yet',
  emptyBody: "Record a booking or purchase to start tracking what's paid and what's pending.",
  noResultsTitle: 'No expenses match these filters',
  noResultsBody: 'Try changing or clearing the filters.',
  loading: 'Loading your expenses…',
  loadError: "We couldn't load your expenses.",
  loadMoreError: "We couldn't load more expenses. Please try again.",
  retry: 'Try again',
  deleted: 'Expense deleted',
};

export const expenseFields = {
  title: { label: 'Title', placeholder: 'e.g. Decorator' },
  amount: { label: 'Amount', hint: 'The full cost, including anything already paid' },
  category: { label: 'Category', placeholder: 'Select a category' },
  expenseDate: { label: 'Expense date' },
  event: {
    label: 'Event (optional)',
    fromEventHint: 'You can change this if the cost is for another event or the whole wedding.',
  },
  notes: { label: 'Notes (optional)', placeholder: 'Anything to remember' },
};

export const expenseForm = {
  back: 'Expenses',
  addTitle: 'Add an expense',
  addSubtitle: 'Record a cost or booking for your wedding or one of its ceremonies.',
  editTitle: 'Edit expense',
  editSubtitle: 'Changes apply to this expense and its totals.',
  addPaymentsNote: 'You can add payments after saving.',
  save: 'Save expense',
  saving: 'Saving…',
  cancel: 'Cancel',
  checkAmount: 'Check the amount',
  serverError: "We couldn't save the expense. Please try again.",
  eventGone:
    'That event was deleted, so this expense is now for the whole wedding. Check it and save again.',
};

export const expenseErrors = {
  title: 'Enter a title.',
  titleTooLong: 'Use 150 characters or fewer.',
  amount: 'Enter an amount more than ₹0.',
  amountTooLarge: 'Enter at most ₹10,00,00,000.',
  decimals: 'Use up to 2 decimal places.',
  category: 'Choose a category.',
  date: 'Enter a valid date.',
  tooLong: 'Keep it under {max} characters.',
  paymentDateFuture: "The payment date can't be in the future.",
  payer: 'Enter who paid.',
  payerTooLong: 'Use 100 characters or fewer.',
  exceedsPending: 'This is more than the pending {amount}.',
};

export const expenseDetail = {
  back: 'Back to Expenses',
  edit: 'Edit',
  delete: 'Delete',
  amount: 'Amount',
  paid: 'Paid',
  pending: 'Pending',
  details: 'Expense details',
  category: 'Category',
  event: 'Event',
  expenseDate: 'Expense date',
  notes: 'Notes',
  none: 'Not added',
  payments: 'Payments',
  paymentCount: { one: '1 payment', other: '{count} payments' },
  addPayment: 'Add payment',
  markFullyPaid: 'Mark as fully paid',
  fullyPaidHint: 'This expense is fully paid.',
  noPayments: 'No payments recorded yet.',
  columns: {
    date: 'Date',
    amount: 'Amount',
    paidBy: 'Paid by',
    method: 'Method',
    reference: 'Reference',
    notes: 'Notes',
    actions: 'Actions',
  },
  paidBy: 'Paid by:',
  ref: 'Ref:',
  editPayment: 'Edit',
  removePayment: 'Remove',
  me: 'Me ({name})',
  saved: 'Expense saved',
  paymentSaved: 'Payment saved',
  paymentRemoved: 'Payment removed',
  paymentGone: 'That payment was already removed',
  actionError: "We couldn't update the payments. Please try again.",
};

export const paymentForm = {
  addTitle: 'Add payment',
  editTitle: 'Edit payment',
  fullyPaidTitle: 'Mark as fully paid',
  pendingLine: 'Pending {pending} of {amount}',
  checkDetails: 'Check the details, then save.',
  amount: { label: 'Amount', fullHint: 'Full pending amount filled in.' },
  paymentDate: { label: 'Payment date', hint: 'Today or earlier only.' },
  paidBy: { label: 'Paid by', me: 'Me ({name})', someoneElse: 'Someone else' },
  name: { label: 'Name', hint: "For example, Bride's father" },
  method: { label: 'Method (optional)', placeholder: 'Select method' },
  reference: { label: 'Reference (optional)', placeholder: 'e.g. UPI or cheque number' },
  notes: { label: 'Notes (optional)' },
  save: 'Save payment',
  saving: 'Saving…',
  cancel: 'Cancel',
  close: 'Close',
  serverError: "We couldn't save the payment. Please try again.",
  memberGone: "That person isn't a member of this wedding any more. Choose who paid.",
};

export const deleteExpense = {
  title: 'Delete this expense?',
  body: '{title} and its {payments} will be removed from your expenses and totals.',
  bodyNoPayments: '{title} will be removed from your expenses and totals.',
  amount: 'Amount:',
  recorded: 'Recorded payments ({count}):',
  recordedTotal: '{amount} total',
  confirm: 'Delete expense',
  cancel: 'Cancel',
  deleting: 'Deleting…',
  error: "We couldn't delete the expense. Please try again.",
};

export const removePayment = {
  title: 'Remove this payment?',
  body: '{amount} paid on {date} by {payer}.',
  update: 'The paid and pending amounts will update.',
  paidChange: 'Paid amount:',
  pendingChange: 'Pending amount:',
  statusAfter: 'The status will be {status}.',
  confirm: 'Remove payment',
  cancel: 'Cancel',
  removing: 'Removing…',
  error: "We couldn't remove the payment. Please try again.",
};

export const expenseNotAvailable = {
  title: "This expense isn't available",
  body: 'It may have been deleted, or the link is wrong.',
  back: 'Back to expenses',
};

/** The dashboard Expenses card (Stitch "P8 · E7"; the rest of the dashboard is unchanged). */
export const dashboardExpenses = {
  title: 'Expenses',
  total: 'Total',
  paid: 'Paid',
  pending: 'Pending',
  byCategory: 'By category',
  byEvent: 'By event',
  wholeWedding: 'Whole wedding',
  viewAll: 'View all expenses',
  emptyTitle: 'No expenses yet',
  emptyBody:
    'Record bookings and wedding purchases to track payments and outstanding balances here.',
  add: 'Add an expense',
};

/** The event screen shortcut (Stitch "P8 · E8"). */
export const eventExpenseShortcut = 'Add expense for this event';
