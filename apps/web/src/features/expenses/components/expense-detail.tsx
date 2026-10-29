'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Banner, PrimaryButton, QuietButton, SecondaryButton } from '@/components/ui/form';
import { Icon } from '@/components/ui/icon';
import { Toast } from '@/features/tasks/components/task-parts';
import { networkError } from '@/features/weddings/content';
import { formatDate, todayIn } from '@/features/weddings/dates';
import type { ApiWedding } from '@/features/weddings/wedding-form-model';
import { EXPENSES_PATH, VENDORS_PATH } from '@/features/workspace/components/shell-parts';
import {
  PageHeader,
  SkeletonCard,
  useOneOffNotice,
  Can,
} from '@/features/workspace/components/workspace-page';
import { SESSION_ENDED_PATH, useReadyWorkspace } from '@/features/workspace/workspace-context';
import { api, call, type ApiError } from '@/lib/api';
import {
  categoryLabels,
  deleteExpense,
  expenseDetail,
  expensesPage,
  methodLabels,
  paymentStatusLabels,
  removePayment,
} from '../content';
import { formatShortDate, statusFor, type ApiExpense, type ApiPayment } from '../expense-model';
import { formatRupees } from '../money';
import { EventLabel, ExpenseNotAvailable, MoneyFigures, StatusTag } from './expense-parts';
import { PaymentDialog, type PaymentDialogMode } from './payment-dialog';

type State =
  | { status: 'loading' }
  | { status: 'gone' }
  | { status: 'error' }
  | { status: 'ready'; expense: ApiExpense; payments: ApiPayment[] };

const countText = (count: number) =>
  count === 1
    ? expenseDetail.paymentCount.one
    : expenseDetail.paymentCount.other.replace('{count}', count.toLocaleString('en-IN'));

