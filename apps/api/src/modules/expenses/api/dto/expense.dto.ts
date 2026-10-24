import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { PaginatedMetaDto } from '../../../../common/http/api-envelope.decorator.js';
import { trim, trimToNull } from '../../../../common/http/dto-transforms.js';
import { IsRequiredText, Matches } from '../../../../common/http/dto-validators.js';
import { isCalendarDate } from '../../../weddings/index.js';
import {
  EXPENSE_CATEGORIES,
  ExpenseLimits,
  ExpenseMessages,
  PAYER_TYPES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  PayerType,
  type ExpenseCategory,
  type PaymentMethod,
  type PaymentStatus,
} from '../../domain/rules/expense-rules.js';
import type { ExpenseSummary, ExpenseView, PaymentView } from '../../domain/types/expense.js';

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 25;

const amountDoc = {
  type: Number,
  minimum: 1,
  maximum: ExpenseLimits.amountMaxMinor,
  example: 15000000,
  description: 'Integer paise (₹1,50,000 = 15000000). More than 0, at most ₹10 crore.',
};

/** Integer paise, more than 0, at most ₹10 crore (0028 #6). */
function IsAmountMinor(): PropertyDecorator {
  return (target, key) => {
    IsInt({ message: ExpenseMessages.amount })(target, key);
    Min(1, { message: ExpenseMessages.amount })(target, key);
    Max(ExpenseLimits.amountMaxMinor, { message: ExpenseMessages.amountTooLarge })(target, key);
  };
}

/** POST /weddings/{weddingId}/expenses (API Design §12). */
export class CreateExpenseDto {
  @ApiProperty({ example: 'Decorator', maxLength: ExpenseLimits.titleMaxLength })
  @Transform(trim)
  @IsRequiredText(ExpenseLimits.titleMaxLength, ExpenseMessages.title, ExpenseMessages.titleTooLong)
  title!: string;

  @ApiProperty(amountDoc)
  @IsAmountMinor()
  amountMinor!: number;

  @ApiProperty({ enum: EXPENSE_CATEGORIES })
  @IsIn(EXPENSE_CATEGORIES, { message: ExpenseMessages.category })
  category!: ExpenseCategory;

  @ApiProperty({
    format: 'date',
    example: '2027-01-20',
    description: 'YYYY-MM-DD; past or future allowed.',
  })
  @Transform(trim)
  @Matches(isCalendarDate, ExpenseMessages.expenseDate)
  expenseDate!: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'An active event of the wedding; null for a whole-wedding expense.',
  })
  @Transform(trimToNull)
  @IsOptional()
  @IsString()
  eventId?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: ExpenseLimits.notesMaxLength })
  @Transform(trimToNull)
  @IsOptional()
  @IsString()
  @MaxLength(ExpenseLimits.notesMaxLength, {
    message: ExpenseMessages.tooLong(ExpenseLimits.notesMaxLength),
  })
  notes?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Transform(trimToNull)
  @IsOptional()
  @IsString()
  vendorId?: string | null;
}

/** PATCH /weddings/{weddingId}/expenses/{expenseId}: send only the fields that change. */
export class UpdateExpenseDto {
  @ApiPropertyOptional({ example: 'Decorator', maxLength: ExpenseLimits.titleMaxLength })
  @Transform(trim)
  @ValidateIf((dto: UpdateExpenseDto) => dto.title !== undefined)
  @IsRequiredText(ExpenseLimits.titleMaxLength, ExpenseMessages.title, ExpenseMessages.titleTooLong)
  title?: string;

  @ApiPropertyOptional({
    ...amountDoc,
    description: `${amountDoc.description} Never below the paid total (AMOUNT_BELOW_PAID).`,
  })
  @ValidateIf((dto: UpdateExpenseDto) => dto.amountMinor !== undefined)
  @IsAmountMinor()
  amountMinor?: number;

  @ApiPropertyOptional({ enum: EXPENSE_CATEGORIES })
  @ValidateIf((dto: UpdateExpenseDto) => dto.category !== undefined)
  @IsIn(EXPENSE_CATEGORIES, { message: ExpenseMessages.category })
  category?: ExpenseCategory;

  @ApiPropertyOptional({ format: 'date', example: '2027-01-20' })
  @Transform(trim)
  @ValidateIf((dto: UpdateExpenseDto) => dto.expenseDate !== undefined)
  @Matches(isCalendarDate, ExpenseMessages.expenseDate)
  expenseDate?: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'An active event of the wedding; null for a whole-wedding expense.',
  })
  @Transform(trimToNull)
  @IsOptional()
  @IsString()
  eventId?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: ExpenseLimits.notesMaxLength })
  @Transform(trimToNull)
  @IsOptional()
  @IsString()
  @MaxLength(ExpenseLimits.notesMaxLength, {
    message: ExpenseMessages.tooLong(ExpenseLimits.notesMaxLength),
  })
  notes?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  @Transform(trimToNull)
  @IsOptional()
  @IsString()
  vendorId?: string | null;
}

