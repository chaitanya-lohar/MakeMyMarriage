import type { Metadata } from 'next';
import { EditExpensePageContent } from '@/features/expenses/components/expense-pages';

export const metadata: Metadata = { title: 'Edit expense' };

export default async function EditExpensePage({
  params,
}: {
  params: Promise<{ expenseId: string }>;
}) {
  const { expenseId } = await params;
  return <EditExpensePageContent expenseId={expenseId} />;
}
