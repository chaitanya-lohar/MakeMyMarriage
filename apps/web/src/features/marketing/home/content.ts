import type { IconName } from '@/components/ui/icon';
import type { ChipTone } from '@/components/ui/chip';

/**
 * Approved home page copy and mock-up sample data (decision 0014).
 *
 * Every claim here must describe V1 as defined by the PRD — see content.spec.ts, which
 * fails the build if an out-of-scope claim creeps back in. People, venues and amounts in
 * the mock-ups are fictional examples, not customers or partners.
 */

export const hero = {
  eyebrow: 'The modern workspace for Indian weddings',
  titleLead: 'Every celebration,',
  titleAccent: 'effortlessly brought together.',
  description:
    'From multi-day ceremonies and event-by-event RSVPs to vendors, expenses and guest photo memories — one calm, collaborative space for planning your wedding.',
  primaryCta: 'Create Your Wedding',
  secondaryCta: 'Explore How It Works',
  note: 'Guests RSVP and share photos without creating an account.',
  image: {
    src: '/images/home/hero-couple.jpg',
    alt: 'An Indian bride and groom smiling together at their evening wedding reception',
    width: 1200,
    height: 896,
  },
};

export interface Feature {
  icon: IconName;
  eyebrow: string;
  title: string;
  description: string;
}

export const features = {
  title: 'Everything your wedding needs. One beautiful workspace.',
  description:
    'Designed to eliminate scattered spreadsheets, messy WhatsApp groups, and last-minute wedding chaos.',
  items: [
    {
      icon: 'calendar_month',
      eyebrow: '01. Plan',
      title: 'Events, Tasks & Countdowns',
      description:
        'Organise every ceremony, task and deadline in one place, with a wedding countdown, overdue tracking and reminders.',
    },
    {
      icon: 'group',
      eyebrow: '02. Guests',
      title: 'Guests, Invitations & RSVP',
      description:
        'Keep one guest list, invite each guest to the ceremonies that apply, and track RSVPs and attendee counts event by event.',
    },
    {
      icon: 'handshake',
      eyebrow: '03. Vendors',
      title: 'Vendor Discovery & Management',
      description:
        'Find nearby photographers, decorators, caterers and makeup artists, add them to your wedding, and keep quotes, notes and files together.',
    },
    {
      icon: 'receipt_long',
      eyebrow: '04. Expenses',
      title: 'Expense & Payment Tracking',
      description:
        "Record every expense by category and ceremony, log advances and instalments, and see what's paid and what's still pending.",
    },
    {
      icon: 'web',
      eyebrow: '05. Website',
      title: 'Wedding Website for Everyone You Love',
      description:
        'Publish a wedding website with your story, ceremonies, RSVP, gallery, live stream, dress codes and maps. It stays private until you choose to publish it.',
    },
    {
      icon: 'photo_library',
      eyebrow: '06. Memories',
      title: 'Guest Photos by QR Code',
      description:
        "Place a QR code at each ceremony. Guests scan it and upload photos straight into that event's album — no app, no login.",
    },
  ] satisfies Feature[],
};

