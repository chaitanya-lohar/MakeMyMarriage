/**
 * Approved copy for the authentication screens (decision 0015; Stitch "Sign In (V1)",
 * "Sign Up", "Reset Password", "Reset Link Expired", "Signed In"). Guarded by content.spec.ts.
 */

export const authPanel = {
  brand: 'MakeMyMarriage',
  eyebrow: 'Plan. Celebrate. Remember.',
  title: 'Your wedding journey, all in one place.',
  description:
    'From multi-day ceremonies and event-by-event RSVPs to vendors, expenses and guest photo memories — one calm, collaborative space for planning your wedding.',
  badge: 'Private by default',
  image: {
    src: '/images/home/hero-couple.jpg',
    alt: 'An Indian bride and groom smiling together at their evening wedding reception',
  },
};

export const authFooter = {
  privacyNote: 'Your wedding stays private by default.',
  copyright: '© 2026 MakeMyMarriage. All rights reserved.',
};

export const signIn = {
  title: 'Welcome back',
  subtitle: 'Sign in to continue planning your wedding.',
  emailLabel: 'Email address',
  emailPlaceholder: 'Enter your email address',
  passwordLabel: 'Password',
  passwordPlaceholder: 'Enter your password',
  rememberMe: 'Remember me for 30 days',
  forgotPassword: 'Forgot password?',
  submit: 'Sign In',
  submitting: 'Signing in...',
  newHere: 'New to MakeMyMarriage?',
  createLink: 'Create Your Wedding',
  missingFields: 'Please enter both your email address and password to continue.',
  passwordUpdated: 'Your password has been updated. Please sign in with your new password.',
  sessionEnded: 'Your session has ended. Please sign in again.',
};

export const forgotPassword = {
  title: 'Forgot your password?',
  subtitle:
    'Enter the email address associated with your account and we’ll help you reset your password.',
  emailLabel: 'Registered email address',
  emailPlaceholder: 'name@example.com',
  submit: 'Send Reset Link',
  submitting: 'Sending instructions...',
  back: 'Back to Sign In',
  missingEmail: 'Please provide the email associated with your account.',
  sent: 'Check your inbox — if an account exists for this email, you’ll receive instructions to reset your password.',
};

export const signUp = {
  title: 'Create your account',
  subtitle: 'Start planning your wedding with MakeMyMarriage.',
  nameLabel: 'Full name',
  namePlaceholder: 'Enter your full name',
  emailLabel: 'Email address',
  emailPlaceholder: 'Enter your email address',
  passwordLabel: 'Password',
  passwordPlaceholder: 'Create a password',
  passwordHint: 'Use at least 8 characters.',
  confirmLabel: 'Confirm password',
  confirmPlaceholder: 'Re-enter your password',
  submit: 'Create Account',
  submitting: 'Creating your account...',
  haveAccount: 'Already have an account?',
  signInLink: 'Sign In',
  missingFields: 'Please fill in all fields to continue.',
  passwordTooShort: 'Use at least 8 characters.',
  passwordsDiffer: 'The passwords do not match.',
};

export const resetPassword = {
  title: 'Choose a new password',
  subtitle:
    'Enter a new password for your account. For your security, you’ll be signed out on all your devices.',
  passwordLabel: 'New password',
  passwordPlaceholder: 'Create a new password',
  passwordHint: 'Use at least 8 characters.',
  confirmLabel: 'Confirm new password',
  confirmPlaceholder: 'Re-enter your new password',
  submit: 'Update Password',
  submitting: 'Updating password...',
  back: 'Back to Sign In',
  passwordTooShort: 'Use at least 8 characters.',
  passwordsDiffer: 'The passwords do not match.',
};

export const resetLinkExpired = {
  title: 'This reset link is no longer valid',
  subtitle:
    'Password reset links can be used once and expire after a short time. Request a new link to reset your password.',
  banner: 'This link has expired or has already been used.',
  requestNew: 'Request a New Link',
  back: 'Back to Sign In',
};

export const signedIn = {
  eyebrow: 'Your account is ready',
  greeting: 'Welcome',
  body: 'You’re signed in. Next, you’ll set up your wedding — your ceremonies, guests and plans will live here.',
  signedInAs: 'Signed in as',
  signOut: 'Sign Out',
  signingOut: 'Signing out...',
};

/** Shown under an email field whose value is not an email address (approved 2026-10-05). */
export const invalidEmail = 'Please enter a valid email address.';

/** Shown when the request could not reach the server at all. */
export const networkError =
  'We couldn’t reach MakeMyMarriage. Check your connection and try again.';
