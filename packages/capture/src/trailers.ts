import type { TelemetryConfig } from './config.ts';

// Trailers the hooks write and the projection reads. Single-valued trailers are the ones a change may
// carry only once; a disagreement across a change's commits is a `conflicting-trailer` gap.

export const TRAILER_KEYS = [
  'Spec',
  'Session',
  'Change',
  'Story-Points',
  'Work-Hours',
  'Cost-Class',
] as const;
export type TrailerKey = (typeof TRAILER_KEYS)[number];
export const SINGLE_VALUED_TRAILERS: TrailerKey[] = [
  'Spec',
  'Change',
  'Story-Points',
  'Work-Hours',
  'Cost-Class',
];

export const MAX_SUBJECT_LENGTH = 100;

export type Trailers = Partial<Record<TrailerKey, string[]>>;

/** Parses the trailer block (the final paragraph made only of `Key: value` lines) of a commit message. */
export function parseTrailers(message: string): Trailers {
  const paragraphs = message
    .replace(/\r\n/g, '\n')
    .trimEnd()
    .split(/\n\s*\n/);
  if (paragraphs.length < 2) {
    return {};
  }
  const lines = paragraphs[paragraphs.length - 1].split('\n');
  const trailers: Trailers = {};
  for (const line of lines) {
    const match = /^([A-Za-z][A-Za-z0-9-]*):\s*(.*)$/.exec(line);
    if (!match) {
      return {};
    }
    const key = TRAILER_KEYS.find(
      (candidate) => candidate.toLowerCase() === match[1].toLowerCase(),
    );
    if (key) {
      (trailers[key] ??= []).push(match[2].trim());
    }
  }
  return trailers;
}

export function subjectOf(message: string): string {
  return message.split('\n')[0] ?? '';
}

/** Validates a commit message's subject length and trailers against the configuration. */
export function validateMessage(
  message: string,
  config: TelemetryConfig,
): string[] {
  const errors: string[] = [];
  const subject = subjectOf(message);
  if (subject.length > MAX_SUBJECT_LENGTH) {
    errors.push(
      `subject is ${subject.length} characters; the limit is ${MAX_SUBJECT_LENGTH}`,
    );
  }
  errors.push(...validateTrailers(parseTrailers(message), config));
  return errors;
}

export function validateTrailers(
  trailers: Trailers,
  config: TelemetryConfig,
): string[] {
  const errors: string[] = [];
  const specPattern = new RegExp(config.specPattern);
  for (const value of trailers.Spec ?? []) {
    if (!specPattern.test(value)) {
      errors.push(
        `Spec: "${value}" does not match the configured pattern ${config.specPattern}`,
      );
    }
  }
  for (const value of trailers.Session ?? []) {
    if (!/^(none|[A-Za-z0-9][A-Za-z0-9._-]*)$/.test(value)) {
      errors.push(`Session: "${value}" is not a session identifier or none`);
    }
  }
  for (const value of trailers.Change ?? []) {
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value)) {
      errors.push(`Change: "${value}" is not a change identifier`);
    }
  }
  for (const value of trailers['Story-Points'] ?? []) {
    if (!config.effort.storyPoints.enabled) {
      errors.push('Story-Points is disabled in telemetry.config.json');
      continue;
    }
    const points = Number(value);
    if (!Number.isInteger(points) || points < 0) {
      errors.push(`Story-Points: "${value}" must be a non-negative integer`);
    } else if (
      config.effort.storyPoints.scale &&
      !config.effort.storyPoints.scale.includes(points)
    ) {
      errors.push(
        `Story-Points: ${points} is not on the configured scale ${config.effort.storyPoints.scale.join(', ')}`,
      );
    }
  }
  for (const value of trailers['Work-Hours'] ?? []) {
    if (!config.effort.workHours.enabled) {
      errors.push('Work-Hours is disabled in telemetry.config.json');
      continue;
    }
    const hours = Number(value);
    if (!Number.isFinite(hours) || hours < 0) {
      errors.push(`Work-Hours: "${value}" must be a non-negative number`);
    }
  }
  for (const value of trailers['Cost-Class'] ?? []) {
    if (!config.costAllocation.enabled) {
      errors.push(
        'Cost-Class is present but cost allocation is disabled in telemetry.config.json',
      );
    } else if (!config.costAllocation.costClasses.includes(value)) {
      errors.push(
        `Cost-Class: "${value}" is not in the configured vocabulary ${config.costAllocation.costClasses.join(', ')}`,
      );
    }
  }
  return errors;
}

/** Renders trailers as the lines a hook appends to a message. */
export function formatTrailers(
  values: Partial<Record<TrailerKey, string>>,
): string[] {
  return TRAILER_KEYS.filter(
    (key) => values[key] !== undefined && values[key] !== '',
  ).map((key) => `${key}: ${values[key]}`);
}
