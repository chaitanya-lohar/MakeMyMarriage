import type { Metadata } from 'next';
import { NewExpensePageContent } from '@/features/expenses/components/expense-pages';

export const metadata: Metadata = { title: 'Add an expense' };

export default async function NewExpensePage({
  searchParams,
}: {
  searchParams: Promise<{ eventId?: string | string[] }>;
}) {
  const { eventId } = await searchParams;
  return <NewExpensePageContent eventId={typeof eventId === 'string' ? eventId : undefined} />;
}