export const dashboard = {
  eyebrow: 'Executive Command Center',
  title: 'Your entire wedding, at a glance.',
  description:
    'A unified executive view built for the couple and core family coordinators to make decisions with calm certainty.',
  addressBar: 'makemymarriage.com',
  frameLabel: 'Protected Workspace',
  weddingTitle: 'Udaipur · Feb 2027',
  coupleBadge: 'Arjun & Meera',
  weddingSummary: '4 ceremonies · 2 organizers',
  actions: [
    { icon: 'person_add', label: '+ Add Guest' },
    { icon: 'add_card', label: '+ New Expense' },
  ] satisfies { icon: IconName; label: string }[],
  previewAction: 'Preview Website',
  metrics: [
    {
      label: 'Days Remaining',
      value: '128 Days',
      note: 'First ceremony: Mehendi',
      noteTone: 'sage',
    },
    {
      label: 'Attending Guests',
      value: '342',
      suffix: '/ 400',
      note: '48 yet to respond',
      noteTone: 'champagne',
    },
    {
      label: 'Expenses Recorded',
      value: '₹48.2L',
      note: '₹6.5L in pending payments',
      noteTone: 'muted',
    },
    { label: 'Open Tasks', value: '9 Tasks', note: '3 overdue', noteTone: 'alert' },
  ] satisfies {
    label: string;
    value: string;
    suffix?: string;
    note: string;
    noteTone: 'sage' | 'champagne' | 'muted' | 'alert';
  }[],
  ceremoniesTitle: 'Upcoming Ceremonies',
  ceremoniesLink: 'View All 4 Events',
  upcomingCeremonies: [
    {
      initial: 'M',
      name: 'Mehendi',
      when: 'Feb 12 · Udaipur',
      attending: '162 attending',
      tone: 'champagne',
    },
    {
      initial: 'S',
      name: 'Sangeet',
      when: 'Feb 13 · Udaipur',
      attending: '298 attending',
      tone: 'gold',
    },
    {
      initial: 'P',
      name: 'Pheras',
      when: 'Feb 14 · Udaipur',
      attending: '342 attending',
      tone: 'navy',
    },
  ] satisfies {
    initial: string;
    name: string;
    when: string;
    attending: string;
    tone: 'champagne' | 'gold' | 'navy';
  }[],
  paymentsTitle: 'Recent Payments',
  paymentsLabel: 'Overview',
  payments: [
    {
      payee: 'Royal Palace Catering',
      detail: 'Catering · Advance paid by UPI',
      amount: '₹6,50,000',
      status: 'Paid',
      tone: 'sage',
    },
    {
      payee: 'Lumière Photography',
      detail: 'Photography · Balance outstanding',
      amount: '₹2,00,000',
      status: 'Pending',
      tone: 'champagne',
    },
    {
      payee: 'Floral & Mandap Decor',
      detail: 'Decoration · Instalment 2 of 3',
      amount: '₹4,00,000',
      status: 'Partially Paid',
      tone: 'muted',
    },
  ] satisfies { payee: string; detail: string; amount: string; status: string; tone: ChipTone }[],
  activity: 'Kavita Sharma is attending the Sangeet · 4 attendees',
  activityTime: '12m ago',
};

export interface CeremonyDetail {
  icon: IconName;
  text: string;
}

export interface Ceremony {
  label: string;
  when: string;
  whenTone: ChipTone;
  highlighted: boolean;
  name: string;
  description: string;
  details: CeremonyDetail[];
}

