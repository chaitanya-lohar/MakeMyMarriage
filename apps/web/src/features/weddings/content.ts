/**
 * Approved copy for wedding setup (decision 0016; Stitch "P3 · S2"–"S6").
 * Guarded by content.spec.ts.
 */

export const noWedding = {
  eyebrow: 'Welcome, {firstName}',
  title: "Let's create your wedding",
  body: "Add a few details to set up your private planning workspace. You only need the bride's and groom's names to begin — everything else can be added later.",
  create: 'Create your wedding',
  signOut: 'Sign out',
};

export const weddingFields = {
  brideName: { label: "Bride's name", placeholder: 'e.g. Meera Sharma' },
  groomName: { label: "Groom's name", placeholder: 'e.g. Arjun Patel' },
  startDate: { label: 'Wedding date (optional)', placeholder: 'DD / MM / YYYY' },
  venueName: { label: 'Venue name (optional)', placeholder: 'e.g. Lakeside Garden' },
  primaryCity: { label: 'City (optional)', placeholder: 'e.g. Jaipur' },
  description: {
    label: 'Description (optional)',
    placeholder: 'A short message about your wedding',
  },
  preview: 'Your wedding will appear as:',
};

export const fieldErrors = {
  brideRequired: "Enter the bride's name.",
  groomRequired: "Enter the groom's name.",
  nameTooLong: 'Use 100 characters or fewer.',
  placeTooLong: 'Use 120 characters or fewer.',
  descriptionTooLong: 'Use 1,000 characters or fewer.',
  invalidDate: 'Enter a valid date.',
};

export const networkError =
  "We couldn't reach MakeMyMarriage. Check your connection and try again.";

export const createWedding = {
  back: 'Back',
  title: 'Create your wedding',
  subtitle: "Start with the couple's names. You can add or change the other details at any time.",
  submit: 'Create wedding',
  submitting: 'Creating your wedding…',
  serverError: "We couldn't create your wedding. Please try again.",
  alreadyOwnedTitle: 'You already have a wedding',
  alreadyOwnedBody: 'Each account can own one wedding.',
  goToDashboard: 'Go to your dashboard',
};

export const weddingDetailsPage = {
  title: 'Wedding details',
  subtitle: "Update your wedding's details. Changes appear on your dashboard right away.",
  save: 'Save changes',
  saving: 'Saving…',
  cancel: 'Cancel',
  saved: 'Your changes have been saved.',
  serverError: "We couldn't save your changes. Please try again.",
};

export const dashboard = {
  eyebrow: 'Your wedding',
  edit: 'Edit wedding details',
  created: 'Your wedding has been created.',
  dismiss: 'Dismiss',
  daysToGo: { one: 'day to go', other: 'days to go' },
  until: 'until {date}',
  today: 'Today',
  todaySuffix: 'is your wedding day',
  celebratedOn: 'Celebrated on',
  noDateTitle: 'Wedding date not set',
  noDateBody: 'Add a date to start your countdown.',
  addDate: 'Add a date',
  detailsTitle: 'Wedding details',
  bride: 'Bride',
  groom: 'Groom',
  weddingDate: 'Wedding date',
  venue: 'Venue',
  city: 'City',
  about: 'About your wedding',
  notAdded: 'Not added',
  noDescription: 'No description added.',
};

export const notAvailable = {
  title: "This page isn't available",
  body: 'It may have been removed, or you may not have access to it.',
  back: 'Back to dashboard',
};