/** POST and PATCH …/expenses/{expenseId}/payments: the payment's complete details. */
export class SavePaymentDto {
  @ApiProperty({ ...amountDoc, example: 5000000 })
  @IsAmountMinor()
  amountMinor!: number;

  @ApiProperty({
    format: 'date',
    example: '2027-01-20',
    description: 'YYYY-MM-DD; today or earlier in the wedding timezone.',
  })
  @Transform(trim)
  @Matches(isCalendarDate, ExpenseMessages.paymentDate)
  paymentDate!: string;

  @ApiProperty({ enum: PAYER_TYPES })
  @IsIn(PAYER_TYPES, { message: ExpenseMessages.payer })
  paidByType!: PayerType;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'For WEDDING_MEMBER: an active member of the wedding (user ID).',
  })
  @ValidateIf((dto: SavePaymentDto) => dto.paidByType === PayerType.WeddingMember)
  @IsString({ message: ExpenseMessages.payer })
  paidByUserId?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: ExpenseLimits.payerNameMaxLength,
    example: "Bride's father",
    description: 'For EXTERNAL_PERSON: who paid.',
  })
  @Transform(trim)
  @ValidateIf((dto: SavePaymentDto) => dto.paidByType === PayerType.ExternalPerson)
  @IsRequiredText(
    ExpenseLimits.payerNameMaxLength,
    ExpenseMessages.payer,
    ExpenseMessages.payerTooLong,
  )
  paidByName?: string | null;

  @ApiPropertyOptional({ enum: PAYMENT_METHODS, nullable: true })
  @IsOptional()
  @IsIn(PAYMENT_METHODS, { message: ExpenseMessages.method })
  paymentMethod?: PaymentMethod | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: ExpenseLimits.referenceMaxLength,
    description: 'For example a UPI or cheque number.',
  })
  @Transform(trimToNull)
  @IsOptional()
  @IsString()
  @MaxLength(ExpenseLimits.referenceMaxLength, {
    message: ExpenseMessages.tooLong(ExpenseLimits.referenceMaxLength),
  })
  referenceNumber?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: ExpenseLimits.paymentNotesMaxLength,
  })
  @Transform(trimToNull)
  @IsOptional()
  @IsString()
  @MaxLength(ExpenseLimits.paymentNotesMaxLength, {
    message: ExpenseMessages.tooLong(ExpenseLimits.paymentNotesMaxLength),
  })
  notes?: string | null;
}

/** GET /weddings/{weddingId}/expenses query (API Design §12, §24). */
export class ListExpensesQueryDto {
  @ApiPropertyOptional({ enum: EXPENSE_CATEGORIES })
  @IsOptional()
  @IsIn(EXPENSE_CATEGORIES)
  category?: ExpenseCategory;

  @ApiPropertyOptional({ description: 'An event ID, or `none` for whole-wedding expenses.' })
  @IsOptional()
  @IsString()
  eventId?: string;

  @ApiPropertyOptional({ enum: PAYMENT_STATUSES })
  @IsOptional()
  @IsIn(PAYMENT_STATUSES)
  paymentStatus?: PaymentStatus;

  @ApiPropertyOptional({ type: String, description: 'Title contains the text, ignoring case.' })
  @Transform(trimToNull)
  @IsOptional()
  @IsString()
  @MaxLength(ExpenseLimits.titleMaxLength)
  search?: string | null;

  @ApiPropertyOptional({ minimum: 1, maximum: MAX_PAGE_SIZE, default: DEFAULT_PAGE_SIZE })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  limit: number = DEFAULT_PAGE_SIZE;

  @ApiPropertyOptional({ description: '`meta.pagination.nextCursor` of the previous page.' })
  @IsOptional()
  @IsString()
  cursor?: string;
  @ApiPropertyOptional({ description: 'Filter linked expenses by vendor ID.' })
  @IsOptional()
  @IsString()
  vendorId?: string;
}

/** Sums in paise. */
export class ExpenseTotalsDto {
  @ApiProperty({ example: 63500000 })
  totalMinor!: number;

  @ApiProperty({ example: 45000000 })
  paidMinor!: number;

  @ApiProperty({ example: 18500000, description: 'totalMinor − paidMinor.' })
  pendingMinor!: number;
}

/** The expense list's meta: pagination plus totals over every expense matching the filters. */
export class ExpenseListMetaDto extends PaginatedMetaDto {
  @ApiProperty({ type: ExpenseTotalsDto, description: 'Over the whole filter, not one page.' })
  totals!: ExpenseTotalsDto;
}

/** An expense as returned to organizers (API Design §12). */
export class ExpenseDto {
  @ApiProperty({ example: '6650f0c2a1b2c3d4e5f60901' })
  id!: string;

  @ApiProperty({ example: 'Decorator' })
  title!: string;