export const ceremonies = {
  eyebrow: 'Multi-day ceremonial architecture',
  title: 'Every celebration. Every detail. Under control.',
  description:
    'Multi-day Indian weddings have many ceremonies, each with its own guests, venue, dress code and vendors. Manage every ceremony on its own — with its own RSVPs.',
  items: [
    {
      label: 'Ceremony 01',
      when: 'Oct 12',
      whenTone: 'neutral',
      highlighted: false,
      name: 'Engagement & Roka',
      description: 'Intimate family union & ring exchange ceremony.',
      details: [
        { icon: 'group', text: '120 attending' },
        { icon: 'location_on', text: 'Private Terrace, Old City' },
        { icon: 'check_circle', text: 'Photo QR album active' },
      ],
    },
    {
      label: 'Ceremony 02',
      when: 'Feb 12 · Afternoon',
      whenTone: 'champagne',
      highlighted: true,
      name: 'Mehendi & Chooda',
      description: 'Henna artistry, live dhol players and traditional folk songs.',
      details: [
        { icon: 'group', text: '180 Guests Invited · 162 Attending' },
        { icon: 'location_on', text: 'Courtyard Lawn, Lakeview Palace' },
        { icon: 'palette', text: 'Dress Code: Vibrant Yellows & Emeralds' },
        { icon: 'handshake', text: 'Vendor: Aura Botanical Florals' },
        { icon: 'qr_code', text: 'Event Photo QR album ready' },
      ],
    },
    {
      label: 'Ceremony 03',
      when: 'Feb 13 · Morning',
      whenTone: 'neutral',
      highlighted: false,
      name: 'Haldi & Phoolon Ki Holi',
      description: 'Auspicious turmeric blessing followed by organic floral revelry.',
      details: [
        { icon: 'group', text: '150 Guests Invited · 138 Attending' },
        { icon: 'pool', text: 'Poolside Courtyard Pavilion' },
        { icon: 'dry_cleaning', text: 'Dress Code: Pure White Kurta & Sarees' },
        { icon: 'description', text: 'Notes: floral décor by Aura Botanical Florals' },
      ],
    },
    {
      label: 'Ceremony 04',
      when: 'Feb 13 · 7:00 PM',
      whenTone: 'neutral',
      highlighted: false,
      name: 'Sangeet & Cocktails',
      description: 'Choreographed dance performances, live orchestra and evening celebrations.',
      details: [
        { icon: 'group', text: '320 Guests Invited · 298 Attending' },
        { icon: 'location_on', text: 'Grand Ballroom, Lakeview Palace' },
        { icon: 'palette', text: 'Dress Code: Indo-Western Glamour' },
        { icon: 'handshake', text: 'Vendor: Lumière Stories Photography' },
      ],
    },
    {
      label: 'Ceremony 05 · Central',
      when: 'Feb 14 · Sunset',
      whenTone: 'champagne',
      highlighted: true,
      name: 'Vedic Pheras & Wedding',
      description: 'Traditional Baraat procession, Varmala, and sacred fire oaths.',
      details: [
        { icon: 'group', text: '400 Core Guests · 342 Attending' },
        { icon: 'location_on', text: 'Sunset Mandap, Lake Palace Lawns' },
        { icon: 'palette', text: 'Dress Code: Traditional Regal Attire' },
        { icon: 'videocam', text: 'Live stream linked' },
      ],
    },
    {
      label: 'Ceremony 06',
      when: 'Feb 15 · 8:00 PM',
      whenTone: 'neutral',
      highlighted: false,
      name: 'Grand Formal Reception',
      description: 'Formal celebration dinner, live musical ensemble and royal feast.',
      details: [
        { icon: 'group', text: '450 Guests Invited' },
        { icon: 'location_on', text: 'Palace Banquet Hall' },
        { icon: 'handshake', text: 'Vendor: Artisan Catering Guild' },
        { icon: 'qr_code_scanner', text: 'Reception QR photo upload table display' },
      ],
    },
  ] satisfies Ceremony[],
};

export type RsvpStatus = 'Attending' | 'Pending' | 'Declined' | 'Maybe';

export interface GuestRow {
  name: string;
  relation: string;
  /** Guests RSVP per ceremony; this summarises their per-event responses. */
  rsvp: RsvpStatus;
  rsvpScope?: string;
  attendees: string;
  invitation: 'Draft' | 'Sent' | 'Delivered' | 'Opened' | 'Failed';
}

