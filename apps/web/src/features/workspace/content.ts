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
  // Phase 10 adds Members for every member (0035 #1).
  members: 'Members',
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

/** Role names (Stitch "P10 · M1"). Draft wording (0035). */
export const roleLabels: Record<string, string> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  ORGANIZER: 'Organizer',
  EDITOR: 'Editor',
  VIEWER: 'Viewer',
};

/** The wedding selector (Stitch "P10 · M11", decision 0035 #4). Draft wording. */
export const weddingSelector = {
  title: 'Your weddings',
  open: 'Switch wedding',
  current: 'Current wedding',
  switched: (name: string) => `Switched to ${name}`,
  noAccessTitle: 'You no longer have access to this wedding',
  noAccessBody: 'An owner removed your access to this wedding.',
  chooseAnother: 'Choose another wedding',
  goHome: 'Go to home',
};