  @ApiProperty({ example: 15000000, description: 'The full cost, in paise.' })
  amountMinor!: number;

  @ApiProperty({ example: 5000000, description: 'The sum of the payments, in paise.' })
  paidMinor!: number;

  @ApiProperty({ example: 10000000, description: 'amountMinor − paidMinor.' })
  pendingMinor!: number;

  @ApiProperty({ example: 'INR' })
  currency!: string;

  @ApiProperty({ enum: EXPENSE_CATEGORIES })
  category!: ExpenseCategory;

  @ApiProperty({ format: 'date', example: '2027-01-20' })
  expenseDate!: string;

  @ApiProperty({ type: String, nullable: true, description: 'Null for a whole-wedding expense.' })
  eventId!: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'Sangeet' })
  eventName!: string | null;

  @ApiProperty({ type: String, nullable: true }) vendorId!: string | null;
  @ApiProperty({ type: String, nullable: true }) vendorName!: string | null;
  @ApiProperty() vendorDeleted!: boolean;

  @ApiProperty({ enum: PAYMENT_STATUSES, description: 'Calculated from the payments.' })
  paymentStatus!: PaymentStatus;

  @ApiProperty({ type: String, nullable: true })
  notes!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;

  static from({ expense, eventName, vendorName, vendorDeleted }: ExpenseView): ExpenseDto {
    return {
      id: expense.id,
      title: expense.title,
      amountMinor: expense.amountMinor,
      paidMinor: expense.paidMinor,
      pendingMinor: expense.amountMinor - expense.paidMinor,
      currency: expense.currency,
      category: expense.category,
      expenseDate: expense.expenseDate,
      eventId: expense.eventId,
      eventName,
      vendorId: expense.vendorId,
      vendorName,
      vendorDeleted,
      paymentStatus: expense.paymentStatus,
      notes: expense.notes,
      createdAt: expense.createdAt.toISOString(),
      updatedAt: expense.updatedAt.toISOString(),
    };
  }
}

/** A payment as returned to organizers (API Design §12). */
export class PaymentDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  expenseId!: string;

  @ApiProperty({ example: 5000000, description: 'In paise.' })
  amountMinor!: number;

  @ApiProperty({ format: 'date', example: '2027-01-20' })
  paymentDate!: string;

  @ApiProperty({ enum: PAYER_TYPES })
  paidByType!: PayerType;

  @ApiProperty({ type: String, nullable: true, description: 'Set for a member payer.' })
  paidByUserId!: string | null;

  @ApiProperty({
    example: "Bride's father",
    description: "The member's display name, or the typed name.",
  })
  paidByName!: string;

  @ApiProperty({ enum: PAYMENT_METHODS, nullable: true })
  paymentMethod!: PaymentMethod | null;

  @ApiProperty({ type: String, nullable: true })
  referenceNumber!: string | null;

  @ApiProperty({ type: String, nullable: true })
  notes!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;

  static from({ payment, payerName }: PaymentView): PaymentDto {
    return {
      id: payment.id,
      expenseId: payment.expenseId,
      amountMinor: payment.amountMinor,
      paymentDate: payment.paymentDate,
      paidByType: payment.payer.type,
      paidByUserId: payment.payer.userId,
      paidByName: payerName,
      paymentMethod: payment.method,
      referenceNumber: payment.referenceNumber,
      notes: payment.notes,
      createdAt: payment.createdAt.toISOString(),
      updatedAt: payment.updatedAt.toISOString(),
    };
  }
}

export class ExpenseCategoryTotalDto {
  @ApiProperty({ enum: EXPENSE_CATEGORIES })
  category!: ExpenseCategory;

  @ApiProperty({ example: 40000000 })
  totalMinor!: number;
}

export class ExpenseEventTotalDto {
  @ApiProperty({ type: String, nullable: true, description: 'Null for the whole wedding.' })
  eventId!: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'Sangeet' })
  eventName!: string | null;

  @ApiProperty({ example: 15000000 })
  totalMinor!: number;
}

/** The dashboard's expense summary (API Design §6, decision 0028 #23). */
export class ExpenseSummaryDto extends ExpenseTotalsDto {
  @ApiProperty({
    type: [ExpenseCategoryTotalDto],
    description: 'Categories with expenses, largest total first.',
  })
  byCategory!: ExpenseCategoryTotalDto[];

  @ApiProperty({
    type: [ExpenseEventTotalDto],
    description: 'Events with expenses and the whole wedding (eventId null), largest first.',
  })
  byEvent!: ExpenseEventTotalDto[];

  static from(summary: ExpenseSummary): ExpenseSummaryDto {
    return {
      totalMinor: summary.totalMinor,
      paidMinor: summary.paidMinor,
      pendingMinor: summary.pendingMinor,
      byCategory: summary.byCategory.map((row) => ({ ...row })),
      byEvent: summary.byEvent.map((row) => ({ ...row })),
    };
  }
}
