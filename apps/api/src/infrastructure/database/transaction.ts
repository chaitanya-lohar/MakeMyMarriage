import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import type { ClientSession, Connection } from 'mongoose';

/**
 * An opaque handle to a running MongoDB transaction. Application code passes it from one
 * repository call to the next without knowing it is a database session, so use-cases can
 * span several modules' repositories while staying free of persistence types (0006).
 */
export interface Transaction {
  readonly __transaction: unique symbol;
}

/**
 * Runs work in a MongoDB transaction (Database Design §24). Use it only when several
 * documents must change together; MongoDB retries transient transaction errors.
 */
@Injectable()
export class TransactionRunner {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  run<T>(work: (transaction: Transaction) => Promise<T>): Promise<T> {
    return this.connection.transaction((session) => work(session as unknown as Transaction));
  }
}

/** The database session behind a transaction handle, for repositories only. */
export function sessionOf(transaction: Transaction | undefined): ClientSession | undefined {
  return transaction as unknown as ClientSession | undefined;
}
