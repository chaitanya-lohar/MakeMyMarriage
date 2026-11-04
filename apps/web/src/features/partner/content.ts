/**
 * Partner connection copy (Stitch "P16 · M16-01" to "M16-09", decision 0039). WORDING IS
 * DRAFT until a wording approval. "Partner" here always means the bride or groom.
 */

export const partnerCardCopy = {
  title: 'Partner',
  inviteBody:
    "Invite your partner to plan this wedding with you. They'll become the second owner, with the same full access as you.",
  invite: 'Invite partner',
  sentTo: (email: string) => `Invitation sent to ${email}`,
  pending: 'Pending',
  sentExpires: (sent: string, expires: string) => `Sent ${sent} · Expires ${expires}`,
  resend: 'Resend',
  resending: 'Sending…',
  cancelInvitation: 'Cancel invitation',
  cancelling: 'Cancelling…',
  resendsLeft: (count: number) =>
    count === 1 ? '1 resend left today' : `${count} resends left today`,
  notSent: "The email couldn't be sent. Resend to try again.",
  expired: 'This invitation has expired. Send a new one.',
  sendNew: 'Send new invitation',
  owner: 'Owner',
  connectedSince: (date: string) => `Connected since ${date}`,
  yourAccess: 'Your access',
  leaveHelp: (name: string) => `You'll lose access to this wedding. ${name} stays as the owner.`,
  leave: 'Leave this wedding',
  resendLimit: 'You can resend at most 3 times a day. Try again later.',
  twoOwners: 'This wedding already has two owners.',
  loadError: "We couldn't load the partner details.",
  tryAgain: 'Try again',
  failed: 'Something went wrong. Please try again.',
  sent: (email: string) => `Invitation sent to ${email}.`,
  resent: 'A new link was sent.',
  cancelled: 'Invitation cancelled.',
};

export const partnerInviteCopy = {
  title: 'Invite your partner',
  body: "We'll email them a link. It works for 7 days.",
  email: "Partner's email",
  note: 'Accepting this invitation gives full owner access to this wedding. They cannot be removed by other members.',
  send: 'Send invitation',
  sending: 'Sending…',
  cancel: 'Cancel',
  invalidEmail: 'Enter a valid email address.',
  ownEmail: "You can't invite your own email.",
  rateLimited: "You've sent too many invitations. Try again later.",
  twoOwners: 'This wedding already has two owners.',
  alreadyPending: 'An invitation is already pending.',
  failed: 'Something went wrong. Please try again.',
};

export const leaveCopy = {
  title: (wedding: string) => `Leave ${wedding}?`,
  body: (other: string) =>
    `You'll lose access to this wedding straight away. ${other} will stay as the owner, and everything in the wedding stays as it is. ${other} can invite you again later.`,
  understand: "I understand I'll lose access.",
  leave: 'Leave wedding',
  leaving: 'Leaving…',
  cancel: 'Cancel',
  failed: 'Something went wrong. Please try again.',
  onlyOwner: 'You are the only owner of this wedding.',
};

export const leftNoticeCopy = {
  title: (wedding: string) => `You left ${wedding}.`,
  body: (other: string) =>
    `You no longer have access to this wedding. ${other} can invite you again later.`,
};

export const partnerInvitationPageCopy = {
  loading: 'Loading the invitation…',
  invitedTo: (inviter: string, wedding: string) =>
    `${inviter} invited you to plan ${wedding} together`,
  body: "If you accept, you'll become an owner of this wedding, with full access to everything in it.",
  invitationFor: (hint: string, expires: string) => `Invitation for ${hint} · Expires ${expires}`,
  signIn: 'Sign in to accept',
  createAccount: 'Create an account',
  declineInvitation: 'Decline invitation',
  accept: 'Accept invitation',
  accepting: 'Accepting…',
  decline: 'Decline',
  declining: 'Declining…',
  signedInAs: (email: string) => `Signed in as ${email}`,
  otherAccountTitle: 'Different account signed in',
  otherAccount: (me: string, hint: string) =>
    `You're signed in as ${me}. This invitation is for ${hint}.`,
  switchAccount: 'Sign in with another account',
  ownsTitle: 'You already own a wedding',
  ownsBody:
    "Before you can accept, hand over its ownership to someone else from that wedding's Members page (Transfer my ownership). Nothing will be deleted.",
  goToMyWedding: 'Go to my wedding',
  organizerNote:
    "You're already an organizer of this wedding. Accepting makes you an owner, and your custom permissions will no longer apply because owners have full access.",
  expired: (inviter: string) => `This invitation has expired. Ask ${inviter} to send a new one.`,
  cancelled: 'This invitation was cancelled.',
  answered: 'This invitation has already been answered.',
  invalid: "This link isn't valid.",
  twoOwners: 'This wedding already has two owners.',
  declined: 'You declined the invitation.',
  goHome: 'Go to home',
  successTitle: (wedding: string) => `You're now an owner of ${wedding}`,
  successBody: (inviter: string) => `You and ${inviter} both have full access to this wedding.`,
  goToDashboard: 'Go to dashboard',
  failed: 'Something went wrong. Please try again.',
};
