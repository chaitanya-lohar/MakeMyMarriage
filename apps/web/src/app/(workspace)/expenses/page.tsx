import type { Metadata } from 'next';
import { ExpensesPageContent } from '@/features/expenses/components/expense-pages';

export const metadata: Metadata = { title: 'Expenses' };

export default function ExpensesPage() {
  return <ExpensesPageContent />;
}
