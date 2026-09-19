import type { TelemetryConfig } from './config.ts';

// A timesheet: an operator's confirmed hours for one billing period, by spec, beside the hours the
// transcripts measured. `timesheet close` proposes it from the session records; the operator edits what
// the measurement got wrong and commits it. The committed figure is the one a read trusts for billing.

export const TIMESHEET_SCHEMA_VERSION = 1;
export const TIMESHEETS_PATH = '.telemetry/timesheets';

export type TimesheetFile = {
  schemaVersion: number;
  operatorId: string;
  period: string;
  /** Confirmed hours for the period, by spec; `(none)` for sessions citing no spec. */
  bySpec: Record<string, number>;
  /** Hours the session records measured for the same period, kept beside the confirmed figure. */
  measuredBySpec: Record<string, number>;
  note?: string;
};

const FORBIDDEN_KEYS =
  /^(name|operatorName|email|operatorEmail|hourlyRate|rate|salary|compensation|userName|user)$/i;
const PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/;

export function timesheetFilePath(operatorId: string, period: string): string {
  if (!PERIOD.test(period)) {
    throw new Error(`period must be YYYY-MM, got "${period}"`);
  }
  return `${TIMESHEETS_PATH}/${period}/${operatorId}.json`;
}

function hoursMap(value: unknown, label: string, errors: string[]): void {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    errors.push(`${label} must be an object of spec to hours`);
    return;
  }
  for (const [spec, hours] of Object.entries(
    value as Record<string, unknown>,
  )) {
    if (typeof hours !== 'number' || !Number.isFinite(hours) || hours < 0) {
      errors.push(`${label}.${spec} must be a non-negative number`);
    }
  }
}

export function validateTimesheetFile(
  value: unknown,
  config: TelemetryConfig,
): string[] {
  const errors: string[] = [];
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return ['timesheet must be a JSON object'];
  }
  const file = value as Record<string, unknown>;
  for (const key of Object.keys(file)) {
    if (FORBIDDEN_KEYS.test(key)) {
      errors.push(
        `${key} is not allowed: a timesheet carries no name, email address, or rate`,
      );
    }
  }
  if (file.schemaVersion !== TIMESHEET_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${TIMESHEET_SCHEMA_VERSION}`);
  }
  if (
    typeof file.operatorId !== 'string' ||
    !config.costAllocation.operators.includes(file.operatorId)
  ) {
    errors.push('operatorId must be a declared pseudonymous identifier');
  }
  if (typeof file.period !== 'string' || !PERIOD.test(file.period)) {
    errors.push('period must be YYYY-MM');
  }
  hoursMap(file.bySpec, 'bySpec', errors);
  hoursMap(file.measuredBySpec, 'measuredBySpec', errors);
  if (file.note !== undefined && typeof file.note !== 'string') {
    errors.push('note must be a string when present');
  }
  return errors;
}

export function totalHours(bySpec: Record<string, number>): number {
  return (
    Math.round(Object.values(bySpec).reduce((sum, h) => sum + h, 0) * 100) / 100
  );
}
