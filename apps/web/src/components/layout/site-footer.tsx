import Link from 'next/link';
import { Logo } from '../ui/logo';
import { footerProductLinks, legalLinks, type SiteLink } from './site-links';

function LinkColumn({ title, links }: { title: string; links: SiteLink[] }) {
  return (
    <div>
      <h2 className="mb-3 text-title-md text-on-surface">{title}</h2>
      <ul className="space-y-2 text-body-sm text-on-surface-variant">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="transition-colors duration-200 hover:text-primary">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-outline-variant/30 bg-surface-container-lowest text-primary">
      <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-10 border-b border-outline-variant/20 px-4 py-12 sm:px-6 md:flex-row md:items-center md:px-12 md:py-16">
        <div className="max-w-sm space-y-4">
          <Logo className="h-9 w-auto" />
          <p className="font-serif text-headline-sm text-on-surface">Plan. Celebrate. Remember.</p>
          <p className="text-body-sm text-on-surface-variant">
            One calm place to plan your wedding — ceremonies, guests, vendors, expenses and memories
            — for modern couples and their families.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-8 md:gap-16">
          <LinkColumn title="Product" links={footerProductLinks} />
          <LinkColumn title="Legal" links={legalLinks} />
        </div>
      </div>
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-6 text-xs text-on-surface-variant sm:flex-row sm:px-6 md:px-12">
        <p>© 2026 MakeMyMarriage. All rights reserved.</p>
        <div className="flex items-center gap-6">
          {legalLinks.map((link) => (
            <Link key={link.href} href={link.href} className="transition-colors hover:text-primary">
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}
