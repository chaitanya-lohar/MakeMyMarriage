import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types } from 'mongoose';
import { sessionOf, type Transaction } from '../../../../infrastructure/database/transaction.js';
import { PayerType } from '../../domain/rules/expense-rules.js';
import type { ExpensePayment, NewPayment, PaymentDetails } from '../../domain/types/expense.js';
import {
  ExpensePaymentRecord,
  type ExpensePaymentDocument,
} from '../schemas/expense-payment.schema.js';

const oid = (id: string) => new Types.ObjectId(id);

/** Both IDs could have been issued by this API; anything else is not found (review P8-M2). */
const validIds = (...ids: string[]) => ids.every((id) => isValidObjectId(id));

function toStoredDate(calendarDate: string): Date {
  return new Date(`${calendarDate}T00:00:00.000Z`);
}

function toPayment(document: ExpensePaymentDocument): ExpensePayment {
  return {
    id: document._id.toString(),
    weddingId: document.weddingId.toString(),
    expenseId: document.expenseId.toString(),
    amountMinor: document.amountMinor,
    payer: {
      type: document.paidByType,
      userId: document.paidByUserId ? document.paidByUserId.toString() : null,
      name: document.paidByName ?? null,
    },
    paymentDate: document.paymentDate.toISOString().slice(0, 10),
    method: document.paymentMethod ?? null,
    referenceNumber: document.referenceNumber ?? null,
    notes: document.notes ?? null,
    createdBy: document.createdBy.toString(),
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

/** The stored fields for a payment's details; the payer is a member or a typed name. */
function storedFields(details: PaymentDetails) {
  const member = details.payer.type === PayerType.WeddingMember;
  return {
    set: {
      amountMinor: details.amountMinor,
      paidByType: details.payer.type,
      paymentDate: toStoredDate(details.paymentDate),
      ...(member && details.payer.userId ? { paidByUserId: oid(details.payer.userId) } : {}),
      ...(!member && details.payer.name ? { paidByName: details.payer.name } : {}),
      ...(details.method ? { paymentMethod: details.method } : {}),
      ...(details.referenceNumber ? { referenceNumber: details.referenceNumber } : {}),
      ...(details.notes ? { notes: details.notes } : {}),
    },
    unset: {
      ...(member ? { paidByName: '' } : { paidByUserId: '' }),
      ...(details.method ? {} : { paymentMethod: '' }),
      ...(details.referenceNumber ? {} : { referenceNumber: '' }),
      ...(details.notes ? {} : { notes: '' }),
    },
  };
}

/** Data access for `expense_payments`, always scoped to one wedding and expense. */
@Injectable()
export class ExpensePaymentsRepository {
  constructor(
    @InjectModel(ExpensePaymentRecord.name)
    private readonly payments: Model<ExpensePaymentRecord>,
  ) {}

  async create(payment: NewPayment, transaction: Transaction): Promise<ExpensePayment> {
    const [document] = await this.payments.create(
      [
        {
          weddingId: oid(payment.weddingId),
          expenseId: oid(payment.expenseId),
          createdBy: oid(payment.createdBy),
          ...storedFields(payment).set,
        },
      ],
      { session: sessionOf(transaction) },
    );
    return toPayment(document as ExpensePaymentDocument);
  }

  async find(
    weddingId: string,
    expenseId: string,
    paymentId: string,
    transaction?: Transaction,
  ): Promise<ExpensePayment | null> {
    if (!validIds(expenseId, paymentId)) return null;
    const document = await this.payments
      .findOne({ _id: oid(paymentId), weddingId: oid(weddingId), expenseId: oid(expenseId) })
      .session(sessionOf(transaction) ?? null);
    return document ? toPayment(document) : null;
  }

  /** The expense's payments, oldest first (Phase 8 PRD §7). */
  async listForExpense(weddingId: string, expenseId: string): Promise<ExpensePayment[]> {
    const documents = await this.payments
      .find({ weddingId: oid(weddingId), expenseId: oid(expenseId) })
      .sort({ paymentDate: 1, createdAt: 1, _id: 1 });
    return documents.map(toPayment);
  }

  /** Replaces the payment's details. Returns null if it is not found. */
  async update(
    weddingId: string,
    expenseId: string,
    paymentId: string,
    details: PaymentDetails,
    transaction: Transaction,
  ): Promise<ExpensePayment | null> {
    if (!validIds(expenseId, paymentId)) return null;
    const { set, unset } = storedFields(details);
    const document = await this.payments.findOneAndUpdate(
      { _id: oid(paymentId), weddingId: oid(weddingId), expenseId: oid(expenseId) },
      { $set: set, ...(Object.keys(unset).length > 0 ? { $unset: unset } : {}) },
      { returnDocument: 'after', session: sessionOf(transaction) },
    );
    return document ? toPayment(document) : null;
  }

  /** Deletes the payment and returns it, or null if it is not found (0028 #15). */
  async delete(
    weddingId: string,
    expenseId: string,
    paymentId: string,
    transaction: Transaction,
  ): Promise<ExpensePayment | null> {
    if (!validIds(expenseId, paymentId)) return null;
    const document = await this.payments.findOneAndDelete(
      { _id: oid(paymentId), weddingId: oid(weddingId), expenseId: oid(expenseId) },
      { session: sessionOf(transaction) },
    );
    return document ? toPayment(document) : null;
  }
}
