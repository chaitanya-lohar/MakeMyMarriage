import type { Metadata } from 'next';
import { TaskDetailPageContent } from '@/features/tasks/components/task-pages';

export const metadata: Metadata = { title: 'Task' };

export default async function TaskPage({ params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  return <TaskDetailPageContent taskId={taskId} />;
}
