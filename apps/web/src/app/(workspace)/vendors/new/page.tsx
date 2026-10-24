import type { Metadata } from 'next';
import { NewVendorPageContent } from '@/features/vendors/components/vendor-pages';
export const metadata: Metadata = { title: 'Add vendor' };
export default function NewVendorPage() {
  return <NewVendorPageContent />;
}
