import type { Metadata } from 'next';
import { EditTaskPageContent } from '@/features/tasks/components/task-pages';

export const metadata: Metadata = { title: 'Edit task' };

export default async function EditTaskPage({ params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  return <EditTaskPageContent taskId={taskId} />;
}
