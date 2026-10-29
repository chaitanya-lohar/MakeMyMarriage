'use client';

import { Icon } from '@/components/ui/icon';
import { memberDetailCopy as copy } from '../content';
import {
  ACTION_LABELS,
  choiceOf,
  PERMISSION_ROWS,
  setChoice,
  type CellChoice,
} from '../member-model';

type Choices = Map<string, 'ALLOW' | 'DENY'>;

/**
 * The permissions table of Stitch "P10 · M4" (accordion-like rows on small screens): each
 * cell is the role default, an Allow or a Deny. `effective` — the server's evaluation of the
 * saved state — shows what the member may do; the server decides, never this table.
 * `canAllow` disables an Allow the editor may not grant (the grant ceiling, P10-4).
 */
export function PermissionsTable({
  choices,
  onChange,
  effective,
  readOnly = false,
  canAllow = () => true,
}: {
  choices: Choices;
  onChange?: (next: Choices) => void;
  effective?: Record<string, string[] | undefined>;
  readOnly?: boolean;
  canAllow?: (module: string, action: string) => boolean;
}) {
  return (
    <div className="space-y-3">
      <p className="flex items-center gap-2 text-body-sm text-on-surface-variant">
        <Icon name="info" className="size-4 text-secondary" />
        {copy.rule}
      </p>
      <ul className="divide-y divide-hairline rounded-xl border border-hairline bg-white">
        {PERMISSION_ROWS.map((row) => (
          <li key={row.module} className="p-4">
            <h3 className="mb-3 text-label-md text-navy">{row.label}</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ...row.actions.map((action) => ({ action, label: ACTION_LABELS[action]! })),
                ...row.special,
              ].map((cell) => (
                <Cell
                  key={cell.action}
                  module={row.module}
                  action={cell.action}
                  label={cell.label}
                  ownerOnlyByDefault={'ownerOnlyByDefault' in cell && cell.ownerOnlyByDefault}
                  choice={choiceOf(choices, row.module, cell.action)}
                  allowed={effective?.[row.module]?.includes(cell.action)}
                  readOnly={readOnly}
                  canAllow={canAllow(row.module, cell.action)}
                  onChoose={(choice) =>
                    onChange?.(setChoice(choices, row.module, cell.action, choice))
                  }
                />
              ))}
            </div>
            {row.module === 'MEMBERS' && (
              <p className="mt-3 text-body-sm text-on-surface-variant">{copy.membersNote}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Cell({
  module,
  action,
  label,
  ownerOnlyByDefault,
  choice,
  allowed,
  readOnly,
  canAllow,
  onChoose,
}: {
  module: string;
  action: string;
  label: string;
  ownerOnlyByDefault?: boolean;
  choice: CellChoice;
  allowed?: boolean;
  readOnly: boolean;
  canAllow: boolean;
  onChoose: (choice: CellChoice) => void;
}) {
  const id = `perm-${module}-${action}`;
  return (
    <div className="min-w-0 rounded-lg bg-surface-container-low p-3">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-body-sm font-medium text-navy">
          {label}
        </label>
        {allowed !== undefined && (
          <Icon
            name={allowed ? 'check_circle' : 'remove'}
            className={`size-4 ${allowed ? 'text-[#2d5a3f]' : 'text-on-surface-variant'}`}
            label={allowed ? copy.allowed : copy.notAllowed}
          />
        )}
      </div>
      {choice === 'ALLOW' && <p className="mt-1 text-label-sm text-[#2d5a3f]">{copy.allowed}</p>}
      {choice === 'DENY' && <p className="mt-1 text-label-sm text-error">{copy.denied}</p>}
      {choice === 'DEFAULT' && ownerOnlyByDefault && (
        <p className="mt-1 flex items-center gap-1 text-label-sm text-on-surface-variant">
          <Icon name="lock" className="size-3.5" />
          {copy.ownerOnlyByDefault}
        </p>
      )}
      <select
        id={id}
        value={choice}
        disabled={readOnly}
        onChange={(event) => onChoose(event.target.value as CellChoice)}
        className="mt-2 min-h-11 w-full rounded-lg border border-outline-variant bg-white px-2 text-body-sm text-navy focus-visible:outline-2 focus-visible:outline-secondary disabled:opacity-70"
      >
        <option value="DEFAULT">{copy.roleDefault}</option>
        <option value="ALLOW" disabled={!canAllow && choice !== 'ALLOW'}>
          {canAllow ? copy.allow : `${copy.allow} — ${copy.grantExceeds}`}
        </option>
        <option value="DENY">{copy.deny}</option>
      </select>
    </div>
  );
}
