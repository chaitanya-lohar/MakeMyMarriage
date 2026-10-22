'use client';

import { type FormEvent, useId, useRef, useState } from 'react';
import {
  Banner,
  controlClasses,
  describedBy,
  Field,
  PrimaryButton,
  SecondaryButton,
} from '@/components/ui/form';
import { Icon } from '@/components/ui/icon';
import { useModal } from '@/components/ui/use-modal';
import { networkError } from '@/features/weddings/content';
import { api, call, type ApiError } from '@/lib/api';
import { methodLabels, paymentForm } from '../content';
import {
  emptyPaymentForm,
  ExpenseLimits,
  formFromPayment,
  OTHER_PAYER,
  PAYMENT_METHODS,
  paymentErrorsFromApi,
  toPaymentPayload,
  validatePaymentForm,
  type ApiExpense,
  type ApiPayment,
  type PaymentFormErrors,
  type PaymentFormValues,
} from '../expense-model';
import { formatRupees } from '../money';

/** Which form: a new payment, "Mark as fully paid" (filled in — 0028 #14), or an edit. */
export type PaymentDialogMode =
  { kind: 'add' } | { kind: 'fullyPaid' } | { kind: 'edit'; payment: ApiPayment };

const counter = (value: string, max: number) =>
  `${value.trim().length.toLocaleString('en-IN')} / ${max.toLocaleString('en-IN')}`;

/**
 * The payment form (Stitch "P8 · E5"): a dialog on desktop, a bottom sheet on mobile. There is
 * no Remove here; a payment is removed from its row (0029 D1).
 */
