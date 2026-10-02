import type { Metadata } from 'next';
import { PlaceholderPage } from '@/components/layout/placeholder-page';

export const metadata: Metadata = {
  title: 'Terms of Service',
  robots: { index: false },
};

// Legal text has not been provided yet; do not add terms wording here (decision 0014).
export default function TermsPage() {
  return (
    <PlaceholderPage title="Terms of Service">
      <p>These terms are being prepared and will be published before MakeMyMarriage launches.</p>
    </PlaceholderPage>
  );
}
