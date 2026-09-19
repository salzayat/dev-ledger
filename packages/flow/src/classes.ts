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
};

export function collectClasses(
  dir: string,
  branch: string,
  config: TelemetryConfig,
): ClassesRecord {
  const text = readBlob(dir, branch, CLASSES_PATH);
  if (text === null) {
    return { path: CLASSES_PATH, valid: true, errors: [], classes: {} };
  }
  try {
    const parsed = JSON.parse(text) as { classes?: Record<string, string> };
    const errors = validateClassesFile(parsed, config);
    return {
      path: CLASSES_PATH,
      valid: errors.length === 0,
      errors,
      classes: errors.length === 0 ? (parsed.classes ?? {}) : {},
    };
  } catch (error) {
    return {
      path: CLASSES_PATH,
      valid: false,
      errors: [`classes file is not valid JSON: ${(error as Error).message}`],
      classes: {},
    };
  }
}