export const guests = {
  eyebrow: 'Guests & Invitations',
  title: 'Invite everyone. Keep track of everything.',
  description:
    'Send each guest one digital invitation that covers all their ceremonies — by email, or share the link yourself on WhatsApp. Guests RSVP to each ceremony separately, with no account needed.',
  invitation: {
    eyebrow: 'The Wedding of',
    couple: 'Meera & Arjun',
    dates: 'February 12–14, 2027 · Udaipur',
    forLabel: 'Personal invitation for:',
    guest: 'Raghav Singhania',
    invitedTo: 'Invited to: Mehendi, Sangeet & Pheras',
    question: 'Will you join us for the Sangeet?',
    accept: 'Joyfully Accept',
    decline: 'Decline',
    venueLink: 'View venue & map',
  },
  directoryTitle: 'Guest Directory',
  copyLink: 'Copy Invite Link',
  send: 'Send Invitations',
  columns: ['Guest & Relation', 'RSVP', 'Attendees', 'Invitation'],
  rows: [
    {
      name: 'Rajesh & Sunita Mehra',
      relation: 'Paternal Uncle · Delhi',
      rsvp: 'Attending',
      rsvpScope: '3 events',
      attendees: '4 Attendees',
      invitation: 'Opened',
    },
    {
      name: 'Vikram & Ananya Sen',
      relation: "Groom's College Group",
      rsvp: 'Attending',
      rsvpScope: '2 events',
      attendees: '2 Attendees',
      invitation: 'Delivered',
    },
    {
      name: 'Dr. Kabir Deshmukh',
      relation: 'Family Friend · Mumbai',
      rsvp: 'Pending',
      attendees: '2 Attendees',
      invitation: 'Sent',
    },
    {
      name: 'Pooja Merchant',
      relation: "Bride's Cousin · London",
      rsvp: 'Attending',
      rsvpScope: 'all events',
      attendees: '1 Attendee',
      invitation: 'Opened',
    },
  ] satisfies GuestRow[],
  footerCount: 'Showing 4 of 400 invited guests',
  footerChannels: 'Email invitations · WhatsApp share link',
};

export const weddingWebsite = {
  eyebrow: 'Bespoke Guest Experience',
  title: 'A wedding website for everyone you love.',
  description:
    'Share your story, ceremony schedule, venues and maps, dress codes, RSVP and YouTube Live stream with family everywhere. It stays private until you choose to publish it.',
  address: 'makemymarriage.com/w/arjun-and-meera',
  previewLabel: 'Preview',
  preview: {
    eyebrow: 'Together with their families',
    couple: 'Meera & Arjun',
    invitation: 'Request the pleasure of your company to celebrate their wedding union',
    dates: 'February 12–14, 2027 · Udaipur, Rajasthan',
    tabs: ['Our Story', 'Events', 'RSVP', 'Gallery', 'Live Stream', 'Share Your Memories'],
    liveTab: 'Live Stream',
    cards: [
      {
        eyebrow: 'Venue & Directions',
        title: 'The Lake Palace Lawns',
        body: 'Full address and map for every ceremony, one tap away.',
      },
      {
        eyebrow: 'Dress Code',
        title: 'Royal Pastel Florals',
        body: 'Soft pastels for the day ceremonies, jewel tones for the evening.',
      },
    ],
  },
  cta: 'Create Your Wedding Website',
};

export interface VendorRow {
  name: string;
  category: string;
  detail: string;
  status: string;
  tone: ChipTone;
}

export const expensesAndVendors = {
  eyebrow: 'Expenses & Vendors',
  title: 'Know where your wedding money is going.',
  description:
    "Record every expense and payment — advances, instalments and final settlements — and see what's paid and what's still pending, by category and by ceremony.",
  vendors: {
    title: 'Vendor Management',
    summary: '6 vendors · 3 confirmed',
    add: '+ Add Vendor',
    rows: [
      {
        name: 'The Lakeview Palace',
        category: 'Venue',
        detail: 'Udaipur · Main Ceremonies',
        status: 'Confirmed',
        tone: 'sage',
      },
      {
        name: 'Aura Botanical Florals',
        category: 'Decorator',
        detail: 'Mandap & Stage Design',
        status: 'Negotiating',
        tone: 'champagne',
      },
      {
        name: 'Lumière Stories Photography',
        category: 'Photographer',
        detail: 'Photo & Film Package',
        status: 'Quotation Received',
        tone: 'sage',
      },
      {
        name: 'Artisan Catering Guild',
        category: 'Caterer',
        detail: 'Multi-event menus',
        status: 'Contacted',
        tone: 'muted',
      },
    ] satisfies VendorRow[],
  },
  expenses: {
    title: 'Expense Tracker',
    summary: '32 expenses across 4 ceremonies',
    badge: 'Active Log',
    totals: [
      { label: 'Total Spent', value: '₹48,20,000', tone: 'default' },
      { label: 'Paid', value: '₹41,70,000', tone: 'gold' },
      { label: 'Pending', value: '₹6,50,000', tone: 'sage' },
    ] satisfies { label: string; value: string; tone: 'default' | 'gold' | 'sage' }[],
    breakdownTitle: 'Spending by Category',
    // Uses the approved V1 expense categories (decision 0010, #7).
    categories: [
      { label: 'Venue', share: 42, colour: 'bg-primary-container' },
      { label: 'Catering', share: 28, colour: 'bg-secondary' },
      { label: 'Decoration', share: 18, colour: 'bg-secondary-fixed-dim' },
      { label: 'Photography', share: 12, colour: 'bg-outline-variant' },
    ],
    latestPaymentTitle: 'Latest Payment',
    latestPaymentDate: 'Nov 18',
    latestPayment: 'Catering final instalment, ₹5,25,000 by bank transfer.',
  },
};

