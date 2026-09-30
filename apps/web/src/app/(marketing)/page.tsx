import { Ceremonies } from '@/features/marketing/home/sections/ceremonies';
import { DashboardPreview } from '@/features/marketing/home/sections/dashboard-preview';
import { ExpensesVendors } from '@/features/marketing/home/sections/expenses-vendors';
import { Features } from '@/features/marketing/home/sections/features';
import { FinalCta } from '@/features/marketing/home/sections/final-cta';
import { Guests } from '@/features/marketing/home/sections/guests';
import { Hero } from '@/features/marketing/home/sections/hero';
import { HowItWorks } from '@/features/marketing/home/sections/how-it-works';
import { Memories } from '@/features/marketing/home/sections/memories';
import { Privacy } from '@/features/marketing/home/sections/privacy';
import { WeddingWebsite } from '@/features/marketing/home/sections/wedding-website';

export default function HomePage() {
  return (
    <>
      <Hero />
      <Features />
      <DashboardPreview />
      <Ceremonies />
      <Guests />
      <WeddingWebsite />
      <ExpensesVendors />
      <Memories />
      <HowItWorks />
      <Privacy />
      <FinalCta />
    </>
  );
}
