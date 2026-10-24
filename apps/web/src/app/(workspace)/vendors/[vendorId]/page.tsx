import type { Metadata } from 'next';
import { VendorPageContent } from '@/features/vendors/components/vendor-pages';
export const metadata: Metadata = { title: 'Vendor' };
export default async function VendorPage({ params }: { params: Promise<{ vendorId: string }> }) {
  const { vendorId } = await params;
  return <VendorPageContent vendorId={vendorId} />;
}
