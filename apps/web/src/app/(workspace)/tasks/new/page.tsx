import type { Metadata } from 'next';
import { NewTaskPageContent } from '@/features/tasks/components/task-pages';

export const metadata: Metadata = { title: 'Add task' };

export default async function NewTaskPage({
  searchParams,
}: {
  searchParams: Promise<{ eventId?: string | string[] }>;
}) {
  const { eventId } = await searchParams;
  return <NewTaskPageContent eventId={typeof eventId === 'string' ? eventId : undefined} />;
}
