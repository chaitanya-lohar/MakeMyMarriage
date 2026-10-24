import type { Metadata } from 'next';
import { EditVendorPageContent } from '@/features/vendors/components/vendor-pages';
export const metadata: Metadata = { title: 'Edit vendor' };
export default async function EditVendorPage({
  params,
}: {
  params: Promise<{ vendorId: string }>;
}) {
  const { vendorId } = await params;
  return <EditVendorPageContent vendorId={vendorId} />;
}
