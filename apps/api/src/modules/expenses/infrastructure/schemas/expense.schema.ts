import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, type HydratedDocument } from 'mongoose';
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CURRENCY,
  PAYMENT_STATUSES,
  type ExpenseCategory,
  type PaymentStatus,
} from '../../domain/rules/expense-rules.js';

/**
 * `expenses` collection (Database Design §12.1, decision 0028). There is no visibility field
 * (0009), no description and no payer: the payer is on each payment (0028 #11, #12).
 */
@Schema({ collection: 'expenses', timestamps: true })
export class ExpenseRecord {
  @Prop({ type: Types.ObjectId, required: true })
  weddingId!: Types.ObjectId;

  @Prop({ required: true })
  title!: string;

  /** The full cost, integer paise (0028 #5, #6). */
  @Prop({ required: true })
  amountMinor!: number;

  /** The sum of the payments; changed only together with them (0028 #8). */
  @Prop({ required: true, default: 0 })
  paidMinor!: number;

  @Prop({ required: true, default: EXPENSE_CURRENCY })
  currency!: string;

  @Prop({ type: String, required: true, enum: EXPENSE_CATEGORIES })
  category!: ExpenseCategory;

  /** Absent for a whole-wedding expense. */
  @Prop({ type: Types.ObjectId })
  eventId?: Types.ObjectId;

  /** Kept for Phase 9; never set in Phase 8 (0028 #4). */
  @Prop({ type: Types.ObjectId })
  vendorId?: Types.ObjectId;

  /** Midnight UTC of the calendar date in the wedding's timezone, as for events. */
  @Prop({ required: true })
  expenseDate!: Date;

  /** Follows from `paidMinor` and `amountMinor`; written by the server only (0028 #7). */
  @Prop({ type: String, required: true, enum: PAYMENT_STATUSES })
  paymentStatus!: PaymentStatus;

  @Prop()
  notes?: string;

  @Prop({ type: Types.ObjectId, required: true })
  createdBy!: Types.ObjectId;

  @Prop()
  deletedAt?: Date;

  @Prop({ type: Types.ObjectId })
  deletedBy?: Types.ObjectId;

  createdAt!: Date;
  updatedAt!: Date;
}

export type ExpenseDocument = HydratedDocument<ExpenseRecord>;
export const ExpenseSchema = SchemaFactory.createForClass(ExpenseRecord);

// Database Design §20, §26.
ExpenseSchema.index({ weddingId: 1, expenseDate: 1 });
ExpenseSchema.index({ weddingId: 1, category: 1 });
ExpenseSchema.index({ weddingId: 1, paymentStatus: 1 });
ExpenseSchema.index({ weddingId: 1, eventId: 1 });
ExpenseSchema.index({ weddingId: 1, vendorId: 1 });
ExpenseSchema.index({ weddingId: 1, createdAt: 1 });
