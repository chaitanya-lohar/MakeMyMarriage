'use client';

import { useId, type ReactNode } from 'react';
import { Icon, type IconName } from '@/components/ui/icon';
import { weddingFields } from '../content';
import {
  previewDisplayName,
  WeddingLimits,
  type WeddingFormErrors,
  type WeddingFormField,
  type WeddingFormValues,
} from '../wedding-form-model';

interface FieldsProps {
  values: WeddingFormValues;
  errors: WeddingFormErrors;
  onChange: (field: WeddingFormField, value: string) => void;
  disabled: boolean;
}

const controlClasses =
  'w-full rounded-lg border border-outline-variant/70 bg-white text-body-md text-navy transition-colors placeholder:text-outline focus:border-secondary focus:ring-2 focus:ring-secondary/20 focus:outline-none disabled:bg-surface-container-low disabled:text-on-surface-variant aria-[invalid=true]:border-error aria-[invalid=true]:bg-error-container/20';

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1.5 flex items-center gap-1.5 text-body-sm text-error">
      <Icon name="error" className="size-4" />
      {message}
    </p>
  );
}

function Field({
  label,
  error,
  children,
  id,
}: {
  label: string;
  error?: string;
  id: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className={`mb-1.5 block text-body-sm font-medium ${error ? 'text-error' : 'text-navy'}`}
      >
        {label}
      </label>
      {children}
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

function TextInput({
  field,
  icon,
  inputMode,
  props,
}: {
  field: Exclude<WeddingFormField, 'description'>;
  icon: IconName;
  inputMode?: 'numeric';
  props: FieldsProps;
}) {
  const id = useId();
  const error = props.errors[field];
  const copy = weddingFields[field];
  return (
    <Field id={id} label={copy.label} error={error}>
      <div className="relative">
        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-outline">
          <Icon name={icon} className="size-5" />
        </span>
        <input
          id={id}
          name={field}
          type="text"
          inputMode={inputMode}
          autoComplete="off"
          value={props.values[field]}
          onChange={(event) => props.onChange(field, event.target.value)}
          placeholder={copy.placeholder}
          disabled={props.disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`${controlClasses} min-h-11 py-2.5 pr-3 pl-10`}
        />
      </div>
    </Field>
  );
}

/** The wedding fields shared by Create wedding (S3) and Wedding details (S5). */
export function WeddingFormFields(props: FieldsProps) {
  const descriptionId = useId();
  const preview = previewDisplayName(props.values);
  const descriptionLength = props.values.description.trim().length;
  const overLimit = descriptionLength > WeddingLimits.description;
  const descriptionError = props.errors.description;

  return (
    <div className="space-y-5">
      <div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TextInput field="brideName" icon="person" props={props} />
          <TextInput field="groomName" icon="person" props={props} />
        </div>
        {preview && (
          <p className="mt-2 text-body-sm text-on-surface-variant" aria-live="polite">
            {weddingFields.preview} <span className="font-medium text-navy">{preview}</span>
          </p>
        )}
      </div>

      <TextInput field="startDate" icon="calendar_month" inputMode="numeric" props={props} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TextInput field="venueName" icon="location_on" props={props} />
        <TextInput field="primaryCity" icon="apartment" props={props} />
      </div>

      <div>
        <label
          htmlFor={descriptionId}
          className={`mb-1.5 block text-body-sm font-medium ${descriptionError ? 'text-error' : 'text-navy'}`}
        >
          {weddingFields.description.label}
        </label>
        <textarea
          id={descriptionId}
          name="description"
          rows={4}
          value={props.values.description}
          onChange={(event) => props.onChange('description', event.target.value)}
          placeholder={weddingFields.description.placeholder}
          disabled={props.disabled}
          aria-invalid={descriptionError ? true : undefined}
          aria-describedby={`${descriptionId}-count${descriptionError ? ` ${descriptionId}-error` : ''}`}
          className={`${controlClasses} resize-none p-3 leading-relaxed`}
        />
        <div className="mt-1.5 flex items-start justify-between gap-4">
          <FieldError id={`${descriptionId}-error`} message={descriptionError} />
          <p
            id={`${descriptionId}-count`}
            className={`ml-auto text-body-sm ${overLimit ? 'text-error' : 'text-on-surface-variant'}`}
          >
            {descriptionLength.toLocaleString('en-IN')} /{' '}
            {WeddingLimits.description.toLocaleString('en-IN')}
          </p>
        </div>
      </div>
    </div>
  );
}

/** A message above the form: rose for errors, sage for success (Stitch S3/S5 states). */
export function FormBanner({
  tone,
  icon,
  children,
}: {
  tone: 'error' | 'success';
  icon: IconName;
  children: ReactNode;
}) {
  const error = tone === 'error';
  return (
    <div
      role={error ? 'alert' : 'status'}
      className={`mb-6 flex items-start gap-2.5 rounded-lg border p-4 text-body-sm ${
        error
          ? 'border-error/30 bg-error-container/60 text-on-error-container'
          : 'border-tertiary-fixed-dim bg-[#eef4f0] text-[#2d5a3f]'
      }`}
    >
      <Icon name={icon} className={`size-5 ${error ? 'text-error' : 'text-[#2d5a3f]'}`} />
      <div>{children}</div>
    </div>
  );
}

/** Midnight-navy primary button with the spinner used while sending (0015, 0016). */
export function PrimaryButton({
  children,
  pending,
  pendingLabel,
  className = '',
}: {
  children: ReactNode;
  pending: boolean;
  pendingLabel: string;
  className?: string;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-navy px-6 text-label-md text-on-primary shadow-sm transition-all duration-150 hover:bg-[#1e293b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary active:scale-[0.98] disabled:cursor-wait disabled:opacity-90 ${className}`}
    >
      {pending && (
        <span
          aria-hidden="true"
          className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent"
        />
      )}
      {pending ? pendingLabel : children}
    </button>
  );
}
