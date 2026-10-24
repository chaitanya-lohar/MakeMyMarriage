import type { Metadata } from 'next';
import { VendorsPageContent } from '@/features/vendors/components/vendor-pages';
export const metadata: Metadata = { title: 'Vendors' };
export default function VendorsPage() {
  return <VendorsPageContent />;
}
