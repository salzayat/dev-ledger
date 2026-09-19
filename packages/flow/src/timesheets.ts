import {
  TIMESHEETS_PATH,
  validateTimesheetFile,
  type TelemetryConfig,
  type TimesheetFile,
} from '@dev-ledger/capture';
import { readBlob, treeFiles } from './git.ts';

// Confirmed timesheets from the default branch: an operator's hours for a period, by spec.

export type TimesheetRecord = {
  path: string;
  producer: 'operator';
  trust: 'reported';
  valid: boolean;
  errors: string[];
  file: TimesheetFile | null;
};

export function collectTimesheets(
  dir: string,
  branch: string,
  config: TelemetryConfig,
): TimesheetRecord[] {
  return treeFiles(dir, branch, TIMESHEETS_PATH)
    .filter((path) => path.endsWith('.json'))
    .sort()
    .map((path) => {
      const text = readBlob(dir, branch, path);
      let file: TimesheetFile | null = null;
      let errors: string[] = ['timesheet could not be read'];
      if (text !== null) {
        try {
          const parsed = JSON.parse(text) as TimesheetFile;
          errors = validateTimesheetFile(parsed, config);
          file = errors.length === 0 ? parsed : null;
        } catch (error) {
          errors = [`timesheet is not valid JSON: ${(error as Error).message}`];
        }
      }
      return {
        path,
        producer: 'operator',
        trust: 'reported',
        valid: errors.length === 0,
        errors,
        file,
      };
    });
}
