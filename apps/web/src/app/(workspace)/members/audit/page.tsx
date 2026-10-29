import type { Metadata } from 'next';
import { AuditPageContent } from '@/features/members/components/audit-history';

export const metadata: Metadata = { title: 'Audit history' };

export default function AuditPage() {
  return <AuditPageContent />;
}
