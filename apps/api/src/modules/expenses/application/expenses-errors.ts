import { HttpStatus } from '@nestjs/common';
import { AppException } from '../../../common/errors/app.exception.js';
import { ValidationFailedException } from '../../../common/errors/validation-failed.exception.js';
import { ExpenseMessages } from '../domain/rules/expense-rules.js';

const rupees = (minor: number) =>
  `₹${(minor / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

/** Expense error responses (API Design §12, §21). */
export const ExpensesErrors = {
  /** Missing, deleted or in another wedding — never told apart. */
  notFound: () =>
    new AppException({
      code: 'EXPENSE_NOT_FOUND',
      message: 'The requested expense was not found.',
      status: HttpStatus.NOT_FOUND,
    }),

  paymentNotFound: () =>
    new AppException({
      code: 'PAYMENT_NOT_FOUND',
      message: 'The requested payment was not found.',
      status: HttpStatus.NOT_FOUND,
    }),

  /** A payer who is not an active member of the wedding. */
  memberNotFound: () =>
    new AppException({
      code: 'MEMBER_NOT_FOUND',
      message: 'That person is not a member of this wedding.',
      status: HttpStatus.NOT_FOUND,
    }),

  /** Payments may never add up to more than the amount (0028 #9). */
  exceedsBalance: (remainingMinor: number) =>
    new AppException({
      code: 'PAYMENT_EXCEEDS_BALANCE',
      message: `This is more than the pending ${rupees(remainingMinor)}.`,
      status: HttpStatus.CONFLICT,
      details: { remainingMinor },
    }),

  /** The amount may never be lowered below what is paid (0028 #10). */
  amountBelowPaid: (paidMinor: number) =>
    new AppException({
      code: 'AMOUNT_BELOW_PAID',
      message: `${rupees(paidMinor)} is already paid. The amount can't be lower than that — correct the payments first.`,
      status: HttpStatus.CONFLICT,
      details: { paidMinor },
    }),

  paymentDateInFuture: () =>
    new ValidationFailedException({ paymentDate: [ExpenseMessages.paymentDateFuture] }),

  invalidCursor: () => new ValidationFailedException({ cursor: ['The cursor is not valid.'] }),
};
