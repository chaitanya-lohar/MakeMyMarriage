import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, type HydratedDocument } from 'mongoose';
import {
  PAYER_TYPES,
  PAYMENT_METHODS,
  type PayerType,
  type PaymentMethod,
} from '../../domain/rules/expense-rules.js';

/**
 * `expense_payments` collection (Database Design §12.2, decision 0028). The payments are the
 * source of truth for their expense's `paidMinor`. Removing a payment deletes the record; its
 * audit entry keeps the values (0028 #18).
 */
@Schema({ collection: 'expense_payments', timestamps: true })
export class ExpensePaymentRecord {
  @Prop({ type: Types.ObjectId, required: true })
  weddingId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  expenseId!: Types.ObjectId;

  /** Integer paise, more than 0. */
  @Prop({ required: true })
  amountMinor!: number;

  @Prop({ type: String, required: true, enum: PAYER_TYPES })
  paidByType!: PayerType;

  /** An active member, when the payer is a member. */
  @Prop({ type: Types.ObjectId })
  paidByUserId?: Types.ObjectId;

  /** When the payer is someone outside the wedding, e.g. "Bride's father". */
  @Prop()
  paidByName?: string;

  /** Midnight UTC of the calendar date. */
  @Prop({ required: true })
  paymentDate!: Date;

  @Prop({ type: String, enum: PAYMENT_METHODS })
  paymentMethod?: PaymentMethod;

  @Prop()
  referenceNumber?: string;

  @Prop()
  notes?: string;

  @Prop({ type: Types.ObjectId, required: true })
  createdBy!: Types.ObjectId;

  createdAt!: Date;
  updatedAt!: Date;
}

export type ExpensePaymentDocument = HydratedDocument<ExpensePaymentRecord>;
export const ExpensePaymentSchema = SchemaFactory.createForClass(ExpensePaymentRecord);

// Database Design §20.
ExpensePaymentSchema.index({ expenseId: 1, paymentDate: 1 });
ExpensePaymentSchema.index({ weddingId: 1, expenseId: 1 });
