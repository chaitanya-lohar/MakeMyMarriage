/** A wedding (Database Design §7.1 with the fields approved in 0010 #9 and 0016). */
export interface Wedding {
  id: string;
  displayName: string;
  brideName: string;
  groomName: string;
  /** Calendar date, YYYY-MM-DD. */
  startDate: string | null;
  venueName: string | null;
  primaryCity: string | null;
  description: string | null;
  timezone: string;
}

/** The details a user enters; null clears an optional field. */
export interface WeddingDetails {
  brideName: string;
  groomName: string;
  startDate: string | null;
  venueName: string | null;
  primaryCity: string | null;
  description: string | null;
}

export interface NewWedding extends WeddingDetails {
  displayName: string;
  timezone: string;
  createdBy: string;
}

/** A change to a wedding: only the given fields change. */
export type WeddingChanges = Partial<WeddingDetails> & { displayName?: string };
