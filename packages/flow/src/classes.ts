import {
  CLASSES_PATH,
  validateClassesFile,
  type TelemetryConfig,
} from '@dev-ledger/capture';
import { readBlob } from './git.ts';

// Spec cost class declarations from the default branch: `{ spec: class }`, or empty when none is declared.

export type ClassesRecord = {
  path: string;
  valid: boolean;
  errors: string[];
  classes: Record<string, string>;
  /** The repository's declared default class, or null when none is declared. */
  default: string | null;
  /** The declared release rule, or null when none is declared. */
  release: { shipped: string; discarded: string } | null;
};

export function collectClasses(
  dir: string,
  branch: string,
  config: TelemetryConfig,
): ClassesRecord {
  const empty = {
    path: CLASSES_PATH,
    classes: {},
    default: null,
    release: null,
  };
  const text = readBlob(dir, branch, CLASSES_PATH);
  if (text === null) {
    return { ...empty, valid: true, errors: [] };
  }
  try {
    const parsed = JSON.parse(text) as {
      classes?: Record<string, string>;
      default?: string;
      release?: { shipped: string; discarded: string };
    };
    const errors = validateClassesFile(parsed, config);
    return errors.length === 0
      ? {
          path: CLASSES_PATH,
          valid: true,
          errors,
          classes: parsed.classes ?? {},
          default: parsed.default ?? null,
          release: parsed.release ?? null,
        }
      : { ...empty, valid: false, errors };
  } catch (error) {
    return {
      ...empty,
      valid: false,
      errors: [`classes file is not valid JSON: ${(error as Error).message}`],
    };
  }
}
