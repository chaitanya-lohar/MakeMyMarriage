import Link from 'next/link';

interface LogoProps {
  className?: string;
}

/**
 * The approved MakeMyMarriage logo and wordmark (Stitch "Brand Logo & Wordmark"), inlined
 * so the wordmark renders in the site's Plus Jakarta Sans. Geometry and colours are
 * unchanged from the approved SVG.
 */
export function Logo({ className = 'h-10 w-auto' }: LogoProps) {
  return (
    <svg
      viewBox="0 0 320 80"
      fill="none"
      className={className}
      role="img"
      aria-label="MakeMyMarriage"
    >
      <g transform="translate(10, 12)">
        <path
          d="M6 46V22C6 13.1634 13.1634 6 22 6C30.8366 6 38 13.1634 38 22V46"
          stroke="#0A1128"
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M26 46V22C26 13.1634 33.1634 6 42 6C50.8366 6 58 13.1634 58 22V46"
          stroke="#B89758"
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="32" cy="18" r="2.5" fill="#B89758" />
      </g>
      <text
        x="82"
        y="47"
        fontFamily="var(--font-plus-jakarta-sans), system-ui, sans-serif"
        fontWeight="700"
        fontSize="25"
        letterSpacing="-0.03em"
        fill="#0A1128"
      >
        MakeMyMarriage
      </text>
      <circle cx="282" cy="45" r="3" fill="#B89758" />
    </svg>
  );
}

/** The logo as a link to the home page. */
export function LogoLink({ className }: LogoProps) {
  return (
    <Link
      href="/"
      className="flex items-center rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-secondary"
    >
      <Logo className={className} />
    </Link>
  );
}
