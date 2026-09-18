import {
  SUBSCRIPTIONS_PATH,
  validateSubscriptionFile,
  type SubscriptionCostFile,
} from '@dev-ledger/capture';
import { readBlob, treeFiles } from './git.ts';

// Subscription cost records: what a plan cost for a billing period, read from the default branch's tree.
// The amount is operator-entered, so the record is `reported`; every figure apportioned from it is
// `allocated`, and the projection never confuses the two.

export type SubscriptionRecord = {
  path: string;
  producer: 'operator';
  trust: 'reported';
  valid: boolean;
  errors: string[];
  file: SubscriptionCostFile | null;
};

export function collectSubscriptions(
  dir: string,
  branch: string,
): SubscriptionRecord[] {
  return treeFiles(dir, branch, SUBSCRIPTIONS_PATH)
    .filter((path) => path.endsWith('.json'))
    .sort()
    .map((path) => {
      const text = readBlob(dir, branch, path);
      let file: SubscriptionCostFile | null = null;
      let errors: string[] = ['subscription cost record could not be read'];
      if (text !== null) {
        try {
          const parsed = JSON.parse(text) as SubscriptionCostFile;
          errors = validateSubscriptionFile(parsed);
          file = errors.length === 0 ? parsed : null;
        } catch (error) {
          errors = [
            `subscription cost record is not valid JSON: ${(error as Error).message}`,
          ];
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
