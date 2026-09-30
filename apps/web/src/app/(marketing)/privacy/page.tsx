import type { Metadata } from 'next';
import { PlaceholderPage } from '@/components/layout/placeholder-page';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  robots: { index: false },
};

// Legal text has not been provided yet; do not add policy wording here (decision 0014).
export default function PrivacyPage() {
  return (
    <PlaceholderPage title="Privacy Policy">
      <p>This policy is being prepared and will be published before MakeMyMarriage launches.</p>
    </PlaceholderPage>
  );
}
