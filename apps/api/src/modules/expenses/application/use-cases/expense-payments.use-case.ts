import { Injectable } from '@nestjs/common';
import {
  TransactionRunner,
  type Transaction,
} from '../../../../infrastructure/database/transaction.js';
import { AuditAction, AuditService } from '../../../audit/index.js';
import { MembershipsService } from '../../../workspace/index.js';
import { PayerType } from '../../domain/rules/expense-rules.js';
import type { ExpensePayment, PaymentDetails } from '../../domain/types/expense.js';
import { ExpensePaymentsRepository } from '../../infrastructure/repositories/expense-payments.repository.js';
import {
  ExpensesRepository,
  type ExpenseUpdateResult,
} from '../../infrastructure/repositories/expenses.repository.js';
import { ExpensesErrors } from '../expenses-errors.js';
import { ExpensesService } from '../services/expenses.service.js';

/** A payment's values as kept in its audit entries (0028 #18). */
function auditValues(payment: ExpensePayment): Record<string, unknown> {
  return {
    amountMinor: payment.amountMinor,
    paymentDate: payment.paymentDate,
    paidByType: payment.payer.type,
    paidByUserId: payment.payer.userId,
    paidByName: payment.payer.name,
    paymentMethod: payment.method,
    referenceNumber: payment.referenceNumber,
    notes: payment.notes,
  };
}

/**
 * Adds, edits and removes an expense's payments (Phase 8 PRD §5.2, decision 0028 #8–#15).
 *
 * Each change writes the payment, the expense's paid total and status, and an audit entry in
 * one transaction. The paid total changes through a conditional update that is refused when it
 * would pass the amount; concurrent payments to the same expense conflict on that write and
 * MongoDB retries the later one against the new total, so together they can never overpay.
 */
@Injectable()
export class ExpensePaymentsUseCase {
  constructor(
    private readonly expenses: ExpensesRepository,
    private readonly payments: ExpensePaymentsRepository,
    private readonly service: ExpensesService,
    private readonly memberships: MembershipsService,
    private readonly audit: AuditService,
    private readonly transactions: TransactionRunner,
  ) {}

  /** The expense's payments, oldest first. */
  async list(weddingId: string, expenseId: string): Promise<ExpensePayment[]> {
    await this.service.getActive(weddingId, expenseId);
    return this.payments.listForExpense(weddingId, expenseId);
  }

  async add(
    weddingId: string,
    expenseId: string,
    userId: string,
    details: PaymentDetails,
  ): Promise<ExpensePayment> {
    await this.check(weddingId, details);
    return this.transactions.run(async (transaction) => {
      await this.paid(weddingId, expenseId, details.amountMinor, transaction);
      const payment = await this.payments.create(
        { ...details, weddingId, expenseId, createdBy: userId },
        transaction,
      );
      await this.record(
        weddingId,
        userId,
        AuditAction.ExpensePaymentAdded,
        payment.id,
        { expenseId, ...auditValues(payment) },
        transaction,
      );
      return payment;
    });
  }

  async update(
    weddingId: string,
    expenseId: string,
    paymentId: string,
    userId: string,
    details: PaymentDetails,
  ): Promise<ExpensePayment> {
    return this.transactions.run(async (transaction) => {
      const current = await this.payments.find(weddingId, expenseId, paymentId, transaction);
      if (!current) throw await this.missing(weddingId, expenseId, transaction);
      await this.check(weddingId, details, current.payer.userId);
      await this.paid(
        weddingId,
        expenseId,
        details.amountMinor - current.amountMinor,
        transaction,
        current.amountMinor,
      );
      const payment = await this.payments.update(
        weddingId,
        expenseId,
        paymentId,
        details,
        transaction,
      );
      if (!payment) throw ExpensesErrors.paymentNotFound();
      // Saving without a change is not a change: no audit entry (review P8, low).
      if (JSON.stringify(auditValues(current)) === JSON.stringify(auditValues(payment))) {
        return payment;
      }
      await this.record(
        weddingId,
        userId,
        AuditAction.ExpensePaymentUpdated,
        paymentId,
        { expenseId, oldValue: auditValues(current), newValue: auditValues(payment) },
        transaction,
      );
      return payment;
    });
  }

  /** Deletes the payment after the client's confirmation; the audit entry keeps its values. */
  async remove(
    weddingId: string,
    expenseId: string,
    paymentId: string,
    userId: string,
  ): Promise<void> {
    await this.transactions.run(async (transaction) => {
      const payment = await this.payments.delete(weddingId, expenseId, paymentId, transaction);
      if (!payment) throw await this.missing(weddingId, expenseId, transaction);
      await this.paid(weddingId, expenseId, -payment.amountMinor, transaction);
      await this.record(
        weddingId,
        userId,
        AuditAction.ExpensePaymentRemoved,
        paymentId,
        { expenseId, ...auditValues(payment) },
        transaction,
      );
    });
  }

  /**
   * A member payer must be an active member, except the member who already made the payment
   * being edited: keeping them is allowed even after they leave the wedding (decision 0030).
   * Payments are never dated after today.
   */
  private async check(
    weddingId: string,
    details: PaymentDetails,
    keptMemberId: string | null = null,
  ): Promise<void> {
    if (details.payer.type === PayerType.WeddingMember) {
      const userId = details.payer.userId;
      const kept = userId !== null && userId === keptMemberId;
      if (!userId || (!kept && !(await this.memberships.findActive(userId, weddingId)))) {
        throw ExpensesErrors.memberNotFound();
      }
    }
    if (details.paymentDate > (await this.service.today(weddingId))) {
      throw ExpensesErrors.paymentDateInFuture();
    }
  }

  /**
   * Moves the expense's paid total by `deltaMinor`, or refuses an overpayment (0028 #9).
   * `editedMinor` is the amount of the payment being edited, which the refusal counts as not
   * yet paid when it reports what could still be paid.
   */
  private async paid(
    weddingId: string,
    expenseId: string,
    deltaMinor: number,
    transaction: Transaction,
    editedMinor = 0,
  ): Promise<void> {
    const result: ExpenseUpdateResult = await this.expenses.addToPaid(
      weddingId,
      expenseId,
      deltaMinor,
      transaction,
    );
    if (!('refused' in result)) return;
    if (result.refused === 'NOT_FOUND') throw ExpensesErrors.notFound();
    const { current } = result;
    throw ExpensesErrors.exceedsBalance(current.amountMinor - current.paidMinor + editedMinor);
  }

  /** EXPENSE_NOT_FOUND when the expense is gone, otherwise PAYMENT_NOT_FOUND. */
  private async missing(weddingId: string, expenseId: string, transaction: Transaction) {
    return (await this.expenses.findActive(weddingId, expenseId, transaction))
      ? ExpensesErrors.paymentNotFound()
      : ExpensesErrors.notFound();
  }

  private record(
    weddingId: string,
    actorUserId: string,
    action: AuditAction,
    paymentId: string,
    metadata: Record<string, unknown>,
    transaction: Transaction,
  ): Promise<void> {
    return this.audit.record(
      {
        weddingId,
        actorUserId,
        action,
        resourceType: 'expense_payment',
        resourceId: paymentId,
        metadata,
      },
      transaction,
    );
  }
}
