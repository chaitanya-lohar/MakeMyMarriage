import type { UserStatus } from '../enums/user-status.js';

/** A user account as the rest of the application sees it. Never carries the password hash. */
export interface User {
  id: string;
  email: string;
  displayName: string;
  status: UserStatus;
  createdAt: Date;
}

/** Credentials needed to verify a sign-in; only the auth module asks for these. */
export interface UserCredentials {
  user: User;
  passwordHash: string;
}

export interface NewUser {
  email: string;
  displayName: string;
  passwordHash: string;
}

/** Raised when a sign-up uses an email that already has an account. */
export class EmailAlreadyRegisteredError extends Error {
  constructor() {
    super('Email already registered');
    this.name = 'EmailAlreadyRegisteredError';
  }
}