export const memories = {
  image: {
    src: '/images/home/memories-collage.jpg',
    alt: 'A collage of candid moments from an Indian wedding: mehendi, the wedding ceremony and family celebrations',
    width: 1376,
    height: 768,
  },
  captions: ['Secure cloud storage', 'Event-wise albums'],
  eyebrow: 'No app needed for guests',
  titleLines: ['The wedding ends.', "The memories don't."],
  description:
    'Guests take hundreds of candid photos during your wedding. Collect every one without asking them to download an app.',
  qrCard: {
    eyebrow: 'Event QR Code',
    title: 'Scan to share memories with Arjun & Meera',
    body: 'No app or login. Guests scan with their phone camera and upload photos straight to the event album.',
  },
  highlights: [
    'Event-wise albums',
    'Published instantly, no approval step',
    'Guests can delete their own photos',
    'Printable QR code for every event',
  ],
};

export const howItWorks = {
  eyebrow: 'Frictionless Workflow',
  title: 'Your wedding journey, simplified.',
  description:
    'From the day you start planning to the memories that last a lifetime, MakeMyMarriage coordinates every milestone.',
  steps: [
    {
      number: '01',
      title: 'Create Your Wedding',
      description:
        'Create your wedding, add your ceremonies, and invite the people helping you plan.',
    },
    {
      number: '02',
      title: 'Plan & Organize',
      description:
        'Build your guest list, send digital invitations, and manage vendors, tasks and expenses.',
    },
    {
      number: '03',
      title: 'Celebrate & Remember',
      description:
        "Collect RSVPs, stream your ceremonies to loved ones far away with YouTube Live, and gather guests' photos through QR codes.",
    },
  ],
};

export const privacy = {
  eyebrow: 'Uncompromising Standards',
  title: 'Built for your wedding. Designed with privacy in mind.',
  description:
    "Your wedding is an intimate personal milestone. We respect your family's boundaries, security, and digital privacy.",
  items: [
    {
      icon: 'lock',
      title: 'Private by Default',
      description:
        'Your planning workspace is visible only to the people you invite, and your website stays in draft until you publish it.',
    },
    {
      icon: 'admin_panel_settings',
      title: 'Permission-Based Access',
      description: 'Organizers see and change only what their permissions allow.',
    },
    {
      icon: 'link',
      title: 'Secure Guest Links',
      description:
        'Invitations and QR codes use secure, hard-to-guess links, so guests never need an account.',
    },
    {
      icon: 'manage_accounts',
      title: 'Guests Stay in Control',
      description: 'Guests can delete the photos they uploaded, whenever they like.',
    },
  ] satisfies { icon: IconName; title: string; description: string }[],
};

export const finalCta = {
  badge: 'Made for Indian weddings',
  titleLines: ['Your wedding deserves', 'one beautiful place.'],
  description: 'Start planning your ceremonies today.',
  primaryCta: 'Create Your Wedding',
  secondaryCta: 'Explore How It Works',
  highlights: [
    'No account needed for guests',
    'Organizers with their own permissions',
    "Publish your website when you're ready",
  ],
};
