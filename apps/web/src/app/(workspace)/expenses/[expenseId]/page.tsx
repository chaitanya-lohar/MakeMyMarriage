import type { Metadata } from 'next';
import { ExpenseDetailPageContent } from '@/features/expenses/components/expense-pages';

export const metadata: Metadata = { title: 'Expense' };

export default async function ExpensePage({ params }: { params: Promise<{ expenseId: string }> }) {
  const { expenseId } = await params;
  return <ExpenseDetailPageContent expenseId={expenseId} />;
}
