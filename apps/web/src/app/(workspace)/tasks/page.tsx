import type { Metadata } from 'next';
import { TasksPageContent } from '@/features/tasks/components/task-pages';

export const metadata: Metadata = { title: 'Tasks' };

export default function TasksPage() {
  return <TasksPageContent />;
}
