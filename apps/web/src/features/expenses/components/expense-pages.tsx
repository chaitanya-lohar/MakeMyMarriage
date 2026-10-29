'use client';

import { RequireWedding } from '@/features/workspace/components/workspace-page';
import { ExpenseDetail } from './expense-detail';
import { AddExpensePage, EditExpensePage } from './expense-form';
import { ExpensesList } from './expenses-list';

/** `/expenses` */
export function ExpensesPageContent() {
  return (
    <RequireWedding permission={['EXPENSES', 'VIEW']}>
      {(wedding) => <ExpensesList wedding={wedding} />}
    </RequireWedding>
  );
}

/** `/expenses/new`, optionally `?eventId=` from an event's shortcut (Stitch "P8 · E8"). */
export function NewExpensePageContent({ eventId }: { eventId?: string }) {
  return (
    <RequireWedding permission={['EXPENSES', 'CREATE']}>
      {(wedding) => <AddExpensePage wedding={wedding} eventId={eventId} />}
    </RequireWedding>
  );
}

/** `/expenses/[expenseId]` */
export function ExpenseDetailPageContent({ expenseId }: { expenseId: string }) {
  return (
    <RequireWedding permission={['EXPENSES', 'VIEW']}>
      {(wedding) => <ExpenseDetail key={expenseId} wedding={wedding} expenseId={expenseId} />}
    </RequireWedding>
  );
}

/** `/expenses/[expenseId]/edit` */
export function EditExpensePageContent({ expenseId }: { expenseId: string }) {
  return (
    <RequireWedding permission={['EXPENSES', 'EDIT']}>
      {(wedding) => <EditExpensePage key={expenseId} wedding={wedding} expenseId={expenseId} />}
    </RequireWedding>
  );
}
