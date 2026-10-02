/** A sign-in session (Database Design §6.2), without its refresh-token hash. */
export interface AuthSession {
  id: string;
  userId: string;
  createdAt: Date;
  expiresAt: Date;
}

export interface NewAuthSession {
  userId: string;
  refreshTokenHash: string;
  expiresAt: Date;
  userAgent?: string;
  ipAddress?: string;
}

/** Where a request came from, recorded on the session for the future session list. */
export interface ClientInfo {
  userAgent?: string;
  ipAddress?: string;
}
