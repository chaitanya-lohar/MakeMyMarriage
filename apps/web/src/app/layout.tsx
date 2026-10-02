import type { Metadata } from 'next';
import { Playfair_Display, Plus_Jakarta_Sans } from 'next/font/google';
import type { ReactNode } from 'react';
import './globals.css';

// Self-hosted at build time by next/font; no font requests leave the site at runtime.
const playfairDisplay = Playfair_Display({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  variable: '--font-playfair-display',
  display: 'swap',
});

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-plus-jakarta-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'MakeMyMarriage — Modern Wedding Planning for Indian Weddings',
    template: '%s · MakeMyMarriage',
  },
  description:
    'Plan multi-day Indian weddings in one calm place — ceremonies, guests and event-by-event RSVPs, vendors, expenses, a wedding website and guest photo memories.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${playfairDisplay.variable} ${plusJakartaSans.variable}`}>
      <body className="bg-surface font-sans text-on-surface antialiased">{children}</body>
    </html>
  );
}