export function PaymentDialog({
  weddingId,
  expense,
  mode,
  today,
  user,
  onSaved,
  onRefresh,
  onPaymentGone,
  onError,
  onClose,
}: {
  weddingId: string;
  expense: ApiExpense;
  mode: PaymentDialogMode;
  /** Today in the wedding's timezone; payments are never later (0028 #13). */
  today: string;
  user: { id: string; displayName: string };
  onSaved: () => void;
  /** Reloads the expense and its payments behind the dialog, e.g. after an overpayment. */
  onRefresh: () => void;
  /** The payment being edited was removed meanwhile, e.g. in another tab. */
  onPaymentGone: () => void;
  /** For errors the page handles itself: signed out, or the expense gone. */
  onError: (error: ApiError) => void;
  onClose: () => void;
}) {
  const editing = mode.kind === 'edit' ? mode.payment : null;
  const [values, setValues] = useState<PaymentFormValues>(() =>
    editing
      ? formFromPayment(editing)
      : emptyPaymentForm(
          today,
          user.id,
          mode.kind === 'fullyPaid' ? expense.pendingMinor : undefined,
        ),
  );
  const [errors, setErrors] = useState<PaymentFormErrors>({});
  const [banner, setBanner] = useState<string>();
  const [pending, setPending] = useState(false);
  const submitting = useRef(false);
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useModal(panel, { onClose, canClose: !pending });

  // What can still be paid; an edited payment's own amount counts as not yet paid.
  const availableMinor = expense.pendingMinor + (editing?.amountMinor ?? 0);
  // A member who paid before (not the signed-in one) stays selectable when editing.
  const otherMember =
    editing?.paidByType === 'WEDDING_MEMBER' && editing.paidByUserId !== user.id
      ? { id: editing.paidByUserId ?? '', name: editing.paidByName }
      : null;

  const ids = {
    amount: useId(),
    paymentDate: useId(),
    payerName: useId(),
    method: useId(),
    reference: useId(),
    notes: useId(),
  };

  function change<K extends keyof PaymentFormValues>(field: K, value: PaymentFormValues[K]) {
    setValues((previous) => ({ ...previous, [field]: value }));
    if (errors[field]) setErrors((previous) => ({ ...previous, [field]: undefined }));
  }

  async function save(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    if (submitting.current) return;
    setBanner(undefined);
    const found = validatePaymentForm(values, today, availableMinor, formatRupees);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    submitting.current = true;
    setPending(true);
    const body = toPaymentPayload(values);
    const result = editing
      ? await call(() =>
          api.PATCH('/api/v1/weddings/{weddingId}/expenses/{expenseId}/payments/{paymentId}', {
            params: { path: { weddingId, expenseId: expense.id, paymentId: editing.id } },
            body,
          }),
        )
      : await call(() =>
          api.POST('/api/v1/weddings/{weddingId}/expenses/{expenseId}/payments', {
            params: { path: { weddingId, expenseId: expense.id } },
            body,
          }),
        );
    submitting.current = false;
    setPending(false);
    if (result.data) {
      onSaved();
      return;
    }
    const error = result.error;
    if (error.code === 'PAYMENT_EXCEEDS_BALANCE') {
      // Someone else paid meanwhile: show the new pending amount behind the dialog (P8-M3).
      setErrors({ amount: error.message });
      onRefresh();
    } else if (error.code === 'VALIDATION_FAILED') setErrors(paymentErrorsFromApi(error.fields));
    else if (error.code === 'PAYMENT_NOT_FOUND') onPaymentGone();
    else if (error.code === 'MEMBER_NOT_FOUND') setBanner(paymentForm.memberGone);
    else if (
      error.status === 401 ||
      error.code === 'EXPENSE_NOT_FOUND' ||
      error.code === 'WEDDING_NOT_FOUND'
    ) {
      onError(error);
    } else setBanner(error.status === 0 ? networkError : paymentForm.serverError);
  }

  const title =
    mode.kind === 'edit'
      ? paymentForm.editTitle
      : mode.kind === 'fullyPaid'
        ? paymentForm.fullyPaidTitle
        : paymentForm.addTitle;
  const select = `${controlClasses} min-h-11 appearance-none py-2.5 pr-10 pl-3`;
  const radio = (selected: boolean) =>
    `flex min-h-11 cursor-pointer items-center justify-center rounded-lg border px-3 text-center text-label-md transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-secondary ${
      selected
        ? 'border-navy bg-navy text-on-primary'
        : 'border-outline-variant/70 bg-white text-navy hover:bg-surface-container-low'
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-navy/40"
        onClick={() => !pending && onClose()}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:max-w-[540px] sm:rounded-xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-hairline px-6 py-5">
          <div className="min-w-0">
            <h2 id={titleId} className="font-serif text-headline-sm text-navy">
              {title}
            </h2>
            <p className="mt-1 text-body-sm break-words text-on-surface-variant">
              {mode.kind === 'edit'
                ? expense.title
                : mode.kind === 'fullyPaid'
                  ? paymentForm.checkDetails
                  : paymentForm.pendingLine
                      .replace('{pending}', formatRupees(expense.pendingMinor))
                      .replace('{amount}', formatRupees(expense.amountMinor))}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            aria-label={paymentForm.close}
            className="flex size-11 shrink-0 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-secondary"
          >
            <Icon name="close" className="size-5" />
          </button>
        </div>

        <form onSubmit={(formEvent) => void save(formEvent)} noValidate className="space-y-5 p-6">
          {banner && (
            <Banner tone="error" icon="error">
              {banner}
            </Banner>
          )}

          <Field
            id={ids.amount}
            label={
              <>
                {paymentForm.amount.label}
                <span className="text-error"> *</span>
              </>
            }
            error={errors.amount}
            hint={mode.kind === 'fullyPaid' ? paymentForm.amount.fullHint : undefined}
          >
            <div className="relative">
              <span
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-body-md text-on-surface-variant"
              >
                ₹
              </span>
              <input
                id={ids.amount}
                inputMode="decimal"
                value={values.amount}
                onChange={(changeEvent) => change('amount', changeEvent.target.value)}
                placeholder="0"
                disabled={pending}
                autoComplete="off"
                aria-required
                aria-invalid={errors.amount ? true : undefined}
                aria-describedby={describedBy(
                  ids.amount,
                  errors.amount,
                  mode.kind === 'fullyPaid' ? paymentForm.amount.fullHint : undefined,
                )}
                className={`${controlClasses} min-h-11 py-2.5 pr-3 pl-8 tabular-nums`}
              />
            </div>
          </Field>

          <Field
            id={ids.paymentDate}
            label={
              <>
                {paymentForm.paymentDate.label}
                <span className="text-error"> *</span>
              </>
            }
            error={errors.paymentDate}
            hint={paymentForm.paymentDate.hint}
          >
            <input
              id={ids.paymentDate}
              type="date"
              max={today}
              value={values.paymentDate}
              onChange={(changeEvent) => change('paymentDate', changeEvent.target.value)}
              disabled={pending}
              aria-required
              aria-invalid={errors.paymentDate ? true : undefined}
              aria-describedby={describedBy(
                ids.paymentDate,
                errors.paymentDate,
                paymentForm.paymentDate.hint,
              )}
              className={`${controlClasses} min-h-11 px-3 py-2.5`}
            />
          </Field>

          <fieldset>
            <legend className="mb-1.5 block text-body-sm font-medium text-navy">
              {paymentForm.paidBy.label}
              <span className="text-error"> *</span>
            </legend>
            <div className="grid grid-cols-2 gap-2">
              {[
                {
                  value: user.id,
                  label: paymentForm.paidBy.me.replace('{name}', user.displayName),
                },
                ...(otherMember ? [{ value: otherMember.id, label: otherMember.name }] : []),
                { value: OTHER_PAYER, label: paymentForm.paidBy.someoneElse },
              ].map((option) => (
                <label key={option.value} className={radio(values.payer === option.value)}>
                  <input
                    type="radio"
                    name="payer"
                    value={option.value}
                    checked={values.payer === option.value}
                    onChange={() => change('payer', option.value)}
                    disabled={pending}
                    className="sr-only"
                  />
                  <span className="break-words">{option.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {values.payer === OTHER_PAYER && (
            <Field
              id={ids.payerName}
              label={
                <>
                  {paymentForm.name.label}
                  <span className="text-error"> *</span>
                </>
              }
              error={errors.payerName}
              hint={paymentForm.name.hint}
              aside={counter(values.payerName, ExpenseLimits.payerName)}
            >
              <input
                id={ids.payerName}
                value={values.payerName}
                onChange={(changeEvent) => change('payerName', changeEvent.target.value)}
                disabled={pending}
                autoComplete="off"
                aria-required
                aria-invalid={errors.payerName ? true : undefined}
                aria-describedby={describedBy(
                  ids.payerName,
                  errors.payerName,
                  paymentForm.name.hint,
                )}
                className={`${controlClasses} min-h-11 px-3 py-2.5`}
              />
            </Field>
          )}

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field id={ids.method} label={paymentForm.method.label} error={errors.method}>
              <div className="relative">
                <select
                  id={ids.method}
                  value={values.method}
                  onChange={(changeEvent) =>
                    change('method', changeEvent.target.value as PaymentFormValues['method'])
                  }
                  disabled={pending}
                  className={select}
                >
                  <option value="">{paymentForm.method.placeholder}</option>
                  {PAYMENT_METHODS.map((method) => (
                    <option key={method} value={method}>
                      {methodLabels[method]}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-outline">
                  <Icon name="keyboard_arrow_down" className="size-5" />
                </span>
              </div>
            </Field>

            <Field id={ids.reference} label={paymentForm.reference.label} error={errors.reference}>
              <input
                id={ids.reference}
                value={values.reference}
                onChange={(changeEvent) => change('reference', changeEvent.target.value)}
                placeholder={paymentForm.reference.placeholder}
                disabled={pending}
                autoComplete="off"
                aria-invalid={errors.reference ? true : undefined}
                aria-describedby={describedBy(ids.reference, errors.reference)}
                className={`${controlClasses} min-h-11 px-3 py-2.5`}
              />
            </Field>
          </div>

          <Field
            id={ids.notes}
            label={paymentForm.notes.label}
            error={errors.notes}
            aside={counter(values.notes, ExpenseLimits.paymentNotes)}
          >
            <textarea
              id={ids.notes}
              rows={2}
              value={values.notes}
              onChange={(changeEvent) => change('notes', changeEvent.target.value)}
              disabled={pending}
              aria-invalid={errors.notes ? true : undefined}
              aria-describedby={describedBy(ids.notes, errors.notes)}
              className={`${controlClasses} resize-y p-3 leading-relaxed`}
            />
          </Field>

          <div className="flex flex-col-reverse gap-3 border-t border-hairline pt-5 sm:flex-row sm:justify-end">
            <SecondaryButton onClick={onClose} disabled={pending}>
              {paymentForm.cancel}
            </SecondaryButton>
            <PrimaryButton type="submit" pending={pending} pendingLabel={paymentForm.saving}>
              {paymentForm.save}
            </PrimaryButton>
          </div>
        </form>
      </div>
    </div>
  );
}