/** `/expenses/[expenseId]`: Stitch "P8 · E4 Expense Detail" with "E5" and "E6" (decision 0029). */
export function ExpenseDetail({ wedding, expenseId }: { wedding: ApiWedding; expenseId: string }) {
  const router = useRouter();
  const { user, setNotice } = useReadyWorkspace();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [dialog, setDialog] = useState<PaymentDialogMode | null>(null);
  const [removing, setRemoving] = useState<ApiPayment | null>(null);
  const [removePending, setRemovePending] = useState(false);
  const [removeError, setRemoveError] = useState<string>();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string>();
  const [toast, setToast] = useState<string>();
  const [showSaved, dismissSaved] = useOneOffNotice('expense-saved');
  const path = { weddingId: wedding.id, expenseId };
  const today = todayIn(wedding.timezone);

  // Loads the expense and its payments; `attempt` reloads them after a change or a retry.
  useEffect(() => {
    let active = true;
    const params = { params: { path: { weddingId: wedding.id, expenseId } } };
    void Promise.all([
      call(() => api.GET('/api/v1/weddings/{weddingId}/expenses/{expenseId}', params)),
      call(() => api.GET('/api/v1/weddings/{weddingId}/expenses/{expenseId}/payments', params)),
    ]).then(([expense, payments]) => {
      if (!active) return;
      if (expense.data && payments.data) {
        setState({ status: 'ready', expense: expense.data, payments: payments.data });
        return;
      }
      const error = expense.error ?? payments.error;
      if (error?.status === 401) router.replace(SESSION_ENDED_PATH);
      else if (error?.status === 404) setState({ status: 'gone' });
      else setState({ status: 'error' });
    });
    return () => {
      active = false;
    };
  }, [wedding.id, expenseId, attempt, router]);

  /** Errors after which this page cannot carry on: signed out, or the expense gone. */
  function handleFatal(error: ApiError) {
    if (error.status === 401) router.replace(SESSION_ENDED_PATH);
    else setState({ status: 'gone' });
  }

  function reloadWith(message: string) {
    setToast(message);
    setAttempt((value) => value + 1);
  }

  const cancelRemove = useCallback(() => {
    setRemoving(null);
    setRemoveError(undefined);
  }, []);

  async function confirmRemove() {
    if (!removing) return;
    setRemovePending(true);
    setRemoveError(undefined);
    const result = await call(() =>
      api.DELETE('/api/v1/weddings/{weddingId}/expenses/{expenseId}/payments/{paymentId}', {
        params: { path: { ...path, paymentId: removing.id } },
      }),
    );
    setRemovePending(false);
    if (!result.error || result.error.code === 'PAYMENT_NOT_FOUND') {
      setRemoving(null);
      reloadWith(expenseDetail.paymentRemoved);
    } else if (result.error.status === 401 || result.error.code === 'EXPENSE_NOT_FOUND') {
      setRemoving(null);
      handleFatal(result.error);
    } else setRemoveError(result.error.status === 0 ? networkError : removePayment.error);
  }

  const cancelDelete = useCallback(() => {
    setConfirmingDelete(false);
    setDeleteError(undefined);
  }, []);

  async function confirmDelete() {
    setDeleting(true);
    setDeleteError(undefined);
    const result = await call(() =>
      api.DELETE('/api/v1/weddings/{weddingId}/expenses/{expenseId}', { params: { path } }),
    );
    if (!result.error || result.error.code === 'EXPENSE_NOT_FOUND') {
      // Stay busy until the page changes, so the dialog cannot delete twice.
      setNotice('expense-deleted');
      router.push(EXPENSES_PATH);
      return;
    }
    setDeleting(false);
    if (result.error.status === 401) router.replace(SESSION_ENDED_PATH);
    else setDeleteError(result.error.status === 0 ? networkError : deleteExpense.error);
  }

  if (state.status === 'gone') return <ExpenseNotAvailable />;
  if (state.status === 'error') {
    return (
      <div className="space-y-4">
        <Banner tone="error" icon="error">
          {expensesPage.loadError}
        </Banner>
        <PrimaryButton icon="refresh" onClick={() => setAttempt((value) => value + 1)}>
          {expensesPage.retry}
        </PrimaryButton>
      </div>
    );
  }
  if (state.status === 'loading') {
    return (
      <div className="space-y-4" aria-busy="true">
        <SkeletonCard className="h-24" />
        <SkeletonCard className="h-32" />
        <SkeletonCard className="h-48" />
      </div>
    );
  }

  const { expense, payments } = state;
  const fullyPaid = expense.paymentStatus === 'PAID';

  return (
    <div className="max-w-[960px]">
      <PageHeader
        title={expense.title}
        back={{ href: EXPENSES_PATH, label: expenseDetail.back }}
        subtitle={
          <span className="mt-1 inline-flex">
            <StatusTag status={expense.paymentStatus} />
          </span>
        }
        actions={
          <>
            <Can module="EXPENSES" action="EDIT">
              <Link
                href={`${EXPENSES_PATH}/${expense.id}/edit`}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-champagne bg-white px-5 text-label-md text-navy transition-colors hover:bg-ivory focus-visible:outline-2 focus-visible:outline-secondary"
              >
                <Icon name="edit" className="size-5" />
                {expenseDetail.edit}
              </Link>
            </Can>
            <Can module="EXPENSES" action="DELETE">
              <QuietButton icon="delete" tone="danger" onClick={() => setConfirmingDelete(true)}>
                {expenseDetail.delete}
              </QuietButton>
            </Can>
          </>
        }
      />

      <div className="space-y-6">
        <section className="rounded-xl border border-hairline bg-white p-5 shadow-sm sm:p-6">
          <MoneyFigures
            figures={[
              { label: expenseDetail.amount, minor: expense.amountMinor },
              { label: expenseDetail.paid, minor: expense.paidMinor },
              { label: expenseDetail.pending, minor: expense.pendingMinor, tone: 'pending' },
            ]}
          />
        </section>

        <section className="rounded-xl border border-hairline bg-white p-6 shadow-sm sm:p-8">
          <h2 className="mb-5 border-b border-hairline pb-3 font-serif text-headline-sm text-navy">
            {expenseDetail.details}
          </h2>
          <dl className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-3">
            <Detail label={expenseDetail.category}>{categoryLabels[expense.category]}</Detail>
            <Detail label={expenseDetail.event}>
              <EventLabel eventName={expense.eventName} />
            </Detail>
            <Detail label={expenseDetail.vendor}>
              {expense.vendorId && expense.vendorDeleted ? (
                `${expense.vendorName ?? 'Vendor'} (deleted)`
              ) : expense.vendorId ? (
                <Link href={`${VENDORS_PATH}/${expense.vendorId}`} className="text-navy underline">
                  {expense.vendorName}
                </Link>
              ) : (
                <span className="text-on-surface-variant italic">{expenseDetail.none}</span>
              )}
            </Detail>
            <Detail label={expenseDetail.expenseDate}>{formatDate(expense.expenseDate)}</Detail>
            <Detail label={expenseDetail.notes} wide>
              {expense.notes ? (
                <span className="whitespace-pre-line">{expense.notes}</span>
              ) : (
                <span className="text-on-surface-variant italic">{expenseDetail.none}</span>
              )}
            </Detail>
          </dl>
        </section>

        <section className="rounded-xl border border-hairline bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-5 flex flex-col gap-4 border-b border-hairline pb-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="flex items-center gap-3 font-serif text-headline-sm text-navy">
              {expenseDetail.payments}
              <span className="rounded-full bg-surface-container px-2.5 py-0.5 font-sans text-label-sm text-on-surface-variant">
                {countText(payments.length)}
              </span>
            </h2>
            <div className="flex flex-col gap-2 sm:items-end">
              <Can module="EXPENSES" action="CREATE">
                <div className="flex flex-col gap-3 sm:flex-row">
                  {!fullyPaid && (
                    <SecondaryButton
                      icon="check_circle"
                      onClick={() => setDialog({ kind: 'fullyPaid' })}
                    >
                      {expenseDetail.markFullyPaid}
                    </SecondaryButton>
                  )}
                  <PrimaryButton
                    icon="add"
                    disabled={fullyPaid}
                    onClick={() => setDialog({ kind: 'add' })}
                    aria-describedby={fullyPaid ? 'fully-paid-hint' : undefined}
                  >
                    {expenseDetail.addPayment}
                  </PrimaryButton>
                </div>
              </Can>
              {fullyPaid && (
                <p id="fully-paid-hint" className="text-body-sm text-on-surface-variant">
                  {expenseDetail.fullyPaidHint}
                </p>
              )}
            </div>
          </div>

          {payments.length === 0 ? (
            <div className="py-8 text-center">
              <span className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-[#faf1e4] text-secondary">
                <Icon name="receipt_long" className="size-6" />
              </span>
              <p className="text-body-md text-on-surface-variant">{expenseDetail.noPayments}</p>
            </div>
          ) : (
            <PaymentsList
              payments={payments}
              onEdit={(payment) => setDialog({ kind: 'edit', payment })}
              onRemove={setRemoving}
            />
          )}
        </section>
      </div>

      {dialog && (
        <PaymentDialog
          weddingId={wedding.id}
          expense={expense}
          mode={dialog}
          today={today}
          user={{ id: user.id, displayName: user.displayName }}
          onSaved={() => {
            setDialog(null);
            reloadWith(expenseDetail.paymentSaved);
          }}
          onRefresh={() => setAttempt((value) => value + 1)}
          onPaymentGone={() => {
            setDialog(null);
            reloadWith(expenseDetail.paymentGone);
          }}
          onError={(error) => {
            setDialog(null);
            handleFatal(error);
          }}
          onClose={() => setDialog(null)}
        />
      )}

      {removing && (
        <ConfirmDialog
          title={removePayment.title}
          body={<RemovePreview expense={expense} payment={removing} />}
          icon="delete"
          confirmLabel={removePayment.confirm}
          cancelLabel={removePayment.cancel}
          pendingLabel={removePayment.removing}
          tone="danger"
          pending={removePending}
          error={removeError}
          onConfirm={() => void confirmRemove()}
          onCancel={cancelRemove}
        />
      )}

      {confirmingDelete && (
        <ConfirmDialog
          title={deleteExpense.title}
          body={<DeletePreview expense={expense} payments={payments} />}
          icon="delete"
          confirmLabel={deleteExpense.confirm}
          cancelLabel={deleteExpense.cancel}
          pendingLabel={deleteExpense.deleting}
          tone="danger"
          pending={deleting}
          error={deleteError}
          onConfirm={() => void confirmDelete()}
          onCancel={cancelDelete}
        />
      )}

      {toast && <Toast message={toast} onClose={() => setToast(undefined)} />}
      {!toast && showSaved && <Toast message={expenseDetail.saved} onClose={dismissSaved} />}
    </div>
  );
}

function PaymentsList({
  payments,
  onEdit,
  onRemove,
}: {
  payments: ApiPayment[];
  onEdit: (payment: ApiPayment) => void;
  onRemove: (payment: ApiPayment) => void;
}) {
  const header = 'px-3 py-3 text-left text-label-sm font-semibold text-on-surface-variant';
  const actions = (payment: ApiPayment) => (
    <span className="inline-flex gap-1">
      <Can module="EXPENSES" action="EDIT">
        <QuietButton icon="edit" onClick={() => onEdit(payment)}>
          {expenseDetail.editPayment}
        </QuietButton>
      </Can>
      <Can module="EXPENSES" action="DELETE">
        <QuietButton icon="delete" tone="danger" onClick={() => onRemove(payment)}>
          {expenseDetail.removePayment}
        </QuietButton>
      </Can>
    </span>
  );
  const dash = <span className="text-outline">—</span>;

  return (
    <>
      <table className="hidden w-full table-fixed md:table">
        <thead className="border-b border-hairline">
          <tr>
            <th className={`${header} w-[12%]`}>{expenseDetail.columns.date}</th>
            <th className={`${header} w-[12%] text-right`}>{expenseDetail.columns.amount}</th>
            <th className={`${header} w-[15%]`}>{expenseDetail.columns.paidBy}</th>
            <th className={`${header} w-[10%]`}>{expenseDetail.columns.method}</th>
            <th className={`${header} w-[13%]`}>{expenseDetail.columns.reference}</th>
            <th className={`${header} w-[12%]`}>{expenseDetail.columns.notes}</th>
            <th className={`${header} w-[26%] text-right`}>{expenseDetail.columns.actions}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline text-body-sm">
          {payments.map((payment) => (
            <tr key={payment.id} className="align-middle">
              <td className="px-3 py-3 whitespace-nowrap text-navy">
                {formatShortDate(payment.paymentDate)}
              </td>
              <td className="px-3 py-3 text-right font-semibold whitespace-nowrap text-navy tabular-nums">
                {formatRupees(payment.amountMinor)}
              </td>
              <td className="px-3 py-3 break-words text-navy">{payment.paidByName}</td>
              <td className="px-3 py-3 text-on-surface-variant">
                {payment.paymentMethod ? methodLabels[payment.paymentMethod] : dash}
              </td>
              <td className="px-3 py-3 break-words text-on-surface-variant">
                {payment.referenceNumber ?? dash}
              </td>
              <td className="px-3 py-3 break-words text-on-surface-variant">
                {payment.notes ?? dash}
              </td>
              <td className="px-3 py-3 text-right">{actions(payment)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <ul className="space-y-3 md:hidden">
        {payments.map((payment) => (
          <li key={payment.id} className="rounded-lg border border-hairline p-4">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-title-md font-semibold text-navy tabular-nums">
                {formatRupees(payment.amountMinor)}
              </span>
              <span className="text-body-sm whitespace-nowrap text-on-surface-variant">
                {formatShortDate(payment.paymentDate)}
                {payment.paymentMethod ? ` · ${methodLabels[payment.paymentMethod]}` : ''}
              </span>
            </div>
            <p className="mt-1 text-body-sm break-words text-navy">
              <span className="text-on-surface-variant">{expenseDetail.paidBy}</span>{' '}
              {payment.paidByName}
            </p>
            {payment.referenceNumber && (
              <p className="text-body-sm break-words text-on-surface-variant">
                {expenseDetail.ref} {payment.referenceNumber}
              </p>
            )}
            {payment.notes && (
              <p className="mt-1 text-body-sm break-words text-on-surface-variant italic">
                {payment.notes}
              </p>
            )}
            <div className="mt-2 flex justify-end border-t border-hairline pt-2">
              {actions(payment)}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

/** "Remove this payment?" with the paid and pending amounts before and after (0029 D2). */
function RemovePreview({ expense, payment }: { expense: ApiExpense; payment: ApiPayment }) {
  const paidAfter = expense.paidMinor - payment.amountMinor;
  const pendingAfter = expense.amountMinor - paidAfter;
  const row = (label: string, before: number, after: number) => (
    <div className="flex flex-wrap justify-between gap-x-3">
      <span className="text-on-surface-variant">{label}</span>
      <span className="text-navy tabular-nums">
        {formatRupees(before)} → <strong>{formatRupees(after)}</strong>
      </span>
    </div>
  );
  return (
    <span className="block space-y-3">
      <span className="block">
        {removePayment.body
          .replace('{amount}', formatRupees(payment.amountMinor))
          .replace('{date}', formatShortDate(payment.paymentDate))
          .replace('{payer}', payment.paidByName)}{' '}
        {removePayment.update}
      </span>
      <span className="block space-y-1 rounded-lg bg-surface-container-low p-3 text-body-sm">
        {row(removePayment.paidChange, expense.paidMinor, paidAfter)}
        {row(removePayment.pendingChange, expense.pendingMinor, pendingAfter)}
      </span>
      <span className="block text-body-sm text-on-surface-variant">
        {removePayment.statusAfter.replace(
          '{status}',
          paymentStatusLabels[statusFor(paidAfter, expense.amountMinor)],
        )}
      </span>
    </span>
  );
}

/** "Delete this expense?" with its amount and recorded payments (Stitch "P8 · E6"). */
function DeletePreview({ expense, payments }: { expense: ApiExpense; payments: ApiPayment[] }) {
  return (
    <span className="block space-y-3">
      <span className="block">
        {payments.length > 0
          ? deleteExpense.body
              .replace('{title}', expense.title)
              .replace('{payments}', countText(payments.length))
          : deleteExpense.bodyNoPayments.replace('{title}', expense.title)}
      </span>
      <span className="block space-y-1 rounded-lg bg-surface-container-low p-3 text-body-sm">
        <span className="flex justify-between gap-3">
          <span className="text-on-surface-variant">{deleteExpense.amount}</span>
          <span className="text-navy tabular-nums">{formatRupees(expense.amountMinor)}</span>
        </span>
        {payments.length > 0 && (
          <span className="flex justify-between gap-3">
            <span className="text-on-surface-variant">
              {deleteExpense.recorded.replace('{count}', payments.length.toLocaleString('en-IN'))}
            </span>
            <span className="text-navy tabular-nums">
              {deleteExpense.recordedTotal.replace('{amount}', formatRupees(expense.paidMinor))}
            </span>
          </span>
        )}
      </span>
    </span>
  );
}

function Detail({ label, wide, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return (
    <div className={wide ? 'sm:col-span-3' : undefined}>
      <dt className="mb-1 text-body-sm text-on-surface-variant">{label}</dt>
      <dd className="text-body-md break-words text-navy">{children}</dd>
    </div>
  );
}
