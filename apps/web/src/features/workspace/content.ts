/**
 * Approved copy for the signed-in workspace shell (decision 0016; Stitch "P3 · S1",
 * desktop sidebar and user menu, mobile drawer). Guarded by content.spec.ts.
 */

export const workspaceNav = {
  dashboard: 'Dashboard',
  weddingDetails: 'Wedding details',
  // Phase 4 adds Events and Guests & RSVP (decision 0019 #3); Phase 7 adds Tasks (0027);
  // Phase 8 adds Expenses (0029).
  events: 'Events',
  guests: 'Guests & RSVP',
  tasks: 'Tasks',
  expenses: 'Expenses',
  vendors: 'Vendors',
  yourWedding: 'Your wedding',
  menu: 'Menu',
  openMenu: 'Open menu',
  closeMenu: 'Close menu',
  accountMenu: 'Account menu',
  signOut: 'Sign out',
  signingOut: 'Signing out…',
};

export const workspaceFooter = {
  copyright: '© 2026 MakeMyMarriage. All rights reserved.',
};

/** Shown when the workspace data cannot be loaded (Stitch "P3 · S5", couldn't-load state). */
export const loadError = {
  title: "We couldn't load your wedding details",
  body: 'Please try again.',
  retry: 'Try again',
};

export const loading = {
  label: 'Loading your wedding…',
};
