import type { TelemetryConfig } from './config.ts';

// Cost class declarations per spec: `{ "add-x": "rd" }`, declared once and inherited by every change
// and session citing that spec. A declaration, never a default: a spec with none stays unclassified.

export const CLASSES_SCHEMA_VERSION = 1;
export const CLASSES_PATH = '.telemetry/classes.json';

export type ClassesFile = {
  schemaVersion: number;
  classes: Record<string, string>;
};

const FORBIDDEN_KEYS =
  /^(name|operatorName|email|operatorEmail|hourlyRate|rate|salary|compensation|userName|user)$/i;

export function validateClassesFile(
  value: unknown,
  config: TelemetryConfig,
): string[] {
  const errors: string[] = [];
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return ['classes file must be a JSON object'];
  }
  const file = value as Record<string, unknown>;
  for (const key of Object.keys(file)) {
    if (FORBIDDEN_KEYS.test(key)) {
      errors.push(`${key} is not allowed in a classes file`);
    }
  }
  if (file.schemaVersion !== CLASSES_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${CLASSES_SCHEMA_VERSION}`);
  }
  const classes = file.classes;
  if (
    typeof classes !== 'object' ||
    classes === null ||
    Array.isArray(classes)
  ) {
    errors.push('classes must be an object mapping spec to class');
    return errors;
  }
  const pattern = new RegExp(config.specPattern);
  for (const [spec, cls] of Object.entries(
    classes as Record<string, unknown>,
  )) {
    if (!pattern.test(spec)) {
      errors.push(`classes.${spec} does not match the configured spec pattern`);
    }
    if (
      typeof cls !== 'string' ||
      !config.costAllocation.costClasses.includes(cls)
    ) {
      errors.push(
        `classes.${spec} must be one of ${config.costAllocation.costClasses.join(', ')}`,
      );
    }
  }
  return errors;
}
