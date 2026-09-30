/** Public site navigation, shared by the header, mobile menu and footer. */
export interface SiteLink {
  label: string;
  href: string;
}

export const headerLinks: SiteLink[] = [
  { label: 'Features', href: '/#features' },
  { label: 'How It Works', href: '/#how-it-works' },
  { label: 'Wedding Website', href: '/#wedding-website' },
  { label: 'Memories', href: '/#memories' },
];

export const footerProductLinks: SiteLink[] = [
  { label: 'Features', href: '/#features' },
  { label: 'How It Works', href: '/#how-it-works' },
  { label: 'Ceremonies', href: '/#ceremonies' },
  { label: 'Wedding Website', href: '/#wedding-website' },
  { label: 'Guest Memories', href: '/#memories' },
];

export const legalLinks: SiteLink[] = [
  { label: 'Privacy Policy', href: '/privacy' },
  { label: 'Terms of Service', href: '/terms' },
];

export const signUpHref = '/signup';
export const signInHref = '/login';
